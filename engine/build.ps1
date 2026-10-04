# Собирает движок в самостоятельную папку dist\hranilka-engine (exe + библиотеки), без установленного Python.
# Её забирает установщик Tauri (см. bundle.resources в src-tauri\tauri.conf.json).
#   powershell -ExecutionPolicy Bypass -File engine\build.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
# uv мог поставиться без записи в PATH
$uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uv) { $uv = Join-Path $env:USERPROFILE ".local\bin\uv.exe" }
if (-not (Test-Path $uv)) { throw "нужен uv: https://docs.astral.sh/uv/getting-started/installation/" }
# uv спотыкается о кириллицу в пути профиля — даём ему короткие пути, если они уже есть
$fso = New-Object -ComObject Scripting.FileSystemObject
foreach ($v in @(@{ name = "UV_PYTHON_INSTALL_DIR"; dir = ".uvpython" }, @{ name = "UV_CACHE_DIR"; dir = ".uvcache" })) {
  $p = Join-Path $env:USERPROFILE $v.dir
  if (-not [Environment]::GetEnvironmentVariable($v.name) -and (Test-Path $p)) { Set-Item "env:$($v.name)" $fso.GetFolder($p).ShortPath }
}
& $uv sync
& $uv run pyinstaller engine.py `
  --name hranilka-engine `
  --onedir --console --noconfirm --clean `
  --distpath dist --workpath build --specpath build `
  --collect-data docx `
  --collect-all pillow_heif `
  --collect-all pymupdf `
  --exclude-module tkinter `
  --exclude-module PyInstaller
if (-not (Test-Path "dist\hranilka-engine\hranilka-engine.exe")) { throw "движок не собрался" }
$size = (Get-ChildItem dist\hranilka-engine -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
"готово: dist\hranilka-engine ({0:N0} МБ)" -f $size
