//! Мост к Python-движку: отдельный процесс, JSON-строки через stdin/stdout.
//! Ответы на запросы сопоставляются по id, события пересылаются в интерфейс как «engine».

use crate::sys::NO_WINDOW;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>;

struct Proc {
    stdin: ChildStdin,
    child: Child,
    alive: Arc<AtomicBool>,
    base: String,
}

pub struct EngineHost {
    proc: tokio::sync::Mutex<Option<Proc>>,
    pending: Pending,
    next: AtomicU64,
}

impl Default for EngineHost {
    fn default() -> Self {
        EngineHost { proc: tokio::sync::Mutex::new(None), pending: Arc::new(Mutex::new(HashMap::new())), next: AtomicU64::new(1) }
    }
}

/// Как запустить движок:
/// 1) в разработке — engine.py из папки проекта (правки видны без пересборки);
/// 2) в установленном приложении — hranilka-engine.exe из ресурсов (Python внутри, ничего ставить не нужно);
/// 3) переменная HRANILKA_ENGINE_DIR переопределяет папку движка.
fn engine_command(app: &AppHandle) -> Result<Command, String> {
    let dev_dir = std::env::var("HRANILKA_ENGINE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("engine"));
    let dev_py = dev_dir.join(".venv").join("Scripts").join("python.exe");
    let dev_script = dev_dir.join("engine.py");
    let dev_ok = dev_py.exists() && dev_script.exists();
    let bundled = app.path().resource_dir().ok().map(|r| r.join("engine").join("hranilka-engine.exe")).filter(|p| p.exists());
    let use_dev = dev_ok && (cfg!(debug_assertions) || bundled.is_none() || std::env::var("HRANILKA_ENGINE_DIR").is_ok());
    if use_dev {
        let mut c = Command::new(dev_py);
        c.arg("-u").arg(dev_script);
        return Ok(c);
    }
    match bundled {
        Some(exe) => Ok(Command::new(exe)),
        None => Err("Не найден движок приложения — переустановите Хранилку".into()),
    }
}

impl EngineHost {
    fn spawn(&self, app: &AppHandle, data: &PathBuf, base: &str) -> Result<Proc, String> {
        let mut cmd = engine_command(app)?;
        std::fs::create_dir_all(data).ok();
        let log = std::fs::OpenOptions::new().create(true).append(true).open(data.join("engine.log")).map_err(|e| e.to_string())?;
        let mut child = cmd
            .arg("--data")
            .arg(data)
            .env("HRANILKA_OLLAMA", base)
            .env("PYTHONIOENCODING", "utf-8")
            .env("PYTHONUTF8", "1")
            .env("OPENBLAS_NUM_THREADS", "1")
            .env("OMP_NUM_THREADS", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::from(log))
            .creation_flags(NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Движок не запустился: {e}"))?;
        let stdout = child.stdout.take().ok_or("нет stdout")?;
        let stdin = child.stdin.take().ok_or("нет stdin")?;
        let alive = Arc::new(AtomicBool::new(true));
        let (pending, alive2, app2) = (self.pending.clone(), alive.clone(), app.clone());
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
                if let Some(id) = v.get("id").and_then(|x| x.as_u64()) {
                    if let Some(tx) = pending.lock().unwrap().remove(&id) {
                        let _ = tx.send(v);
                    }
                } else if v.get("event").is_some() {
                    let _ = app2.emit("engine", v);
                }
            }
            alive2.store(false, Ordering::SeqCst);
            for (_, tx) in pending.lock().unwrap().drain() {
                let _ = tx.send(json!({ "ok": false, "error": "Движок остановился — подробности в engine.log" }));
            }
            // если движок упал посреди анализа — интерфейс покажет ошибку с кнопкой «Повторить»
            let _ = app2.emit("engine", json!({ "event": "error", "message": "движок неожиданно остановился, описания файлов сохранены — повтор займёт меньше времени" }));
        });
        Ok(Proc { stdin, child, alive, base: base.to_string() })
    }

    pub async fn call(&self, app: &AppHandle, data: &PathBuf, base: &str, mut req: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        {
            let mut guard = self.proc.lock().await;
            let restart = match guard.as_ref() {
                None => true,
                Some(p) => !p.alive.load(Ordering::SeqCst) || p.base != base,
            };
            if restart {
                if let Some(mut old) = guard.take() {
                    let _ = old.child.kill();
                }
                *guard = Some(self.spawn(app, data, base)?);
            }
            self.pending.lock().unwrap().insert(id, tx);
            req["id"] = json!(id);
            let line = serde_json::to_string(&req).map_err(|e| e.to_string())? + "\n";
            let p = guard.as_mut().unwrap();
            if let Err(e) = p.stdin.write_all(line.as_bytes()).and_then(|_| p.stdin.flush()) {
                self.pending.lock().unwrap().remove(&id);
                p.alive.store(false, Ordering::SeqCst);
                return Err(format!("Движок недоступен: {e}"));
            }
        }
        let v = match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(v)) => v,
            Ok(Err(_)) => return Err("Движок не ответил".into()),
            Err(_) => {
                self.pending.lock().unwrap().remove(&id);
                return Err("Движок слишком долго не отвечает".into());
            }
        };
        if v["ok"].as_bool() == Some(true) {
            Ok(v["result"].clone())
        } else {
            Err(v["error"].as_str().unwrap_or("ошибка движка").to_string())
        }
    }

    pub async fn kill(&self) {
        if let Some(mut p) = self.proc.lock().await.take() {
            let _ = p.child.kill();
        }
    }
}
