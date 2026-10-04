//! Применение плана и откат. Ничего не удаляется: только переносы и переименования.
//! Каждая операция пишется в журнал (JSONL) ДО и ПОСЛЕ переноса — откат возможен даже после сбоя.

use chrono::{Duration as CDuration, Local};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

pub const KEEP_DAYS: i64 = 30;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyOp {
    pub kind: String,
    pub id: String,
    pub src: String,
    pub dst_dir: String,
    pub name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReq {
    pub name: String,
    pub root: String,
    pub dest: String,
    pub ops: Vec<ApplyOp>,
}

#[derive(Serialize)]
pub struct Skip {
    pub id: String,
    pub name: String,
    pub reason: String,
}

#[derive(Serialize)]
pub struct Done {
    pub id: String,
    pub dst: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub session_id: String,
    pub moved: usize,
    pub total: usize,
    pub skipped: Vec<Skip>,
    pub until: String,
    pub stopped: bool,
    pub done: Vec<Done>,
}

#[derive(Serialize)]
pub struct Conflict {
    pub icon: String,
    pub name: String,
    pub why: String,
}

#[derive(Serialize)]
pub struct UndoResult {
    pub restored: usize,
    pub total: usize,
    pub conflicts: Vec<Conflict>,
}

fn journal_dir(data: &Path) -> PathBuf {
    data.join("journals")
}

struct Journal(File);

impl Journal {
    fn line(&mut self, v: Value) {
        let _ = writeln!(self.0, "{}", v);
        let _ = self.0.flush();
    }
}

fn reason(e: &std::io::Error) -> String {
    match e.raw_os_error() {
        Some(32) | Some(33) => "были открыты в другой программе".into(),
        Some(5) => "нет доступа на запись".into(),
        Some(2) => "файл не найден".into(),
        Some(3) | Some(206) => "слишком длинный путь".into(),
        Some(112) | Some(39) => "не хватает места на диске".into(),
        _ => e.to_string(),
    }
}

fn mtime_secs(p: &Path) -> u64 {
    fs::metadata(p).and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0)
}

/// Свободное имя: «файл.png», «файл (2).png», …; при слишком длинном пути укорачивает имя.
fn free_target(dir: &Path, name: &str) -> PathBuf {
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    let budget = 245usize.saturating_sub(dir.to_string_lossy().chars().count() + ext.chars().count() + 6).max(12);
    let stem: String = stem.chars().take(budget).collect::<String>().trim_end().to_string();
    let mut p = dir.join(format!("{stem}{ext}"));
    let mut k = 2;
    while p.exists() {
        p = dir.join(format!("{stem} ({k}){ext}"));
        k += 1;
    }
    p
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for e in fs::read_dir(src)? {
        let e = e?;
        let t = dst.join(e.file_name());
        if e.file_type()?.is_dir() {
            copy_dir(&e.path(), &t)?;
        } else {
            fs::copy(e.path(), &t)?;
        }
    }
    Ok(())
}

fn tree_size(p: &Path) -> (u64, u64) {
    let mut n = 0u64;
    let mut bytes = 0u64;
    if p.is_file() {
        return (1, fs::metadata(p).map(|m| m.len()).unwrap_or(0));
    }
    if let Ok(rd) = fs::read_dir(p) {
        for e in rd.flatten() {
            let (a, b) = tree_size(&e.path());
            n += a;
            bytes += b;
        }
    }
    (n, bytes)
}

/// Перенос: rename; между дисками — копия, сверка и только потом удаление исходника.
fn move_item(src: &Path, dst: &Path, is_dir: bool) -> std::io::Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(e) if e.raw_os_error() == Some(17) => {
            if is_dir {
                copy_dir(src, dst)?;
                if tree_size(src) != tree_size(dst) {
                    return Err(std::io::Error::other("копия папки не совпала с оригиналом"));
                }
                fs::remove_dir_all(src)
            } else {
                fs::copy(src, dst)?;
                if fs::metadata(src)?.len() != fs::metadata(dst)?.len() {
                    let _ = fs::remove_file(dst);
                    return Err(std::io::Error::other("копия файла не совпала с оригиналом"));
                }
                fs::remove_file(src)
            }
        }
        Err(e) => Err(e),
    }
}

/// Создаёт недостающие папки и записывает в журнал те, что создали мы (их удалим при откате, если опустеют).
fn ensure_dir(dir: &Path, made: &mut HashSet<PathBuf>, j: &mut Journal) -> std::io::Result<()> {
    let mut missing = vec![];
    let mut cur = Some(dir);
    while let Some(c) = cur {
        if c.exists() {
            break;
        }
        missing.push(c.to_path_buf());
        cur = c.parent();
    }
    for m in missing.into_iter().rev() {
        fs::create_dir(&m).or_else(|e| if m.exists() { Ok(()) } else { Err(e) })?;
        if made.insert(m.clone()) {
            j.line(json!({ "t": "mkdir", "path": m }));
        }
    }
    Ok(())
}

