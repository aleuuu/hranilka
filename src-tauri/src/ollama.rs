//! Движок моделей Ollama: проверка, запуск, установка и скачивание моделей с прогрессом.

use crate::sys::NO_WINDOW;
use futures_util::StreamExt;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub const DEFAULT_BASE: &str = "http://127.0.0.1:11434";
pub const CUSTOM_BASE: &str = "http://127.0.0.1:11435";

pub fn models_for(key: &str) -> Vec<String> {
    match key {
        "fast" => vec!["gemma3:4b".into(), "bge-m3".into()],
        _ => vec!["gemma3:12b".into(), "bge-m3".into()],
    }
}

/// Примерный размер на случай, если реестр недоступен.
pub fn approx_bytes(key: &str) -> u64 {
    let gb = if key == "fast" { 4.5 } else { 9.5 };
    (gb * 1024f64.powi(3)) as u64
}

pub fn exe_path() -> Option<PathBuf> {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let p = Path::new(&local).join("Programs").join("Ollama").join("ollama.exe");
        if p.exists() {
            return Some(p);
        }
    }
    let out = Command::new("where").arg("ollama").creation_flags(NO_WINDOW).output().ok()?;
    String::from_utf8_lossy(&out.stdout).lines().next().map(|l| PathBuf::from(l.trim())).filter(|p| p.exists())
}

fn client(timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder().timeout(timeout).build().unwrap_or_default()
}

pub async fn running(base: &str) -> bool {
    client(Duration::from_millis(1500)).get(format!("{base}/api/version")).send().await.map(|r| r.status().is_success()).unwrap_or(false)
}

pub async fn models(base: &str) -> Vec<String> {
    let Ok(r) = client(Duration::from_secs(4)).get(format!("{base}/api/tags")).send().await else { return vec![] };
    let Ok(v) = r.json::<Value>().await else { return vec![] };
    v["models"].as_array().map(|a| a.iter().filter_map(|m| m["name"].as_str().map(String::from)).collect()).unwrap_or_default()
}

/// Запускает Ollama, если она установлена и не отвечает. Для своей папки моделей — отдельный сервер на 11435.
pub async fn ensure_running(base: &str, custom_dir: Option<PathBuf>, wait_secs: u64) -> Result<(), String> {
    if running(base).await {
        return Ok(());
    }
    let exe = exe_path().ok_or_else(|| "Ollama не установлена".to_string())?;
    let mut cmd;
    if let Some(dir) = custom_dir {
        cmd = Command::new(&exe);
        cmd.arg("serve").env("OLLAMA_HOST", "127.0.0.1:11435").env("OLLAMA_MODELS", dir);
    } else {
        let app = exe.with_file_name("ollama app.exe");
        if app.exists() {
            cmd = Command::new(app);
        } else {
            cmd = Command::new(&exe);
            cmd.arg("serve");
        }
    }
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).creation_flags(NO_WINDOW);
    cmd.spawn().map_err(|e| format!("Не удалось запустить Ollama: {e}"))?;
    let t = Instant::now();
    while t.elapsed() < Duration::from_secs(wait_secs) {
        if running(base).await {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("Ollama не ответила после запуска".into())
}

#[derive(Serialize, Clone)]
pub struct PullError {
    pub kind: String,
    pub message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PullProgress {
    pub phase: String,
    pub completed: u64,
    pub total: u64,
    pub speed: f64,
    pub done: bool,
    pub slow: bool,
    pub error: Option<PullError>,
}

fn classify(msg: &str) -> &'static str {
    let m = msg.to_lowercase();
    if m.contains("redirect target not allowed") || m.contains("non-public") || m.contains("198.18.") || m.contains("proxy") || m.contains("certificate") {
        "vpn"
    } else if m.contains("connection") || m.contains("eof") || m.contains("reset") || m.contains("timed out") || m.contains("timeout") || m.contains("dns") || m.contains("network") || m.contains("body") || m.contains("decoding") {
        "drop"
    } else {
        "other"
    }
}

/// Размер модели по манифесту реестра (сумма слоёв).
async fn manifest_size(name: &str) -> Option<u64> {
    let (repo, tag) = name.split_once(':').unwrap_or((name, "latest"));
    let url = format!("https://registry.ollama.ai/v2/library/{repo}/manifests/{tag}");
    let r = client(Duration::from_secs(8))
        .get(url)
        .header("Accept", "application/vnd.docker.distribution.manifest.v2+json")
        .send()
        .await
        .ok()?;
    let v: Value = r.json().await.ok()?;
    let mut sum = v["config"]["size"].as_u64().unwrap_or(0);
    for l in v["layers"].as_array()? {
        sum += l["size"].as_u64().unwrap_or(0);
    }
    Some(sum)
}

struct Meter {
    app: AppHandle,
    phase: String,
    total: u64,
    last_emit: Instant,
    last_bytes: u64,
    last_t: Instant,
    speed: f64,
    started: Instant,
    slow_since: Option<Instant>,
}

impl Meter {
    fn new(app: AppHandle, phase: &str, total: u64) -> Self {
        let now = Instant::now();
        Meter { app, phase: phase.into(), total, last_emit: now - Duration::from_secs(1), last_bytes: 0, last_t: now, speed: 0.0, started: now, slow_since: None }
    }
    fn tick(&mut self, completed: u64, force: bool) {
        let now = Instant::now();
        let dt = now.duration_since(self.last_t).as_secs_f64();
        if dt >= 1.0 {
            let inst = completed.saturating_sub(self.last_bytes) as f64 / dt;
            self.speed = if self.speed == 0.0 { inst } else { self.speed * 0.6 + inst * 0.4 };
            self.last_bytes = completed;
            self.last_t = now;
            let slow_now = self.speed < 512.0 * 1024.0 && now.duration_since(self.started) > Duration::from_secs(15);
            self.slow_since = if slow_now { self.slow_since.or(Some(now)) } else { None };
        }
        if force || now.duration_since(self.last_emit) >= Duration::from_millis(250) {
            self.last_emit = now;
            let slow = self.slow_since.map(|s| now.duration_since(s) > Duration::from_secs(20)).unwrap_or(false);
            let total = self.total.max(completed);
            let _ = self.app.emit("pull", PullProgress { phase: self.phase.clone(), completed, total, speed: self.speed, done: false, slow, error: None });
        }
    }
    fn fail(&self, completed: u64, kind: &str, message: String) {
        let _ = self.app.emit("pull", PullProgress {
            phase: self.phase.clone(), completed, total: self.total.max(completed), speed: 0.0, done: false, slow: false,
            error: Some(PullError { kind: kind.into(), message }),
        });
    }
}

/// Скачивает установщик Ollama и ставит его без окон.
async fn install_ollama(app: &AppHandle) -> Result<(), String> {
    let url = "https://ollama.com/download/OllamaSetup.exe";
    let tmp = std::env::temp_dir().join("OllamaSetup.exe");
    let resp = client(Duration::from_secs(3600)).get(url).send().await.map_err(|e| e.to_string())?;
    let total = resp.content_length().unwrap_or(1_600_000_000);
    let mut meter = Meter::new(app.clone(), "engine", total);
    let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
    let mut got = 0u64;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        std::io::Write::write_all(&mut file, &chunk).map_err(|e| e.to_string())?;
        got += chunk.len() as u64;
        meter.tick(got, false);
    }
    drop(file);
    let status = Command::new(&tmp)
        .args(["/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES"])
        .creation_flags(NO_WINDOW)
        .status()
        .map_err(|e| format!("Установщик не запустился: {e}"))?;
    if !status.success() {
        return Err("Установка Ollama не завершилась".into());
    }
    Ok(())
}

