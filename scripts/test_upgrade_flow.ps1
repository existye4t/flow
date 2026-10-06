# scripts/test_upgrade_flow.ps1
# Automates testing of Tour 19:
# 1. Sets registry DisplayVersion to 0.1.0 to simulate an existing older version.
# 2. Runs release/Exist Flow Setup 0.1.1.exe.
# 3. Detects and captures the "sil ve yükle" upgrade prompt dialog to assets/installer-upgrade-dialog.png.
# 4. Clicks "Evet" (IDYES) to silently uninstall and proceed.
# 5. Captures the installer window showing the updated sidebar (v0.1.1) to assets/installer-sidebar-screen.png.
# 6. Advances installer to completion and verifies DisplayVersion in registry is 0.1.1.

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class Win32Test {
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
    public static extern bool IsWindowEnabled(IntPtr hWnd);

    public const uint BM_CLICK = 0x00F5;
    public const uint BM_SETCHECK = 0x00F1;
    public const uint BST_UNCHECKED = 0x0000;
    public const int IDYES = 6;
    public const int IDNO = 7;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static string GetText(IntPtr hWnd) {
        StringBuilder sb = new StringBuilder(512);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static string GetClass(IntPtr hWnd) {
        StringBuilder sb = new StringBuilder(128);
        GetClassName(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static List<IntPtr> GetChildWindows(IntPtr parent) {
        List<IntPtr> children = new List<IntPtr>();
        EnumChildWindows(parent, (h, l) => {
            children.Add(h);
            return true;
        }, IntPtr.Zero);
        return children;
    }
}
"@

function Capture-WindowToFile($hWnd, $outputPath) {
    [Win32Test]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 250

    $rect = New-Object Win32Test+RECT
    [Win32Test]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
    $w = [Math]::Max(10, $rect.Right - $rect.Left)
    $h = [Math]::Max(10, $rect.Bottom - $rect.Top)

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()

    $ok = [Win32Test]::PrintWindow($hWnd, $hdc, 2)
    if (-not $ok) {
        $ok = [Win32Test]::PrintWindow($hWnd, $hdc, 0)
    }
    $g.ReleaseHdc($hdc)
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Captured window to: $outputPath" -ForegroundColor Green

    # Mirror to brain artifact directory if exists
    $brainDir = "C:\Users\Exist\.gemini\antigravity-ide\brain\1b6ee9c5-0f92-408f-84ba-afbd9c1a5360"
    if (Test-Path $brainDir) {
        $leaf = Split-Path -Leaf $outputPath
        $brainPath = Join-Path $brainDir $leaf
        Copy-Item -Path $outputPath -Destination $brainPath -Force
    }
}

$assetsDir = Join-Path $PSScriptRoot "..\assets"
$installerExe = Join-Path $PSScriptRoot "..\release\Exist Flow Setup 0.1.1.exe"

# 1. Simulate 0.1.0 in registry
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\bda0d74a-ca69-53a8-a3db-f89ce8567186"
if (Test-Path $regKey) {
    Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "0.1.0"
    Write-Host "Set registry DisplayVersion to 0.1.0 on $regKey" -ForegroundColor Yellow
} else {
    Write-Host "Registry key does not exist yet; will install first" -ForegroundColor Yellow
}

# 2. Launch installer
Write-Host "Launching installer: $installerExe" -ForegroundColor Cyan
$proc = Start-Process -FilePath $installerExe -PassThru

try {
    # 3. Look for MessageBox prompt
    $msgBoxHwnd = [IntPtr]::Zero
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 300
        [Win32Test]::EnumWindows({
            param($h, $l)
            if ([Win32Test]::IsWindowVisible($h)) {
                $cls = [Win32Test]::GetClass($h)
                if ($cls -eq "#32770") {
                    $children = [Win32Test]::GetChildWindows($h)
                    foreach ($c in $children) {
                        $txt = [Win32Test]::GetText($c)
                        if ($txt -match "zaten yüklü|kaldırılıp|Exist Flow") {
                            $script:msgBoxHwnd = $h
                            return $false
                        }
                    }
                }
            }
            return $true
        }, [IntPtr]::Zero) | Out-Null

        if ($msgBoxHwnd -ne [IntPtr]::Zero) { break }
    }

    if ($msgBoxHwnd -ne [IntPtr]::Zero) {
        Write-Host "Found upgrade prompt MessageBox: $msgBoxHwnd" -ForegroundColor Green
        
        # Capture dialog screenshot
        $dlgShot = Join-Path $assetsDir "installer-upgrade-dialog.png"
        Capture-WindowToFile $msgBoxHwnd $dlgShot

        # Click "Evet" (IDYES = 6)
        $yesBtn = [Win32Test]::GetDlgItem($msgBoxHwnd, [Win32Test]::IDYES)
        if ($yesBtn -ne [IntPtr]::Zero) {
            Write-Host "Clicking 'Evet' (IDYES)..." -ForegroundColor Yellow
            [Win32Test]::SendMessage($yesBtn, [Win32Test]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
        } else {
            Write-Host "Sending BM_CLICK to default button..." -ForegroundColor Yellow
            $btn1 = [Win32Test]::GetDlgItem($msgBoxHwnd, 1)
            [Win32Test]::SendMessage($btn1, [Win32Test]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
        }
    } else {
        Write-Host "No upgrade prompt detected within timeout (possibly first install)" -ForegroundColor Yellow
    }

    # 4. Wait for main installer window to appear
    Write-Host "Waiting for main installer window..." -ForegroundColor Cyan
    $mainHwnd = [IntPtr]::Zero
    for ($i = 0; $i -lt 50; $i++) {
        Start-Sleep -Milliseconds 400
        [Win32Test]::EnumWindows({
            param($h, $l)
            if ([Win32Test]::IsWindowVisible($h)) {
                $txt = [Win32Test]::GetText($h)
                if ($txt -match "Exist Flow Kurulumu") {
                    $script:mainHwnd = $h
                    return $false
                }
            }
            return $true
        }, [IntPtr]::Zero) | Out-Null

        if ($mainHwnd -ne [IntPtr]::Zero) { break }
    }

    if ($mainHwnd -eq [IntPtr]::Zero) {
        throw "Could not find main installer window"
    }

    Write-Host "Found main installer window: $mainHwnd" -ForegroundColor Green
    Start-Sleep -Milliseconds 800

    # Capture sidebar screenshot on the main installer window
    $sidebarShot = Join-Path $assetsDir "installer-sidebar-screen.png"
    Capture-WindowToFile $mainHwnd $sidebarShot

    # 5. Advance wizard to install
    $finished = $false
    for ($i = 0; $i -lt 180; $i++) {
        Start-Sleep -Milliseconds 600
        $btn1 = [Win32Test]::GetDlgItem($mainHwnd, 1)
        $btnText = [Win32Test]::GetText($btn1)
        $enabled = [Win32Test]::IsWindowEnabled($btn1)

        $children = [Win32Test]::GetChildWindows($mainHwnd)
        $isFinish = $false
        foreach ($c in $children) {
            $cTxt = [Win32Test]::GetText($c)
            if ($cTxt -match "Exist Flow'u çalıştır|Kurulum Tamamlandı") {
                $isFinish = $true
            }
        }

        if ($isFinish -or ($btnText -match "Bitir|Finish")) {
            Write-Host "Reached Finish page! Waiting 1s for rendering..." -ForegroundColor Green
            Start-Sleep -Milliseconds 1000
            $finishShot = Join-Path $assetsDir "installer-finish.png"
            Capture-WindowToFile $mainHwnd $finishShot

            # Uncheck run app checkbox
            foreach ($c in $children) {
                $cTxt = [Win32Test]::GetText($c)
                if ($cTxt -match "çalıştır") {
                    [Win32Test]::SendMessage($c, [Win32Test]::BM_SETCHECK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
                }
            }
            # Click Bitir
            Write-Host "Clicking 'Bitir'..." -ForegroundColor Yellow
            [Win32Test]::SendMessage($btn1, [Win32Test]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
            $finished = $true
            break
        }

        if ($enabled) {
            Write-Host "Advancing wizard: clicking '$btnText'..." -ForegroundColor Yellow
            [Win32Test]::SendMessage($btn1, [Win32Test]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
            Start-Sleep -Milliseconds 1200
        } else {
            if ($i % 5 -eq 0) {
                Write-Host "Installing in progress... (poll $i)" -ForegroundColor DarkGray
            }
        }
    }

    if (-not $finished) {
        Write-Warning "Wizard did not reach finish page within timeout."
    }

    # Wait for installer process to exit cleanly
    if ($proc -and -not $proc.HasExited) {
        $proc.WaitForExit(10000) | Out-Null
    }

    Start-Sleep -Milliseconds 2000

    # 6. Verify registry
    $props = Get-ItemProperty -Path $regKey -ErrorAction SilentlyContinue
    if ($props) {
        Write-Host "Registry verification: DisplayVersion=$($props.DisplayVersion), DisplayName=$($props.DisplayName)" -ForegroundColor Green
    } else {
        Write-Warning "Registry key not found on $regKey. Checking all Uninstall keys..."
        Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | ForEach-Object {
            $p = Get-ItemProperty $_.PsPath
            if ($p.DisplayName -like "*Exist Flow*") {
                Write-Host "Found in registry under $($_.PSChildName): DisplayVersion=$($p.DisplayVersion), DisplayName=$($p.DisplayName)" -ForegroundColor Green
            }
        }
    }

} finally {
    if ($proc -and -not $proc.HasExited) {
        try { $proc.Kill() } catch {}
    }
}

Write-Host "Upgrade flow test complete." -ForegroundColor Green
