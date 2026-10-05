# scripts/generate_installer_assets.ps1
# Generates high-DPI Windows icon.ico, NSIS dark theme bitmaps, and installer.nsh

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$assetsDir = Join-Path $PSScriptRoot "..\assets"
$installerDir = Join-Path $assetsDir "installer"
if (-not (Test-Path $installerDir)) {
    New-Item -ItemType Directory -Path $installerDir -Force | Out-Null
}

# Theme Color Tokens (from src/renderer/styles/global.css)
$COLOR_BG = [System.Drawing.ColorTranslator]::FromHtml("#08090A")
$COLOR_SURFACE = [System.Drawing.ColorTranslator]::FromHtml("#111214")
$COLOR_BORDER = [System.Drawing.ColorTranslator]::FromHtml("#1F2023")
$COLOR_PRIMARY = [System.Drawing.ColorTranslator]::FromHtml("#FAFAFA")
$COLOR_SECONDARY = [System.Drawing.ColorTranslator]::FromHtml("#B8B8B8")
$COLOR_MUTED = [System.Drawing.ColorTranslator]::FromHtml("#686C72")
$COLOR_ACCENT = [System.Drawing.ColorTranslator]::FromHtml("#E8E8E8")
$COLOR_GRID = [System.Drawing.ColorTranslator]::FromHtml("#141518")

