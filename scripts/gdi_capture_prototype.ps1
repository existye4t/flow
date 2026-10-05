# scripts/gdi_capture_prototype.ps1
# GDI BitBlt Standalone Capture Prototype & Latency Measurement

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class GdiCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(
        IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight,
        IntPtr hdcSrc, int nXSrc, int nYSrc, int dwRop
    );

    private const int SRCCOPY = 0x00CC0020;

    public struct CaptureTiming {
        public double BlitMs;
        public double SaveMs;
        public double TotalMs;
        public int Width;
        public int Height;
        public string FilePath;
    }

    public static CaptureTiming CaptureScreen(int x, int y, int width, int height, string outputPath) {
        var sw = new Stopwatch();
        var timing = new CaptureTiming();
        timing.Width = width;
        timing.Height = height;
        timing.FilePath = outputPath;

        sw.Restart();
        IntPtr hdcSrc = GetDC(IntPtr.Zero);
        IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, width, height);
        IntPtr hOld = SelectObject(hdcDest, hBitmap);

        BitBlt(hdcDest, 0, 0, width, height, hdcSrc, x, y, SRCCOPY);

        SelectObject(hdcDest, hOld);
        DeleteDC(hdcDest);
        ReleaseDC(IntPtr.Zero, hdcSrc);
        sw.Stop();
        timing.BlitMs = sw.Elapsed.TotalMilliseconds;

        sw.Restart();
        using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
            bmp.Save(outputPath, ImageFormat.Png);
        }
        DeleteObject(hBitmap);
        sw.Stop();
        timing.SaveMs = sw.Elapsed.TotalMilliseconds;

        timing.TotalMs = timing.BlitMs + timing.SaveMs;
        return timing;
    }
}
"@ -ReferencedAssemblies "System.Drawing.dll"

$outDir = Join-Path $PSScriptRoot "out"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

function Run-Benchmark([string]$name, [int]$x, [int]$y, [int]$width, [int]$height, [int]$runs) {
    Write-Host "`n=======================================================" -ForegroundColor Cyan
    Write-Host "BENCHMARK: $name (Offset: X=$x, Y=$y, Size=${width}x${height})" -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan

    $blitTimes = @()
    $saveTimes = @()
    $totalTimes = @()
    $lastPath = ""

    for ($i = 1; $i -le $runs; $i++) {
        $outFile = Join-Path $outDir "gdi_${name}_run${i}.png"
        $t = [GdiCapture]::CaptureScreen($x, $y, $width, $height, $outFile)
        $blitTimes += $t.BlitMs
        $saveTimes += $t.SaveMs
        $totalTimes += $t.TotalMs
        $lastPath = $outFile
        Write-Host "  Run #${i}: BitBlt=$([Math]::Round($t.BlitMs, 2))ms | Save(PNG)=$([Math]::Round($t.SaveMs, 2))ms | Total=$([Math]::Round($t.TotalMs, 2))ms"
        Start-Sleep -Milliseconds 100
    }

    $sortedBlit = $blitTimes | Sort-Object
    $sortedSave = $saveTimes | Sort-Object
    $sortedTotal = $totalTimes | Sort-Object

    $mid = [Math]::Floor($runs / 2)

    [PSCustomObject]@{
        Target      = $name
        Runs        = $runs
        BlitMinMs   = [Math]::Round($sortedBlit[0], 2)
        BlitP50Ms   = [Math]::Round($sortedBlit[$mid], 2)
        BlitMaxMs   = [Math]::Round($sortedBlit[-1], 2)
        SaveMinMs   = [Math]::Round($sortedSave[0], 2)
        SaveP50Ms   = [Math]::Round($sortedSave[$mid], 2)
        SaveMaxMs   = [Math]::Round($sortedSave[-1], 2)
        TotalMinMs  = [Math]::Round($sortedTotal[0], 2)
        TotalP50Ms  = [Math]::Round($sortedTotal[$mid], 2)
        TotalMaxMs  = [Math]::Round($sortedTotal[-1], 2)
        SampleFile  = $lastPath
    }
}

# 1. Primary Display (Display 0: 0, 0, 1920, 1080)
$primaryStats = Run-Benchmark -name "display0_primary" -x 0 -y 0 -width 1920 -height 1080 -runs 5

# 2. Secondary Display (Display 1: 1920, 0, 1920, 1080)
$secondaryStats = Run-Benchmark -name "display1_secondary" -x 1920 -y 0 -width 1920 -height 1080 -runs 5

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "SUMMARY: GDI BitBlt Performance (5 Runs Each)" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green

$results = @($primaryStats, $secondaryStats)
$results | Format-Table Target, BlitMinMs, BlitP50Ms, BlitMaxMs, SaveP50Ms, TotalP50Ms, SampleFile -AutoSize

# Export JSON report
$jsonReport = Join-Path $outDir "gdi_benchmark_results.json"
$results | ConvertTo-Json -Depth 4 | Set-Content $jsonReport
Write-Host "Report saved to: $jsonReport" -ForegroundColor Yellow
