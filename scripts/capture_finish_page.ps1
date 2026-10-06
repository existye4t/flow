# scripts/capture_finish_page.ps1
# Automates NSIS installer to reach the finish page, captures screenshot to assets/installer-finish.png

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class Win32Finish {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBmp, uint nFlags);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDlgItem(IntPtr hDlg, int nIDDlgItem);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowEnabled(IntPtr hWnd);

    public const uint BM_CLICK = 0x00F5;
    public const uint BM_SETCHECK = 0x00F1;
    public const uint BST_UNCHECKED = 0x0000;
    public const uint WM_CLOSE = 0x0010;

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
                    if ((r.Right - r.Left) > 300 && (r.Bottom - r.Top) > 200) {
                        result = hWnd;
                        return false;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return result;
    }

    public static List<IntPtr> GetChildWindows(IntPtr parent) {
        List<IntPtr> children = new List<IntPtr>();
        EnumChildWindows(parent, (hWnd, lParam) => {
            children.Add(hWnd);
            return true;
        }, IntPtr.Zero);
        return children;
    }

    public static string GetText(IntPtr hWnd) {
        StringBuilder sb = new StringBuilder(512);
        GetWindowText(hWnd, sb, 512);
        return sb.ToString();
    }
}
"@

$installerPath = Join-Path $PSScriptRoot "..\release\Exist Flow Setup 0.1.1.exe"
if (-not (Test-Path $installerPath)) {
    $installerPath = Join-Path $PSScriptRoot "..\release\Exist Flow Setup 0.1.0.exe"
}

if (-not (Test-Path $installerPath)) {
    Write-Error "Installer binary not found in release/"
}

Write-Host "Launching installer: $installerPath" -ForegroundColor Cyan
$proc = Start-Process -FilePath $installerPath -PassThru

try {
    # 1. Wait for installer window
    $hWnd = [IntPtr]::Zero
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        $hWnd = [Win32Finish]::FindInstallerWindow()
        if ($hWnd -ne [IntPtr]::Zero) { break }
    }

    if ($hWnd -eq [IntPtr]::Zero) {
        throw "Could not find installer window"
    }

    Write-Host "Found installer window: $hWnd" -ForegroundColor Green
    [Win32Finish]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 600

    # 2. Wizard advancement loop
    Write-Host "Advancing through installer wizard..." -ForegroundColor Cyan
    $finishFound = $false
    for ($i = 0; $i -lt 120; $i++) {
        Start-Sleep -Milliseconds 500
        $btn1 = [Win32Finish]::GetDlgItem($hWnd, 1)
        $btnText = [Win32Finish]::GetText($btn1)
        
        # Check all child windows to see if finish page or checkbox appears
        $children = [Win32Finish]::GetChildWindows($hWnd)
        $texts = @()
        $hasRunCheckbox = $false
        foreach ($child in $children) {
            $childText = [Win32Finish]::GetText($child)
            if ($childText.Trim().Length -gt 0) {
                $texts += $childText
            }
            if ($childText -match "(?i)(al.*t.*r|çalıştır|run|Bitir|Finish)") {
                $hasRunCheckbox = $true
            }
        }

        $btn1Enabled = [Win32Finish]::IsWindowEnabled($btn1)
        Write-Host "Poll [$i] Btn1='$btnText' (Enabled=$btn1Enabled) | FinishDetected=$hasRunCheckbox | Texts: $($texts -join ' | ')" -ForegroundColor DarkGray

        if ($hasRunCheckbox -or ($btnText -match "(?i)(Bitir|Finish)")) {
            Write-Host "Finish page detected! (Btn1='$btnText', hasRunCheckbox=$hasRunCheckbox)" -ForegroundColor Green
            $finishFound = $true
            break
        }

        # If button 1 is enabled and not finish page, click it to advance wizard
        if ($btn1Enabled) {
            Write-Host "Clicking '$btnText' to advance..." -ForegroundColor Yellow
            [Win32Finish]::SendMessage($btn1, [Win32Finish]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
            Start-Sleep -Milliseconds 1200
        }
    }

    if (-not $finishFound) {
        throw "Failed to reach Finish page within timeout."
    }

    Write-Host "Finish page active. Waiting 1.5s for GDI rendering..." -ForegroundColor Green
    Start-Sleep -Milliseconds 1500
    [Win32Finish]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 500

    # 4. Capture screenshot of the Finish Page using PrintWindow
    $rect = New-Object Win32Finish+RECT
    [Win32Finish]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top

    Write-Host "Capturing Finish Page window: ${w}x${h} at ($($rect.Left), $($rect.Top))..." -ForegroundColor Cyan

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()

    $ok = [Win32Finish]::PrintWindow($hWnd, $hdc, 2)
    if (-not $ok) {
        $ok = [Win32Finish]::PrintWindow($hWnd, $hdc, 0)
    }
    $g.ReleaseHdc($hdc)
    $g.Dispose()

    $assetsDir = Join-Path $PSScriptRoot "..\assets"
    if (-not (Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir -Force }
    $outPath = Join-Path $assetsDir "installer-finish.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved Finish Page screenshot to $outPath" -ForegroundColor Green

    # Also save to artifact directory
    $artifactBrainDir = "C:\Users\Exist\.gemini\antigravity-ide\brain\1b6ee9c5-0f92-408f-84ba-afbd9c1a5360"
    if (Test-Path $artifactBrainDir) {
        $brainPath = Join-Path $artifactBrainDir "installer-finish.png"
        $bmp.Save($brainPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Saved Finish Page screenshot to artifact dir: $brainPath" -ForegroundColor Green
    }

    $bmp.Dispose()

    # 5. Uncheck run checkbox so we don't start app unexpectedly, then close installer
    $children = [Win32Finish]::GetChildWindows($hWnd)
    foreach ($child in $children) {
        $childText = [Win32Finish]::GetText($child)
        if ($childText -match "çalıştır|run") {
            # Uncheck
            [Win32Finish]::SendMessage($child, [Win32Finish]::BM_SETCHECK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
        }
    }

    # Click Finish button (btn1)
    [Win32Finish]::SendMessage($btn1, [Win32Finish]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
    Start-Sleep -Milliseconds 600

} finally {
    # Ensure process is closed
    if ($proc -and -not $proc.HasExited) {
        try {
            $proc.Kill()
        } catch {}
    }
    # Also clean up any lingering installer processes
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*Exist Flow Setup*" } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Done capture_finish_page." -ForegroundColor Green
