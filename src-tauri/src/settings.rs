//! Настройки приложения: settings.json в папке данных приложения.

use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

pub fn path(data: &Path) -> PathBuf {
    data.join("settings.json")
}

pub fn load(data: &Path) -> Map<String, Value> {
    std::fs::read_to_string(path(data))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

/// Сливает patch в сохранённые настройки и пишет файл атомарно.
pub fn merge(data: &Path, patch: &Value) -> Result<(), String> {
    let mut cur = load(data);
    if let Some(p) = patch.as_object() {
        for (k, v) in p {
            cur.insert(k.clone(), v.clone());
        }
    }
    std::fs::create_dir_all(data).map_err(|e| e.to_string())?;
    let tmp = data.join("settings.json.tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(&Value::Object(cur)).unwrap_or_else(|_| json!({}).to_string()))
        .map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path(data)).map_err(|e| e.to_string())
}

/// Папка с моделями: OLLAMA_MODELS, затем выбор пользователя, затем стандартная.
pub fn models_dir(data: &Path) -> PathBuf {
    if let Ok(p) = std::env::var("OLLAMA_MODELS") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    if let Some(p) = custom_models_dir(data) {
        return p;
    }
    home().join(".ollama").join("models")
}

/// Папка моделей, выбранная пользователем на шаге «Не хватает места».
pub fn custom_models_dir(data: &Path) -> Option<PathBuf> {
    load(data).get("modelsDir").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(PathBuf::from)
}

pub fn home() -> PathBuf {
    std::env::var("USERPROFILE").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("C:\\"))
}
