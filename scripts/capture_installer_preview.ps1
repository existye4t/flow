# scripts/capture_installer_preview.ps1
# Launches the NSIS installer, captures its window screenshot, and saves to assets/installer-preview.png

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class Win32Gui {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBmp, uint nFlags);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static IntPtr FindInstallerWindow() {
        IntPtr result = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.IndexOf("Exist Flow", StringComparison.OrdinalIgnoreCase) >= 0) {
                    RECT r;
                    GetWindowRect(hWnd, out r);
                    if ((r.Right - r.Left) > 200 && (r.Bottom - r.Top) > 200) {
                        result = hWnd;
                        return false; // Stop enumerating
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
"@

$installerPath = Join-Path $PSScriptRoot "..\release\Exist Flow Setup 0.1.0.exe"
$outPreview = Join-Path $PSScriptRoot "..\assets\installer-preview.png"

if (-not (Test-Path $installerPath)) {
    Write-Error "Installer not found at: $installerPath"
}

Write-Host "Launching installer: $installerPath..." -ForegroundColor Cyan
$p = Start-Process -FilePath $installerPath -PassThru

try {
    # Poll for window using EnumWindows
    $hWnd = [IntPtr]::Zero
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        $hWnd = [Win32Gui]::FindInstallerWindow()
        if ($hWnd -ne [IntPtr]::Zero) {
            break
        }
    }

    if ($hWnd -eq [IntPtr]::Zero) {
        Write-Error "Could not find visible installer dialog window within timeout."
    }

    Write-Host "Found installer window handle: $hWnd" -ForegroundColor Green
    [Win32Gui]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 1000

    $rect = New-Object Win32Gui+RECT
    [Win32Gui]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top

    Write-Host "Capturing window bounds: X=$($rect.Left), Y=$($rect.Top), Size=${w}x${h}..." -ForegroundColor Cyan

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    $ok = [Win32Gui]::PrintWindow($hWnd, $hdc, 2)
    if (-not $ok) {
        $ok = [Win32Gui]::PrintWindow($hWnd, $hdc, 0)
    }
    $g.ReleaseHdc($hdc)
    $g.Dispose()

    $bmp.Save($outPreview, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Saved installer preview to: $outPreview" -ForegroundColor Green
} finally {
    Write-Host "Terminating installer process..." -ForegroundColor Cyan
    try {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*Exist Flow Setup*" } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}