fn rel_line(dest: &Path, p: &Path) -> String {
    p.strip_prefix(dest).map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_else(|_| p.to_string_lossy().to_string())
}

pub fn apply(app: &AppHandle, data: &Path, req: ApplyReq, cancel: &AtomicBool) -> Result<ApplyResult, String> {
    let now = Local::now();
    let session_id = format!("s{}", now.format("%Y%m%d-%H%M%S-%3f"));
    let until = (now + CDuration::days(KEEP_DAYS)).format("%Y-%m-%d").to_string();
    fs::create_dir_all(journal_dir(data)).map_err(|e| e.to_string())?;
    let f = OpenOptions::new().create(true).append(true).open(journal_dir(data).join(format!("{session_id}.jsonl"))).map_err(|e| e.to_string())?;
    let mut j = Journal(f);
    j.line(json!({ "t": "session", "id": session_id, "name": req.name, "root": req.root, "dest": req.dest, "date": now.format("%Y-%m-%d").to_string(), "until": until }));
    let dest = PathBuf::from(&req.dest);
    let total = req.ops.len();
    let mut made = HashSet::new();
    let mut skipped = vec![];
    let mut done = vec![];
    let mut stopped = false;
    let mut last_emit = Instant::now();
    for (i, op) in req.ops.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            stopped = true;
            break;
        }
        let src = PathBuf::from(&op.src);
        let shown = || src.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if !src.exists() {
            skipped.push(Skip { id: op.id.clone(), name: shown(), reason: "файл не найден".into() });
            continue;
        }
        let dir = PathBuf::from(&op.dst_dir);
        if let Err(e) = ensure_dir(&dir, &mut made, &mut j) {
            skipped.push(Skip { id: op.id.clone(), name: shown(), reason: reason(&e) });
            continue;
        }
        let target = free_target(&dir, &op.name);
        let is_dir = op.kind == "dir";
        j.line(json!({ "t": "intent", "id": op.id, "kind": op.kind, "src": src, "dst": target }));
        match move_item(&src, &target, is_dir) {
            Ok(()) => {
                let size = if is_dir { 0 } else { fs::metadata(&target).map(|m| m.len()).unwrap_or(0) };
                j.line(json!({ "t": "done", "id": op.id, "kind": op.kind, "src": src, "dst": target, "size": size, "mtime": mtime_secs(&target) }));
                if last_emit.elapsed().as_millis() > 40 || i + 1 == total {
                    last_emit = Instant::now();
                    let _ = app.emit("apply", json!({ "n": i + 1, "total": total, "line": format!("→ {}", rel_line(&dest, &target)) }));
                }
                done.push(Done { id: op.id.clone(), dst: target.to_string_lossy().to_string() });
            }
            Err(e) => skipped.push(Skip { id: op.id.clone(), name: shown(), reason: reason(&e) }),
        }
    }
    if stopped {
        j.line(json!({ "t": "stopped" }));
    }
    let _ = app.emit("apply", json!({ "n": done.len() + skipped.len(), "total": total, "line": "" }));
    Ok(ApplyResult { session_id, moved: done.len(), total, skipped, until, stopped, done })
}

struct Entry {
    kind: String,
    src: PathBuf,
    dst: PathBuf,
    size: u64,
    mtime: u64,
}

fn read_journal(path: &Path) -> (Value, Vec<Entry>, Vec<PathBuf>, bool) {
    let mut head = Value::Null;
    let mut entries = vec![];
    let mut intents: Vec<Entry> = vec![];
    let mut dirs = vec![];
    let mut undone = false;
    if let Ok(f) = File::open(path) {
        for line in BufReader::new(f).lines().map_while(Result::ok) {
            let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
            match v["t"].as_str() {
                Some("session") => head = v,
                Some("mkdir") => dirs.push(PathBuf::from(v["path"].as_str().unwrap_or(""))),
                Some("intent") => intents.push(Entry { kind: v["kind"].as_str().unwrap_or("file").into(), src: v["src"].as_str().unwrap_or("").into(), dst: v["dst"].as_str().unwrap_or("").into(), size: 0, mtime: 0 }),
                Some("done") => {
                    let e = Entry { kind: v["kind"].as_str().unwrap_or("file").into(), src: v["src"].as_str().unwrap_or("").into(), dst: v["dst"].as_str().unwrap_or("").into(), size: v["size"].as_u64().unwrap_or(0), mtime: v["mtime"].as_u64().unwrap_or(0) };
                    intents.retain(|x| x.dst != e.dst);
                    entries.push(e);
                }
                Some("undone") => undone = true,
                _ => {}
            }
        }
    }
    // перенос мог случиться, а запись «done» — нет (сбой): такие учитываем, если файл уже на новом месте
    for it in intents {
        if it.dst.exists() && !it.src.exists() {
            entries.push(it);
        }
    }
    (head, entries, dirs, undone)
}

