# make-update-package.ps1 - build the slim "update exe" for the CURRENT source.
#
# Prerequisite: run scripts\package-installer.ps1 first (it produces
# dist-package\win-unpacked\resources\app.asar + native\build\x64 binaries).
# This script then bundles ONLY the app-versioned files (app.asar, natives,
# PolyPeekVersion.txt) into installer\update.iss, producing a few-MB
# PolyPeek-Update-<ver>-x64.exe that upgrades an existing install in place.
#
# Bump the version in package.json before building each release.
param(
    [string]$Version = "",  # default: package.json version
    [string]$Proxy = ""     # e.g. http://127.0.0.1:7897 (for Inno download if missing)
)
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot

if ($Proxy) {
    Set-Item env:HTTPS_PROXY $Proxy -ErrorAction SilentlyContinue
    Set-Item env:HTTP_PROXY  $Proxy -ErrorAction SilentlyContinue
    Set-Item env:ALL_PROXY   $Proxy -ErrorAction SilentlyContinue
}

$pkg = Get-Content (Join-Path $proj "package.json") -Raw | ConvertFrom-Json
if (-not $Version) { $Version = $pkg.version }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "invalid version: '$Version'" }
$ver = $Version

$unpacked = Join-Path $proj "dist-package\win-unpacked"
$asar = Join-Path $unpacked "resources\app.asar"
if (-not (Test-Path $asar)) { throw "missing $asar - run scripts\package-installer.ps1 first" }

# 1) stage update payload (relative paths mirror the installed app layout)
$stage = Join-Path $proj "dist-package\update"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Join-Path $stage "resources") | Out-Null
Copy-Item $asar (Join-Path $stage "resources\app.asar") -Force

foreach ($n in @("TrayHost.exe", "ThumbProvider.dll")) {
    $b = Join-Path $proj "native\build\x64\$n"
    if (-not (Test-Path $b)) { throw "missing native binary: $b" }
    Copy-Item $b (Join-Path $stage $n) -Force
}
"$ver" | Set-Content (Join-Path $stage "PolyPeekVersion.txt") -Encoding ASCII
Write-Host "payload staged: $stage"

# 2) compile the update installer with ISCC (shared helper)
. (Join-Path $PSScriptRoot "ensure-iscc.ps1")
$iscc = Get-ISCC -Proxy $Proxy
Write-Host "Using ISCC: $iscc"

$issPath = Join-Path $proj "installer\update.iss"
$outBase = "PolyPeek-Update-$ver-x64.exe"
$outPath = Join-Path (Join-Path $proj "dist-package") $outBase
Remove-Item $outPath -ErrorAction SilentlyContinue
Push-Location (Split-Path $issPath)
try {
    & $iscc "/O$(Join-Path $proj "dist-package")" "/DMyAppVersion=$ver" $issPath
    if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }
} finally { Pop-Location }

if (Test-Path $outPath) {
    $len = (Get-Item $outPath).Length
    Write-Host "UPDATE OK: $outPath ($len bytes)"
} else {
    throw "update installer output missing: $outPath"
}