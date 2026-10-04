//! Проверка компьютера (видеокарта, память, диск) и слежение за занятостью видеокарты.

use serde::Serialize;
use serde_json::Value;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

pub const NO_WINDOW: u32 = 0x0800_0000;

/// Запускает PowerShell-скрипт без окна и возвращает stdout в UTF-8.
pub fn powershell(script: &str) -> Result<String, String> {
    let full = format!("[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference='SilentlyContinue'; {script}");
    let out = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &full])
        .creation_flags(NO_WINDOW)
        .output()
        .map_err(|e| format!("PowerShell не запустился: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SysInfo {
    pub gpu_name: String,
    pub gpu_vram_gb: Option<f64>,
    pub gpu_kind: String,
    pub ram_gb: f64,
    pub disk_label: String,
    pub disk_free_gb: f64,
    pub models_dir: String,
}

fn is_integrated(name: &str) -> bool {
    let n = name.to_lowercase();
    (n.contains("intel") && !n.contains("arc"))
        || (n.contains("radeon") && !n.contains(" rx") && !n.contains("pro w") && !n.contains("vega 56") && !n.contains("vega 64"))
        || n.contains("basic display")
        || n.contains("microsoft")
}

pub fn system_check(models_dir: &Path) -> Result<SysInfo, String> {
    let drive = models_dir
        .to_string_lossy()
        .chars()
        .next()
        .filter(|c| c.is_ascii_alphabetic())
        .unwrap_or('C')
        .to_ascii_uppercase();
    // Объём видеопамяти берём из реестра драйвера: там точное значение для любых производителей
    let script = format!(
        r#"$g = @(Get-ItemProperty 'HKLM:\SYSTEM\ControlSet001\Control\Class\{{4d36e968-e325-11ce-bfc1-08002be10318}}\0*' | Where-Object {{ $_.DriverDesc }} | ForEach-Object {{
  $q = $_.'HardwareInformation.qwMemorySize'; $m = $_.'HardwareInformation.MemorySize'
  if ($q -is [array]) {{ $q = [BitConverter]::ToInt64([byte[]]$q, 0) }}
  if ($m -is [array]) {{ $m = [BitConverter]::ToUInt32([byte[]]$m, 0) }}
  [pscustomobject]@{{ name = [string]$_.DriverDesc; mem = [double]($(if ($q) {{ $q }} else {{ $m }})) }} }})
$ram = [double](Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='{drive}:'"
[pscustomobject]@{{ gpus = $g; ram = $ram; free = [double]$disk.FreeSpace }} | ConvertTo-Json -Compress -Depth 3"#
    );
    let raw = powershell(&script)?;
    let v: Value = serde_json::from_str(&raw).map_err(|_| format!("Не удалось прочитать сведения о системе: {raw}"))?;
    let gpus: Vec<(String, f64)> = match &v["gpus"] {
        Value::Array(a) => a.iter().map(|g| (g["name"].as_str().unwrap_or("").to_string(), g["mem"].as_f64().unwrap_or(0.0))).collect(),
        Value::Object(_) => vec![(v["gpus"]["name"].as_str().unwrap_or("").to_string(), v["gpus"]["mem"].as_f64().unwrap_or(0.0))],
        _ => vec![],
    };
    let best = gpus
        .iter()
        .filter(|(n, _)| !n.is_empty())
        .max_by(|a, b| {
            let ka = (!is_integrated(&a.0)) as u8;
            let kb = (!is_integrated(&b.0)) as u8;
            ka.cmp(&kb).then(a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        })
        .cloned();
    let (gpu_name, vram, kind) = match best {
        Some((n, mem)) => {
            let gb = mem / 1024f64.powi(3);
            let kind = if is_integrated(&n) || gb < 1.5 { "integrated" } else { "dedicated" };
            (n, if gb > 0.2 { Some((gb * 10.0).round() / 10.0) } else { None }, kind)
        }
        None => ("".into(), None, "none"),
    };
    Ok(SysInfo {
        gpu_name,
        gpu_vram_gb: vram,
        gpu_kind: kind.into(),
        ram_gb: (v["ram"].as_f64().unwrap_or(0.0) / 1024f64.powi(3) * 10.0).round() / 10.0,
        disk_label: format!("{drive}:"),
        disk_free_gb: (v["free"].as_f64().unwrap_or(0.0) / 1024f64.powi(3) * 10.0).round() / 10.0,
        models_dir: models_dir.to_string_lossy().to_string(),
    })
}

#[derive(Serialize, Clone, Default)]
pub struct GpuBusy {
    pub busy: bool,
    pub app: String,
    pub pid: u32,
}

/// Кто сейчас грузит видеокарту (3D) — кроме нас, Ollama и системных процессов.
pub fn gpu_busy() -> GpuBusy {
    let script = r#"$s = (Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples
$by = @{}
foreach ($x in $s) { if ($x.InstanceName -match 'pid_(\d+)_') { $p = [int]$Matches[1]; $by[$p] = $by[$p] + $x.CookedValue } }
$skip = 'hranilka','ollama','ollama app','llama-server','msedgewebview2','dwm','explorer','system','idle','csrss','claude','powershell'
$best = $by.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
  $p = Get-Process -Id $_.Key -ErrorAction SilentlyContinue
  if ($p -and ($skip -notcontains $p.ProcessName.ToLower())) { [pscustomobject]@{ pid = $_.Key; util = [double]$_.Value; name = $p.ProcessName; title = $p.MainWindowTitle } }
} | Select-Object -First 1
if ($best) { $best | ConvertTo-Json -Compress } else { '{}' }"#;
    let raw = powershell(script).unwrap_or_default();
    let v: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);
    let util = v["util"].as_f64().unwrap_or(0.0);
    if util < 30.0 {
        return GpuBusy::default();
    }
    let title = v["title"].as_str().unwrap_or("").trim().to_string();
    let name = v["name"].as_str().unwrap_or("").to_string();
    let app = if !title.is_empty() && title.chars().count() <= 40 { title } else { pretty_name(&name) };
    GpuBusy { busy: true, app, pid: v["pid"].as_u64().unwrap_or(0) as u32 }
}

/// FindTheNeedle → Find The Needle
fn pretty_name(s: &str) -> String {
    let mut out = String::new();
    let mut prev_lower = false;
    for ch in s.chars() {
        if ch.is_uppercase() && prev_lower {
            out.push(' ');
        }
        prev_lower = ch.is_lowercase();
        out.push(ch);
    }
    out
}

pub fn process_alive(pid: u32) -> bool {
    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"])
        .creation_flags(NO_WINDOW)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains(&format!("\"{pid}\"")))
        .unwrap_or(false)
}
