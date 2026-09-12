# make-icons.ps1 - generate app icon (256x256 PNG + multi-size ICO) for PolyPeek
Add-Type -AssemblyName System.Drawing

function New-IconBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # rounded-square dark background with subtle vertical gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = [int]($size * 0.22)
    $d = 2 * $r
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $size - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect, [System.Drawing.Color]::FromArgb(255, 30, 38, 54),
        [System.Drawing.Color]::FromArgb(255, 16, 20, 30), 90)
    $g.FillPath($grad, $path)

    # accent glow line on top
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 110, 160, 255), [Math]::Max(2.0, $size * 0.03))
    $g.DrawLine($pen, $size * 0.18, $size * 0.14, $size * 0.82, $size * 0.14)

    # "3D" text
    $font = New-Object System.Drawing.Font("Segoe UI", [float]($size * 0.42), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 220, 230, 250))
    $textRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString("3D", $font, $brush, $textRect, $fmt)

    $g.Dispose()
    return $bmp
}

function Write-IcoPng([string]$path, [int[]]$sizes) {
    $count = $sizes.Length
    $pngBytes = New-Object 'System.Collections.Generic.List[byte[]]'
    $images = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
    foreach ($s in $sizes) {
        $bmp = New-IconBitmap $s
        $images.Add($bmp)
        $tmp = New-Object System.IO.MemoryStream
        $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes.Add($tmp.ToArray())
        $tmp.Dispose()
    }

    $full = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($full)
    $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$count)
    $bodyOff = 6 + 16 * $count
    for ($i = 0; $i -lt $count; $i++) {
        $nextOff = $bodyOff
        for ($j = 0; $j -lt $i; $j++) { $nextOff += $pngBytes[$j].Length }
        $s = $sizes[$i]
        if ($s -ge 256) {
            $bw.Write([byte]0)
        } else {
            $bw.Write([byte]$s)
        }
        $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
        $bw.Write([uint16]1); $bw.Write([uint16]32)
        $bw.Write([uint32]$pngBytes[$i].Length)
        $bw.Write([uint32]$nextOff)
    }
    for ($i = 0; $i -lt $count; $i++) { $bw.Write($pngBytes[$i]) }
    $bw.Flush()
    [System.IO.File]::WriteAllBytes($path, $full.ToArray())
    foreach ($bmp in $images) { $bmp.Dispose() }
}

$proj = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $proj "build"
$resDir   = Join-Path $proj "resources"
New-Item -ItemType Directory -Force -Path $buildDir, $resDir | Out-Null

# 256x256 PNG for electron-builder
$bmp256 = New-IconBitmap 256
$bmp256.Save((Join-Path $buildDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp256.Dispose()

# multi-size ICOs
Write-IcoPng (Join-Path $buildDir "icon.ico") @(256, 128, 64, 48, 32, 16)
Write-IcoPng (Join-Path $resDir "app.ico")  @(256, 128, 64, 48, 32, 16)
Copy-Item (Join-Path $resDir "app.ico") (Join-Path $resDir "tray.ico") -Force

Write-Host "icons regenerated: build/icon.png, build/icon.ico, resources/app.ico, resources/tray.ico"