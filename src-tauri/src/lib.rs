mod engine;
mod fsops;
mod ollama;
mod settings;
mod sys;

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_notification::NotificationExt;

pub struct AppState {
    data: PathBuf,
    busy: AtomicBool,
    keep_tray: AtomicBool, // следим за папками — закрытие окна прячет его в трей, а не выходит
    engine: engine::EngineHost,
    pull: tokio::sync::Mutex<Option<JoinHandle<()>>>,
    gpu: tokio::sync::Mutex<Option<JoinHandle<()>>>,
    apply_cancel: Arc<AtomicBool>,
}

impl AppState {
    fn base(&self) -> &'static str {
        if settings::custom_models_dir(&self.data).is_some() { ollama::CUSTOM_BASE } else { ollama::DEFAULT_BASE }
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/* ───────────── запуск и настройки ───────────── */

#[tauri::command]
async fn boot_state(state: State<'_, AppState>) -> Result<Value, String> {
    let s = settings::load(&state.data);
    let base = state.base();
    let installed = ollama::exe_path().is_some();
    let mut running = ollama::running(base).await;
    if !running && installed {
        running = ollama::ensure_running(base, settings::custom_models_dir(&state.data), 15).await.is_ok();
    }
    let models = if running { ollama::models(base).await } else { vec![] };
    Ok(json!({
        "onboarded": s.get("onboarded").and_then(|v| v.as_bool()).unwrap_or(false),
        "model": s.get("model").cloned().unwrap_or(Value::Null),
        "recentWishes": s.get("recentWishes").cloned().unwrap_or(json!([])),
        "secPerFile": s.get("secPerFile").cloned().unwrap_or(Value::Null),
        "history": fsops::history(&state.data),
        "modelsDir": settings::models_dir(&state.data),
        "ollama": { "installed": installed, "running": running, "models": models },
        "settings": Value::Object(s),
    }))
}

/* ───────────── история, модели, слежение ───────────── */

#[tauri::command]
fn history_all(state: State<'_, AppState>) -> Vec<Value> {
    fsops::history_all(&state.data)
}

#[tauri::command]
async fn ollama_models(state: State<'_, AppState>) -> Result<Value, String> {
    let base = state.base();
    let running = ollama::running(base).await;
    let dir = settings::models_dir(&state.data);
    let sys = tauri::async_runtime::spawn_blocking({
        let d = dir.clone();
        move || sys::system_check(&d).ok()
    })
    .await
    .ok()
    .flatten();
    Ok(json!({
        "installed": ollama::exe_path().is_some(),
        "running": running,
        "version": if running { ollama::version(base).await } else { None },
        "models": if running { ollama::models_detail(base).await } else { vec![] },
        "modelsDir": dir,
        "diskFreeGb": sys.as_ref().map(|s| s.disk_free_gb),
        "diskLabel": sys.as_ref().map(|s| s.disk_label.clone()),
    }))
}

#[tauri::command]
async fn ollama_delete(state: State<'_, AppState>, name: String) -> Result<(), String> {
    ollama::delete(state.base(), &name).await
}

#[tauri::command]
async fn ollama_start(state: State<'_, AppState>) -> Result<(), String> {
    ollama::ensure_running(state.base(), settings::custom_models_dir(&state.data), 40).await
}

#[tauri::command]
async fn count_new_files(path: String, since: u64) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || fsops::count_new_files(std::path::Path::new(&path), since)).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn app_paths(state: State<'_, AppState>) -> Value {
    json!({ "data": state.data, "log": state.data.join("engine.log") })
}

#[tauri::command]
fn save_settings(state: State<'_, AppState>, patch: Value) -> Result<(), String> {
    settings::merge(&state.data, &patch)
}