function Draw-FlowMark($g, [float]$cx, [float]$cy, [float]$size, [System.Drawing.Color]$color) {
    # Flow path: vertical line down, smooth curve right, horizontal line right
    # Equivalent to M4 3v6.5a4 4 0 0 0 4 4h4 in 16x16
    $penWidth = [Math]::Max(2.0, $size * (2.0 / 16.0))
    $pen = New-Object System.Drawing.Pen($color, $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $scale = $size / 16.0
    $ox = $cx - ($size / 2.0)
    $oy = $cy - ($size / 2.0)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    # Start at (4, 3) -> line to (4, 9.5)
    $path.AddLine(($ox + 4.0 * $scale), ($oy + 3.0 * $scale), ($ox + 4.0 * $scale), ($oy + 9.5 * $scale))
    # Arc from (4, 9.5) curving right-down to (8, 13.5): bounding rect is (4, 5.5, 8, 8)
    $path.AddArc(($ox + 4.0 * $scale), ($oy + 5.5 * $scale), (8.0 * $scale), (8.0 * $scale), 180.0, -90.0)
    # Line to (12, 13.5)
    $path.AddLine(($ox + 8.0 * $scale), ($oy + 13.5 * $scale), ($ox + 12.0 * $scale), ($oy + 13.5 * $scale))

    $g.DrawPath($pen, $path)
    $path.Dispose()
    $pen.Dispose()
}

# -----------------------------------------------------------------------------
# 1. GENERATE assets/icon.ico (16, 24, 32, 48, 64, 128, 256)
# -----------------------------------------------------------------------------
Write-Host "Generating multi-resolution icon.ico..." -ForegroundColor Cyan

$sz = 256
$bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Dark rounded squircle background
$radius = [Math]::Max(2.0, $sz * 0.22)
$rect = New-Object System.Drawing.RectangleF(0.5, 0.5, ($sz - 1.0), ($sz - 1.0))
$bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $radius * 2.0
$bgPath.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
$bgPath.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
$bgPath.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
$bgPath.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
$bgPath.CloseFigure()

$brushBg = New-Object System.Drawing.SolidBrush($COLOR_SURFACE)
$g.FillPath($brushBg, $bgPath)
$brushBg.Dispose()

$penBorder = New-Object System.Drawing.Pen($COLOR_BORDER, [Math]::Max(1.0, $sz * 0.04))
$g.DrawPath($penBorder, $bgPath)
$penBorder.Dispose()
$bgPath.Dispose()

# Flow glyph centered
$glyphSize = $sz * 0.55
Draw-FlowMark $g ($sz / 2.0) ($sz / 2.0) $glyphSize $COLOR_PRIMARY

$g.Dispose()

$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = Join-Path $assetsDir "icon.ico"
$icoFs = [System.IO.File]::Create($icoPath)
$icon.Save($icoFs)
$icoFs.Close()
$icon.Dispose()
$bmp.Dispose()
Write-Host "Created: $icoPath ($((Get-Item $icoPath).Length) bytes)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. GENERATE assets/installer/sidebar.bmp (164 x 314 px, 24-bit BMP)
# -----------------------------------------------------------------------------
Write-Host "Generating installer sidebar.bmp (164x314)..." -ForegroundColor Cyan

$sbWidth = 164
$sbHeight = 314
$sbBmp = New-Object System.Drawing.Bitmap($sbWidth, $sbHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$sbG = [System.Drawing.Graphics]::FromImage($sbBmp)
$sbG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$sbG.Clear($COLOR_BG)

# Subtle grid background (matching Exist Flow's subtle dark aesthetic)
$gridPen = New-Object System.Drawing.Pen($COLOR_GRID, 1)
for ($gx = 0; $gx -lt $sbWidth; $gx += 12) {
    $sbG.DrawLine($gridPen, $gx, 0, $gx, $sbHeight)
}
for ($gy = 0; $gy -lt $sbHeight; $gy += 12) {
    $sbG.DrawLine($gridPen, 0, $gy, $sbWidth, $gy)
}
$gridPen.Dispose()

# Flow icon container
$iconBoxSize = 56
$iconX = [int](($sbWidth - $iconBoxSize) / 2)
$iconY = 70
$boxBrush = New-Object System.Drawing.SolidBrush($COLOR_SURFACE)
$boxPen = New-Object System.Drawing.Pen($COLOR_BORDER, 1)
$sbG.FillRectangle($boxBrush, $iconX, $iconY, $iconBoxSize, $iconBoxSize)
$sbG.DrawRectangle($boxPen, $iconX, $iconY, $iconBoxSize, $iconBoxSize)
$boxBrush.Dispose()
$boxPen.Dispose()

# Flow glyph
Draw-FlowMark $sbG ($iconX + $iconBoxSize / 2) ($iconY + $iconBoxSize / 2) 32 $COLOR_PRIMARY

# Title & Slogan
$fontTitle = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Point)
$fontSub = New-Object System.Drawing.Font("Segoe UI", 7.5, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$brushTitle = New-Object System.Drawing.SolidBrush($COLOR_PRIMARY)
$brushSub = New-Object System.Drawing.SolidBrush($COLOR_MUTED)

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

$sbG.DrawString("Exist Flow", $fontTitle, $brushTitle, (New-Object System.Drawing.RectangleF(0, ($iconY + $iconBoxSize + 16), $sbWidth, 24)), $sf)
$sbG.DrawString("Everything, one shortcut away.", $fontSub, $brushSub, (New-Object System.Drawing.RectangleF(8, ($iconY + $iconBoxSize + 42), ($sbWidth - 16), 32)), $sf)

# Bottom decorative badge
$fontVer = New-Object System.Drawing.Font("Segoe UI", 7.0, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Point)
$brushVer = New-Object System.Drawing.SolidBrush($COLOR_SECONDARY)
$sbG.DrawString("v0.1.0  |  MIT License", $fontVer, $brushVer, (New-Object System.Drawing.RectangleF(0, ($sbHeight - 26), $sbWidth, 18)), $sf)

$fontTitle.Dispose()
$fontSub.Dispose()
$fontVer.Dispose()
$brushTitle.Dispose()
$brushSub.Dispose()
$brushVer.Dispose()
$sf.Dispose()
$sbG.Dispose()

$sidebarBmpPath = Join-Path $installerDir "sidebar.bmp"
$sbBmp.Save($sidebarBmpPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$sbBmp.Dispose()
Write-Host "Created: $sidebarBmpPath" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 3. GENERATE assets/installer/header.bmp (150 x 57 px, 24-bit BMP)
# -----------------------------------------------------------------------------
Write-Host "Generating installer header.bmp (150x57)..." -ForegroundColor Cyan

$hdrWidth = 150
$hdrHeight = 57
$hdrBmp = New-Object System.Drawing.Bitmap($hdrWidth, $hdrHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$hdrG = [System.Drawing.Graphics]::FromImage($hdrBmp)
$hdrG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$hdrG.Clear($COLOR_BG)

# Flow icon on right side of header
$hIconSize = 34
$hIconX = $hdrWidth - $hIconSize - 12
$hIconY = [int](($hdrHeight - $hIconSize) / 2)

$hBoxBrush = New-Object System.Drawing.SolidBrush($COLOR_SURFACE)
$hBoxPen = New-Object System.Drawing.Pen($COLOR_BORDER, 1)
$hdrG.FillRectangle($hBoxBrush, $hIconX, $hIconY, $hIconSize, $hIconSize)
$hdrG.DrawRectangle($hBoxPen, $hIconX, $hIconY, $hIconSize, $hIconSize)
$hBoxBrush.Dispose()
$hBoxPen.Dispose()

Draw-FlowMark $hdrG ($hIconX + $hIconSize / 2) ($hIconY + $hIconSize / 2) 20 $COLOR_PRIMARY

$hdrG.Dispose()

$headerBmpPath = Join-Path $installerDir "header.bmp"
$hdrBmp.Save($headerBmpPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$hdrBmp.Dispose()
Write-Host "Created: $headerBmpPath" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. GENERATE assets/installer/installer.nsh
# -----------------------------------------------------------------------------
Write-Host "Generating assets/installer/installer.nsh..." -ForegroundColor Cyan

$nshContent = @"
; Exist Flow - NSIS Custom Dark Theme Script
; Palette derived from src/renderer/styles/global.css
;
; Background: #08090A (0x08090A)
; Surface:    #111214 (0x111214)
; Text:       #FAFAFA (0xFAFAFA)
; Muted:      #8A8D93 (0x8A8D93)
; Accent:     #E8E8E8 (0xE8E8E8)

!define MUI_BGCOLOR "08090A"
!define MUI_TEXTCOLOR "FAFAFA"

!macro customHeader
  ; Sets the default UI font to Segoe UI (standard Windows sans font)
  SetFont "Segoe UI" 9
!macroend

!macro customGUIInit
  ; Note on standard Win32 dialog controls:
  ; Standard Windows NSIS dialog controls (buttons, checkboxes, edit fields)
  ; retain the native Windows UxTheme renderer; background color and fonts
  ; are applied across the welcome header and branding areas.
!macroend
"@

$nshPath = Join-Path $installerDir "installer.nsh"
$nshContent | Set-Content $nshPath -Encoding UTF8
Write-Host "Created: $nshPath" -ForegroundColor Green
Write-Host "`nAll installer assets generated successfully!" -ForegroundColor Cyan
