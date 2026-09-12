# package-installer.ps1 - build JS, build natives, pack:dir, drop natives into win-unpacked,
# ensure Inno Setup ISCC (auto-download on demand), then compile setup.iss.
param(
    [switch]$SkipBuild,
    [string]$Proxy = ""   # e.g. http://127.0.0.1:7897 (used for Node/electron-builder downloads)
)
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot
$thin  = Join-Path $proj "dist-package\win-unpacked"
$slug  = "PolyPeek"
$ver   = "1.0.0"

if ($Proxy) {
    Set-Item env:HTTPS_PROXY $Proxy -ErrorAction SilentlyContinue
    Set-Item env:HTTP_PROXY  $Proxy -ErrorAction SilentlyContinue
    Set-Item env:ALL_PROXY   $Proxy -ErrorAction SilentlyContinue
}

# 1) build JS bundle + native binaries
if (-not $SkipBuild) {
    Push-Location $proj
    try {
        & node scripts/build.mjs
        if ($LASTEXITCODE -ne 0) { throw "build.mjs failed" }
    } finally { Pop-Location }
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $proj "scripts\build-native.ps1")
    if ($LASTEXITCODE -ne 0) { throw "build-native.ps1 failed" }
}

# 2) electron-builder pack:dir (win x64)
Push-Location $proj
try {
    & npx electron-builder --win --dir
    if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }
} finally { Pop-Location }

# 3) drop native binaries into the unpacked app
foreach ($n in @("TrayHost.exe", "ThumbProvider.dll")) {
    $src = Join-Path $proj "native\build\x64\$n"
    if (-not (Test-Path $src)) { throw "missing native binary: $src" }
    Copy-Item $src (Join-Path $thin $n) -Force
}

# 4) ensure ISCC.exe (shared helper: locate or auto-download Inno Setup)
. (Join-Path $PSScriptRoot "ensure-iscc.ps1")
$iscc = Get-ISCC -Proxy $Proxy
Write-Host "Using ISCC: $iscc"

# 5) compile the installer
$issPath = Join-Path $proj "installer\setup.iss"
$outBase = "$slug-Setup-$ver-x64.exe"
$outPath = Join-Path (Join-Path $proj "dist-package") $outBase
Remove-Item $outPath -ErrorAction SilentlyContinue
Push-Location (Split-Path $issPath)
try {
    & $iscc "/O$(Join-Path $proj "dist-package")" "/DMyAppVersion=$ver" $issPath
    if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }
} finally { Pop-Location }
if (Test-Path $outPath) {
    $len = (Get-Item $outPath).Length
    Write-Host "INSTALLER OK: $outPath ($len bytes)"
} else {
    throw "installer output missing: $outPath"
}