#[tauri::command]
async fn system_check(state: State<'_, AppState>) -> Result<sys::SysInfo, String> {
    let dir = settings::models_dir(&state.data);
    tauri::async_runtime::spawn_blocking(move || sys::system_check(&dir)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn ollama_status(state: State<'_, AppState>) -> Result<Value, String> {
    let base = state.base();
    let running = ollama::running(base).await;
    Ok(json!({ "installed": ollama::exe_path().is_some(), "running": running, "models": if running { ollama::models(base).await } else { vec![] } }))
}

/* ───────────── модели ───────────── */

#[tauri::command]
async fn pull_start(app: AppHandle, state: State<'_, AppState>, model: String) -> Result<(), String> {
    let mut slot = state.pull.lock().await;
    if let Some(h) = slot.take() {
        h.abort();
    }
    let base = state.base().to_string();
    let custom = settings::custom_models_dir(&state.data);
    *slot = Some(tauri::async_runtime::spawn(ollama::pull(app, base, model, custom)));
    Ok(())
}

#[tauri::command]
async fn pull_pause(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(h) = state.pull.lock().await.take() {
        h.abort();
    }
    Ok(())
}

/* ───────────── движок ───────────── */

#[tauri::command]
async fn engine_call(app: AppHandle, state: State<'_, AppState>, req: Value) -> Result<Value, String> {
    let cmd = req["cmd"].as_str().unwrap_or("").to_string();
    let timeout = match cmd.as_str() {
        "scan" => 180,
        "tune" | "describe_image" => 900,
        _ => 60,
    };
    let base = state.base().to_string();
    if matches!(cmd.as_str(), "analyze" | "tune" | "describe_image" | "learn") {
        ollama::ensure_running(&base, settings::custom_models_dir(&state.data), 30).await?;
    }
    state.engine.call(&app, &state.data, &base, req, Duration::from_secs(timeout)).await
}

/* ───────────── папки и файлы ───────────── */

#[tauri::command]
async fn quick_folders(app: AppHandle) -> Result<Vec<Value>, String> {
    let p = app.path();
    let mut cands: Vec<(String, String, PathBuf)> = vec![];
    if let Ok(d) = p.download_dir() {
        cands.push(("Загрузки".into(), "download".into(), d.clone()));
    }
    if let Ok(d) = p.desktop_dir() {
        cands.push(("Рабочий стол".into(), "desktop_windows".into(), d));
    }
    if let Ok(d) = p.picture_dir() {
        cands.push(("Изображения".into(), "image".into(), d));
    }
    if let Ok(d) = p.download_dir() {
        cands.push(("Telegram Desktop".into(), "send".into(), d.join("Telegram Desktop")));
    }
    let res = tauri::async_runtime::spawn_blocking(move || {
        let hs: Vec<_> = cands
            .into_iter()
            .filter(|(_, _, d)| d.is_dir())
            .map(|(n, i, d)| std::thread::spawn(move || json!({ "name": n, "icon": i, "path": d, "count": fsops::count_files(&d) })))
            .collect();
        hs.into_iter().filter_map(|h| h.join().ok()).collect::<Vec<_>>()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
async fn apply_start(app: AppHandle, state: State<'_, AppState>, req: fsops::ApplyReq) -> Result<fsops::ApplyResult, String> {
    state.apply_cancel.store(false, Ordering::SeqCst);
    let data = state.data.clone();
    let cancel = state.apply_cancel.clone();
    tauri::async_runtime::spawn_blocking(move || fsops::apply(&app, &data, req, &cancel)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn apply_stop(state: State<'_, AppState>) {
    state.apply_cancel.store(true, Ordering::SeqCst);
}

#[tauri::command]
async fn undo_start(app: AppHandle, state: State<'_, AppState>, session_id: String) -> Result<fsops::UndoResult, String> {
    let data = state.data.clone();
    tauri::async_runtime::spawn_blocking(move || fsops::undo(&app, &data, &session_id)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    std::process::Command::new("explorer").arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/* ───────────── окно, трей, видеокарта ───────────── */

#[tauri::command]
fn set_busy(state: State<'_, AppState>, busy: bool) {
    state.busy.store(busy, Ordering::SeqCst);
}

#[tauri::command]
fn hide_to_tray(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    let _ = app.notification().builder().title("Хранилка работает в фоне").body("Значок в трее — откроет окно. Когда закончу, пришлю уведомление.").show();
}

#[tauri::command]
fn window_close(app: AppHandle, state: State<'_, AppState>) {
    if state.busy.load(Ordering::SeqCst) {
        hide_to_tray(app);
    } else if state.keep_tray.load(Ordering::SeqCst) {
        hide_watching(&app);
    } else {
        app.exit(0);
    }
}

/// Окно закрыли, а мы следим за папками: прячемся в трей. Подсказку показываем один раз за запуск.
fn hide_watching(app: &AppHandle) {
    static TOLD: AtomicBool = AtomicBool::new(false);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    if !TOLD.swap(true, Ordering::SeqCst) {
        let _ = app.notification().builder().title("Хранилка следит за папками").body("Окно скрыто в трей. Напишу, когда накопятся новые файлы.").show();
    }
}

#[tauri::command]
fn set_keep_tray(state: State<'_, AppState>, on: bool) {
    state.keep_tray.store(on, Ordering::SeqCst);
}

#[tauri::command]
async fn gpu_watch(app: AppHandle, state: State<'_, AppState>, on: bool) -> Result<(), String> {
    let mut slot = state.gpu.lock().await;
    if let Some(h) = slot.take() {
        h.abort();
    }
    if on {
        *slot = Some(tauri::async_runtime::spawn(async move {
            let mut last_busy = false;
            loop {
                tokio::time::sleep(Duration::from_secs(10)).await;
                let g = tauri::async_runtime::spawn_blocking(sys::gpu_busy).await.unwrap_or_default();
                if g.busy || last_busy {
                    let _ = app.emit("gpu", &g);
                }
                last_busy = g.busy;
            }
        }));
    }
    Ok(())
}

#[tauri::command]
async fn gpu_wait_exit(pid: u32) -> Result<(), String> {
    loop {
        let alive = tauri::async_runtime::spawn_blocking(move || sys::process_alive(pid)).await.unwrap_or(false);
        if !alive {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            // при автозапуске вместе с Windows стартуем свёрнутыми в трей, иначе — показываем окно
            if !std::env::args().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            let data = app.path().app_data_dir().unwrap_or_else(|_| settings::home().join(".hranilka"));
            std::fs::create_dir_all(&data).ok();
            app.manage(AppState {
                data,
                busy: AtomicBool::new(false),
                keep_tray: AtomicBool::new(false),
                engine: engine::EngineHost::default(),
                pull: tokio::sync::Mutex::new(None),
                gpu: tokio::sync::Mutex::new(None),
                apply_cancel: Arc::new(AtomicBool::new(false)),
            });
            let show = MenuItem::with_id(app, "show", "Открыть Хранилку", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tray = TrayIconBuilder::with_id("main").tooltip("Хранилка").menu(&menu).show_menu_on_left_click(false);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, ev| match ev.id.as_ref() {
                "show" => show_main(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, ev| {
                if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                    show_main(tray.app_handle());
                }
            })
            .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let st = app.state::<AppState>();
                if st.busy.load(Ordering::SeqCst) {
                    api.prevent_close();
                    hide_to_tray(app.clone());
                } else if st.keep_tray.load(Ordering::SeqCst) {
                    api.prevent_close();
                    hide_watching(app);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            boot_state, save_settings, system_check, ollama_status, pull_start, pull_pause, engine_call, quick_folders,
            apply_start, apply_stop, undo_start, open_path, set_busy, hide_to_tray, window_close, gpu_watch, gpu_wait_exit,
            history_all, ollama_models, ollama_delete, ollama_start, count_new_files, app_paths, set_keep_tray
        ])
        .build(tauri::generate_context!())
        .expect("не удалось запустить Хранилку")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<AppState>();
                tauri::async_runtime::block_on(state.engine.kill());
            }
        });
}