/// Почему файл не нашёлся на новом месте: переименовали, перенесли или удалили.
fn why_missing(e: &Entry, dest_root: &Path) -> Conflict {
    let name = e.dst.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    if e.kind == "dir" {
        return Conflict { icon: "folder_off".into(), name, why: "папку перенесли или удалили".into() };
    }
    if let (Some(parent), true) = (e.dst.parent(), e.size > 0) {
        if let Ok(rd) = fs::read_dir(parent) {
            for x in rd.flatten() {
                let p = x.path();
                if p.is_file() && fs::metadata(&p).map(|m| m.len()).unwrap_or(0) == e.size && mtime_secs(&p).abs_diff(e.mtime) <= 2 {
                    return Conflict { icon: "edit".into(), name, why: "переименован вручную".into() };
                }
            }
        }
    }
    let mut stack = vec![dest_root.to_path_buf()];
    let mut seen = 0;
    let target = e.dst.file_name().map(|n| n.to_os_string());
    while let Some(d) = stack.pop() {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for x in rd.flatten() {
            seen += 1;
            if seen > 30000 {
                break;
            }
            let p = x.path();
            if p.is_dir() {
                stack.push(p);
            } else if Some(x.file_name()) == target && fs::metadata(&p).map(|m| m.len()).unwrap_or(0) == e.size {
                let folder = p.parent().and_then(|q| q.file_name()).map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                return Conflict { icon: "drive_file_move".into(), name, why: format!("перемещён в «{folder}»") };
            }
        }
    }
    Conflict { icon: "delete".into(), name, why: "удалён".into() }
}

pub fn undo(app: &AppHandle, data: &Path, session_id: &str) -> Result<UndoResult, String> {
    let path = journal_dir(data).join(format!("{session_id}.jsonl"));
    if !path.exists() {
        return Err("Журнал этой сортировки не найден".into());
    }
    let (head, entries, dirs, undone) = read_journal(&path);
    if undone {
        return Ok(UndoResult { restored: 0, total: 0, conflicts: vec![] });
    }
    let dest_root = PathBuf::from(head["dest"].as_str().unwrap_or(""));
    let total = entries.len();
    let mut restored = 0;
    let mut conflicts = vec![];
    let mut last_emit = Instant::now();
    for (i, e) in entries.iter().enumerate().rev() {
        let n = total - i;
        if e.dst.exists() {
            if e.src.exists() {
                conflicts.push(Conflict { icon: "content_copy".into(), name: e.src.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), why: "на старом месте уже есть файл с таким именем".into() });
                continue;
            }
            if let Some(parent) = e.src.parent() {
                let _ = fs::create_dir_all(parent);
            }
            match move_item(&e.dst, &e.src, e.kind == "dir") {
                Ok(()) => restored += 1,
                Err(err) => conflicts.push(Conflict { icon: "error".into(), name: e.dst.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), why: reason(&err) }),
            }
        } else {
            conflicts.push(why_missing(e, &dest_root));
        }
        if last_emit.elapsed().as_millis() > 40 || n == total {
            last_emit = Instant::now();
            let _ = app.emit("apply", json!({ "n": n, "total": total, "line": format!("← {}", e.src.file_name().map(|x| x.to_string_lossy().to_string()).unwrap_or_default()) }));
        }
    }
    // созданные нами папки — удаляем только пустые, от самых глубоких
    let mut dirs = dirs;
    dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));
    for d in dirs {
        let _ = fs::remove_dir(&d);
    }
    if let Ok(mut f) = OpenOptions::new().append(true).open(&path) {
        let _ = writeln!(f, "{}", json!({ "t": "undone", "at": Local::now().to_rfc3339() }));
    }
    Ok(UndoResult { restored, total, conflicts })
}

/// Список сортировок для боковой панели (новые сверху, без отменённых и просроченных).
pub fn history(data: &Path) -> Vec<Value> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let mut out = vec![];
    let Ok(rd) = fs::read_dir(journal_dir(data)) else { return out };
    for e in rd.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()) != Some("jsonl") {
            continue;
        }
        let (head, entries, _, undone) = read_journal(&p);
        if head.is_null() || undone || entries.is_empty() {
            continue;
        }
        let until = head["until"].as_str().unwrap_or("").to_string();
        if until.as_str() < today.as_str() {
            continue;
        }
        out.push(json!({
            "id": head["id"], "name": head["name"], "root": head["root"], "dest": head["dest"], "date": head["date"],
            "until": until, "files": entries.len(), "undone": false
        }));
    }
    out.sort_by(|a, b| b["id"].as_str().cmp(&a["id"].as_str()));
    out
}

/// Сколько файлов в папке (с ограничением по времени и количеству).
pub fn count_files(p: &Path) -> u64 {
    let t = Instant::now();
    let mut n = 0u64;
    let mut stack = vec![p.to_path_buf()];
    while let Some(d) = stack.pop() {
        if t.elapsed().as_millis() > 1500 || n > 200_000 {
            break;
        }
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            match e.file_type() {
                Ok(ft) if ft.is_dir() => stack.push(e.path()),
                Ok(_) => n += 1,
                Err(_) => {}
            }
        }
    }
    n
}