/// Скачивает модели через Ollama, шлёт события «pull» с общим прогрессом.
pub async fn pull(app: AppHandle, base: String, key: String, custom_dir: Option<PathBuf>) {
    let names = models_for(&key);
    // 1. движок
    if !running(&base).await && exe_path().is_none() {
        if let Err(e) = install_ollama(&app).await {
            Meter::new(app.clone(), "engine", 1).fail(0, classify(&e), format!("Не удалось установить движок: {e}"));
            return;
        }
    }
    if let Err(e) = ensure_running(&base, custom_dir, 40).await {
        Meter::new(app.clone(), "model", approx_bytes(&key)).fail(0, "other", e);
        return;
    }
    // 2. общий размер
    let mut total = 0u64;
    for n in &names {
        match manifest_size(n).await {
            Some(s) => total += s,
            None => {
                total = approx_bytes(&key);
                break;
            }
        }
    }
    let mut meter = Meter::new(app.clone(), "model", total);
    let mut layers: HashMap<String, (u64, u64)> = HashMap::new();
    let http = client(Duration::from_secs(60 * 60 * 6));
    for name in &names {
        let resp = match http.post(format!("{base}/api/pull")).json(&json!({ "model": name, "stream": true })).send().await {
            Ok(r) => r,
            Err(e) => {
                let done: u64 = layers.values().map(|x| x.1).sum();
                meter.fail(done, "drop", e.to_string());
                return;
            }
        };
        let mut buf: Vec<u8> = Vec::new();
        let mut stream = resp.bytes_stream();
        let mut success = false;
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    let done: u64 = layers.values().map(|x| x.1).sum();
                    meter.fail(done, classify(&e.to_string()).replace("other", "drop").as_str(), e.to_string());
                    return;
                }
            };
            buf.extend_from_slice(&chunk);
            while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = buf.drain(..=pos).collect();
                let Ok(v) = serde_json::from_slice::<Value>(&line) else { continue };
                if let Some(err) = v["error"].as_str() {
                    let done: u64 = layers.values().map(|x| x.1).sum();
                    meter.fail(done, classify(err), err.to_string());
                    return;
                }
                if let (Some(d), Some(t)) = (v["digest"].as_str(), v["total"].as_u64()) {
                    let c = v["completed"].as_u64().unwrap_or(0).min(t);
                    let e = layers.entry(d.to_string()).or_insert((t, 0));
                    e.0 = t;
                    e.1 = e.1.max(c);
                }
                if v["status"].as_str() == Some("success") {
                    success = true;
                }
                let done: u64 = layers.values().map(|x| x.1).sum();
                let seen: u64 = layers.values().map(|x| x.0).sum();
                meter.total = meter.total.max(seen);
                meter.tick(done, false);
            }
        }
        if !success {
            let done: u64 = layers.values().map(|x| x.1).sum();
            meter.fail(done, "drop", "Загрузка прервалась".into());
            return;
        }
    }
    let total = meter.total.max(layers.values().map(|x| x.0).sum());
    let _ = app.emit("pull", PullProgress { phase: "model".into(), completed: total, total, speed: 0.0, done: true, slow: false, error: None });
}
