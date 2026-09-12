# build-native.ps1 - compile ThumbProvider.dll + TrayHost.exe with the MSVC toolchain.
param(
    [string]$VsDevCmd = "",
    [ValidateSet("x64", "x86", "arm64")]
    [string]$Arch = "x64"
)

$ErrorActionPreference = "Stop"
$proj  = Split-Path -Parent $PSScriptRoot          # project root
$root  = Join-Path $proj "native"                  # native/
$out   = Join-Path $root "build\$Arch"
New-Item -ItemType Directory -Force -Path $out | Out-Null

# ---- locate VsDevCmd.bat ----------------------------------------------------
function Find-VsDevCmd {
    $inst = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $inst) {
        $vs = & $inst -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($vs) {
            $candidate = Join-Path $vs "Common7\Tools\VsDevCmd.bat"
            if (Test-Path $candidate) { return $candidate }
        }
    }
    $fallback = "D:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
    if (Test-Path $fallback) { return $fallback }
    throw "VsDevCmd.bat not found. Pass -VsDevCmd explicitly."
}

if (-not $VsDevCmd) { $VsDevCmd = Find-VsDevCmd }
if (-not (Test-Path $VsDevCmd)) { throw "VsDevCmd.bat not found at '$VsDevCmd'" }

# ---- import MSVC environment ------------------------------------------------
Write-Host "Using VsDevCmd: $VsDevCmd (arch=$Arch)"
$envLines = & cmd /c "`"$VsDevCmd`" -arch=$Arch -host_arch=x64 >nul 2>&1 && set"
foreach ($line in $envLines) {
    $eq = $line.IndexOf('=')
    if ($eq -gt 0) {
        $k = $line.Substring(0, $eq)
        $v = $line.Substring($eq + 1)
        Set-Item -Path "env:$k" -Value $v
    }
}
if (-not (Get-Command cl -ErrorAction SilentlyContinue)) { throw "cl.exe not available after VsDevCmd." }

$common = @(
    "/nologo", "/EHsc", "/std:c++17", "/O2", "/MT", "/W3",
    "/DWIN32_LEAN_AND_MEAN", "/DUNICODE", "/D_UNICODE"
)
$inc = @("/I", $root)

function Invoke-Cl {
    param([string[]]$ArgList)
    & cl @ArgList
    if ($LASTEXITCODE -ne 0) { throw "cl failed (exit $LASTEXITCODE)" }
}

# ---- TrayHost.exe ------------------------------------------------------------
Write-Host "Building TrayHost.exe..."
$trayArgs = @()
$trayArgs += $common
$trayArgs += $inc
$trayArgs += @(
    (Join-Path $root "TrayHost\main.cpp")
    "/Fe$(Join-Path $out 'TrayHost.exe')"
    "/link", "/SUBSYSTEM:WINDOWS"
)
Invoke-Cl $trayArgs

# ---- ThumbProvider.dll -------------------------------------------------------
Write-Host "Building ThumbProvider.dll..."
$thumbArgs = @()
$thumbArgs += $common
$thumbArgs += $inc
$thumbArgs += @(
    "/LD"
    (Join-Path $root "ThumbProvider\thumbprovider.cpp")
    (Join-Path $root "ThumbProvider\dllmain.cpp")
    "/Fe$(Join-Path $out 'ThumbProvider.dll')"
    "/link", "/DEF:$(Join-Path $root 'ThumbProvider\ThumbProvider.def')"
)
Invoke-Cl $thumbArgs

Write-Host ""
Write-Host "Native build OK: $out"
Get-ChildItem $out -Filter "*.exe" | ForEach-Object { Write-Host ("  " + $_.Name + "  " + $_.Length + " bytes") }
Get-ChildItem $out -Filter "*.dll" | ForEach-Object { Write-Host ("  " + $_.Name + "  " + $_.Length + " bytes") }