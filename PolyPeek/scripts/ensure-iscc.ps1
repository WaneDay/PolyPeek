# ensure-iscc.ps1 - dot-source helper shared by packaging scripts.
# Resolves ISCC.exe (Inno Setup 6), auto-downloads + installs it to
# %LOCALAPPDATA%\PolyPeek\cache\inno when missing. Exposes Get-ISCC.
# Requires <erroraction stop> and optional $Proxy in the caller scope.

$script:PolyPeekIsccCands = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    (Join-Path $env:LOCALAPPDATA "PolyPeek\cache\inno\ISCC.exe")
)
$script:PolyPeekFindIscc = {
    foreach ($c in $script:PolyPeekIsccCands) { if (Test-Path $c) { return $c } }
    return $null
}

function Get-ISCC {
    param([string]$Proxy = "")

    $iscc = & $script:PolyPeekFindIscc
    if ($iscc) { return $iscc }

    Write-Host "[ensure-iscc] Inno Setup not found - downloading..."
    $innoDir = Join-Path $env:LOCALAPPDATA "PolyPeek\cache\inno"
    New-Item -ItemType Directory -Force -Path $innoDir | Out-Null

    $installer = Join-Path $innoDir "innosetup-.exe"
    if ($Proxy) { $irmArgs = @{ Proxy = $Proxy; TimeoutSec = 30 } } else { $irmArgs = @{ TimeoutSec = 30 } }
    try {
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/jrsoftware/issrc/releases/latest" `
            -Headers @{ "User-Agent" = "PolyPeek" } @irmArgs
        $null = $rel.tag_name -replace "^is-", ""   # validate lookup, not strictly needed
        $exeAsset = $rel.assets | Where-Object { $_.name -match "innosetup.*\.exe$" } | Select-Object -First 1
        if (-not $exeAsset) { throw "no installer asset" }
        $url = $exeAsset.browser_download_url
        $installer = Join-Path $innoDir ($exeAsset.name)
    } catch {
        # fallback pinned version (GitHub API may be rate-limited)
        $url = "https://github.com/jrsoftware/issrc/releases/download/is-6_4_3/innosetup-6.4.3.exe"
        $installer = Join-Path $innoDir "innosetup-6.4.3.exe"
    }

    if (-not (Test-Path $installer)) {
        Write-Host "[ensure-iscc] Downloading Inno Setup from $url"
        $dl = @{ Uri = $url; OutFile = $installer; UseBasicParsing = $true; TimeoutSec = 300 }
        if ($Proxy) { $dl["Proxy"] = $Proxy }
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if ($curl) {
            $cp = @("-L", "--fail", "--retry", "2", "-sS", "-o", $installer)
            if ($Proxy) { $cp += @("--proxy", $Proxy) }
            & curl.exe $cp $url
            if ($LASTEXITCODE -ne 0) { Remove-Item $installer -ErrorAction SilentlyContinue; throw "curl download failed: $url" }
        } else {
            Invoke-WebRequest @dl
        }
    }

    $args = @("/VERYSILENT", "/SP-", "/SUPPRESSMSGBOXES", "/NORESTART", "/TYPE=full", "/DIR=" + $innoDir)
    Start-Process -FilePath $installer -ArgumentList $args -Wait

    $iscc = & $script:PolyPeekFindIscc
    if (-not $iscc) { throw "ISCC.exe still not found after Inno Setup install" }
    return $iscc
}