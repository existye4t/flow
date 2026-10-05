import { app, BrowserWindow, globalShortcut, ipcMain, shell, net, screen, desktopCapturer, nativeImage, dialog, Menu, Tray } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import Store from 'electron-store'
import { Buffer } from 'buffer'
import { toAccelerator } from './shortcuts'

// Prevent Chromium Skia D3D11 rounded rect / vector path shader crash (0xC0000409) on Windows/NVIDIA drivers.
// GPU compositing, DirectComposition, window blits, transparent frame, canvas 2D, and animations remain fully hardware-accelerated.
app.commandLine.appendSwitch('disable-gpu-rasterization')

// Controlled crash & error protection: never allow background tasks to take down Electron
process.on('uncaughtException', (err) => {
  console.error('[Lifecycle] Controlled uncaughtException:', err?.message || err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Lifecycle] Controlled unhandledRejection:', reason)
})

const store = new Store({ name: 'exist-flow' })

// 32x32 monochrome Flow mark (generated asset, transparent background)
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA50lEQVR42u3XMQqDQBBAUascI6RNaWlp7wEsLZaAt8gpvIRFLuAxgo2tQu5g8aMwgoquFnGEsAPT7Bb7nNmF0QO8M9NzAMumDySSvjagPzADKsnsKMTaRiIHD1HJmhrgATQjQCNrDuAADuAADuAAagDTZT0CfIBUExAD5QjQdutP4KIFCIGCaeRAoAW4yhTErA19FW5aM6GZtaGPtyCCX7XDtnlfqMJQiVwgqbwOW1qH2i1hBLxYjlYwzUZah9o9ZYotiL2xOtTu7VUkX1GeBRjuhBFIIZhaowVLTzSU1pijL+H//5x+AeUAoCuXbhUlAAAAAElFTkSuQmCC'

function getSetting<T>(key: string, fallback: T): T {
  const settings = (store.get('settings') as Record<string, unknown> | undefined) || {}
  const value = settings[key]
  return value === undefined ? fallback : (value as T)
}

const ICON_CACHE = new Map<string, string>()
const NEGATIVE_ICON_CACHE = new Set<string>()
const startMenuLnkMap = new Map<string, string>()

let iconCacheDir = ''
let negativeCacheFile = ''
let discoveredAppsCacheFile = ''

// Clean up legacy conflicting cache paths inside userData/cache so Chromium's
// internal HTTP & GPU Cache_Data is never corrupted by custom files.
function cleanupLegacyConflictingCache(): void {
  try {
    const oldCacheDir = path.join(app.getPath('userData'), 'cache')
    if (fs.existsSync(oldCacheDir)) {
      const oldIcons = path.join(oldCacheDir, 'app-icons')
      if (fs.existsSync(oldIcons)) {
        try { fs.rmSync(oldIcons, { recursive: true, force: true }) } catch {}
      }
      const oldNeg = path.join(oldCacheDir, 'negative-icons.json')
      if (fs.existsSync(oldNeg)) {
        try { fs.unlinkSync(oldNeg) } catch {}
      }
      const oldDisc = path.join(oldCacheDir, 'discovered-apps.json')
      if (fs.existsSync(oldDisc)) {
        try { fs.unlinkSync(oldDisc) } catch {}
      }
    }
  } catch {}
}

function getIconCacheDir(): string {
  if (!iconCacheDir) {
    try {
      // Must NOT use 'cache' because Chromium reserves userData/Cache for HTTP & GPU caches
      iconCacheDir = path.join(app.getPath('userData'), 'flow_icon_cache', 'icons')
      if (!fs.existsSync(iconCacheDir)) {
        fs.mkdirSync(iconCacheDir, { recursive: true })
      }
    } catch {}
  }
  return iconCacheDir
}

function getNegativeCacheFile(): string {
  if (!negativeCacheFile) {
    try {
      negativeCacheFile = path.join(app.getPath('userData'), 'flow_icon_cache', 'negative-icons.json')
      const dir = path.dirname(negativeCacheFile)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    } catch {}
  }
  return negativeCacheFile
}

function getDiscoveredAppsCacheFile(): string {
  if (!discoveredAppsCacheFile) {
    try {
      discoveredAppsCacheFile = path.join(app.getPath('userData'), 'flow_icon_cache', 'discovered-apps.json')
      const dir = path.dirname(discoveredAppsCacheFile)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    } catch {}
  }
  return discoveredAppsCacheFile
}

function loadNegativeCacheFromDisk(): void {
  try {
    const file = getNegativeCacheFile()
    if (file && fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(data)) {
        for (const k of data) NEGATIVE_ICON_CACHE.add(String(k))
      }
    }
  } catch {}
}

let saveNegativeCacheTimer: NodeJS.Timeout | null = null
function saveNegativeCacheToDisk(): void {
  if (saveNegativeCacheTimer) return
  saveNegativeCacheTimer = setTimeout(() => {
    saveNegativeCacheTimer = null
    try {
      const file = getNegativeCacheFile()
      if (!file) return
      const dir = path.dirname(file)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(Array.from(NEGATIVE_ICON_CACHE)), 'utf8')
    } catch {}
  }, 2000)
}

function getDiskCachePath(key: string): string {
  const dir = getIconCacheDir()
  const hash = crypto.createHash('sha1').update(key.toLowerCase().trim()).digest('hex')
  return path.join(dir, `${hash}.png`)
}

/**
 * Windows Shell returns a generic blank shortcut icon (white sheet with blue arrow)
 * when SHGetFileInfo fails to resolve a link target. This icon must NEVER be accepted or cached.
 */
function isGenericShortcutIcon(bufferOrDataUrl: Buffer | string): boolean {
  if (typeof bufferOrDataUrl === 'string') {
    if (bufferOrDataUrl.length < 200) return true
    if (bufferOrDataUrl.includes('AAAB4UlEQVRYhe2WSy8DURTH')) return true
    if (bufferOrDataUrl.includes('AAAB5UlEQVRYhe')) return true
    if (bufferOrDataUrl.includes('AAAByUlEQVRYhe1WQUoDQRCs2UTwEBS8R')) return true
    if (bufferOrDataUrl.includes('Ah9JREFUWEftV8lOAkEQ')) return true
    return false
  }
  if (bufferOrDataUrl.length < 150) return true
  const base64 = bufferOrDataUrl.toString('base64')
  if (base64.includes('AAAB4UlEQVRYhe2WSy8DURTH')) return true
  if (base64.includes('AAAB5UlEQVRYhe')) return true
  if (base64.includes('AAAByUlEQVRYhe1WQUoDQRCs2UTwEBS8R')) return true
  if (base64.includes('Ah9JREFUWEftV8lOAkEQ')) return true
  return false
}

function isValidIconBuffer(buffer: Buffer): boolean {
  if (buffer.length < 100 || isGenericShortcutIcon(buffer)) return false
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  const isIco = buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00
  return isPng || isIco
}

function setIconCache(key: string, dataUrl: string): void {
  if (!dataUrl || isGenericShortcutIcon(dataUrl)) return
  const normKey = key.toLowerCase().trim()
  ICON_CACHE.set(normKey, dataUrl)
  try {
    const filePath = getDiskCachePath(normKey)
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    if (isValidIconBuffer(buffer)) {
      fs.writeFile(filePath, buffer, () => {})
    }
  } catch {}
}

function getIconCache(key: string): string | undefined {
  const normKey = key.toLowerCase().trim()
  const mem = ICON_CACHE.get(normKey)
  if (mem) {
    if (isGenericShortcutIcon(mem)) {
      ICON_CACHE.delete(normKey)
    } else {
      return mem
    }
  }

  try {
    const filePath = getDiskCachePath(normKey)
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath)
      if (isValidIconBuffer(buffer)) {
        const isIco = buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00
        const mime = isIco ? 'image/x-icon' : 'image/png'
        const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`
        ICON_CACHE.set(normKey, dataUrl)
        return dataUrl
      } else {
        try { fs.unlinkSync(filePath) } catch {}
      }
    }
  } catch {}

  return undefined
}

/**
 * Fast, pure JavaScript binary parser for Windows Shell Link (.lnk) files.
 * Reads the LinkInfo structure to obtain the target executable path in 0.01ms.
 * Bypasses Electron's shell.readShortcutLink which triggers Chromium NOTREACHED()
 * assertions on modern Windows AUMID/MSI shortcuts.
 */
function readLnkTarget(lnkPath: string): string | null {
  try {
    const buf = fs.readFileSync(lnkPath)
    if (buf.length < 76 || buf.readUInt32LE(0) !== 0x0000004c) return null
    const flags = buf.readUInt32LE(0x14)
    const hasLinkTargetIDList = (flags & 0x01) !== 0
    const hasLinkInfo = (flags & 0x02) !== 0

    let offset = 76
    if (hasLinkTargetIDList) {
      if (offset + 2 > buf.length) return null
      const idListSize = buf.readUInt16LE(offset)
      offset += 2 + idListSize
    }

    if (hasLinkInfo) {
      if (offset + 4 > buf.length) return null
      const linkInfoSize = buf.readUInt32LE(offset)
      if (offset + linkInfoSize > buf.length) return null
      const linkInfoBuf = buf.subarray(offset, offset + linkInfoSize)

      const localBasePathOffset = linkInfoBuf.readUInt32LE(0x10)
      if (localBasePathOffset > 0 && localBasePathOffset < linkInfoBuf.length) {
        let end = localBasePathOffset
        while (end < linkInfoBuf.length && linkInfoBuf[end] !== 0) end++
        const target = linkInfoBuf.subarray(localBasePathOffset, end).toString('utf8')
        if (target && target.length > 2 && target[1] === ':') {
          return target
        }
      }

      // Check Unicode LocalBasePath if present (header size >= 36)
      if (linkInfoBuf.length >= 0x24) {
        const linkInfoHeaderSize = linkInfoBuf.readUInt32LE(0x04)
        if (linkInfoHeaderSize >= 0x24 && linkInfoBuf.length >= 0x20) {
          const unicodeOffset = linkInfoBuf.readUInt32LE(0x1c)
          if (unicodeOffset > 0 && unicodeOffset < linkInfoBuf.length) {
            let end = unicodeOffset
            while (end + 1 < linkInfoBuf.length && !(linkInfoBuf[end] === 0 && linkInfoBuf[end + 1] === 0)) end += 2
            const target = linkInfoBuf.subarray(unicodeOffset, end).toString('utf16le')
            if (target && target.length > 2 && target[1] === ':') {
              return target
            }
          }
        }
      }
    }
  } catch {}
  return null
}

function readVisualElementsManifest(filePathOrDir: string): string | null {
  try {
    if (!filePathOrDir) return null
    let dir = filePathOrDir
    let base = ''
    try {
      const st = fs.statSync(filePathOrDir)
      if (st.isDirectory()) {
        dir = filePathOrDir
      } else {
        dir = path.dirname(filePathOrDir)
        base = path.basename(filePathOrDir, path.extname(filePathOrDir))
      }
    } catch {
      dir = path.dirname(filePathOrDir)
      base = path.basename(filePathOrDir, path.extname(filePathOrDir))
    }

    if (!fs.existsSync(dir)) return null

    const manifestPaths: string[] = []
    if (base) {
      manifestPaths.push(path.join(dir, `${base}.VisualElementsManifest.xml`))
    }
    try {
      const files = fs.readdirSync(dir)
      for (const f of files) {
        if (f.toLowerCase().endsWith('.visualelementsmanifest.xml')) {
          const full = path.join(dir, f)
          if (!manifestPaths.includes(full)) manifestPaths.push(full)
        }
      }
    } catch {}

    for (const mf of manifestPaths) {
      if (fs.existsSync(mf)) {
        const xml = fs.readFileSync(mf, 'utf8')
        // Match word boundary to avoid matching ShowNameOnSquare150x150Logo="on"
        const match = xml.match(/\bSquare(?:150x150|70x70|44x44)Logo=["']([^"']+)["']/i)
        if (match && match[1]) {
          const rel = match[1].replace(/\\/g, path.sep)
          const iconPath = path.resolve(dir, rel)
          if (fs.existsSync(iconPath)) {
            const buf = fs.readFileSync(iconPath)
            if (buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
              return `data:image/png;base64,${buf.toString('base64')}`
            }
          }
        }
      }
    }

    // Check standard resources/app/resources/win32/ in dir or subdirs
    const subdirsToCheck = [
      path.join(dir, 'resources', 'app', 'resources', 'win32'),
    ]
    try {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const sub = path.join(dir, item, 'resources', 'app', 'resources', 'win32')
        if (fs.existsSync(sub)) subdirsToCheck.push(sub)
      }
    } catch {}

    for (const resWin32 of subdirsToCheck) {
      if (fs.existsSync(resWin32)) {
        try {
          const files = fs.readdirSync(resWin32)
          for (const f of ['code_150x150.png', 'code_70x70.png', 'code.ico']) {
            if (files.includes(f)) {
              const full = path.join(resWin32, f)
              const buf = fs.readFileSync(full)
              if (f.endsWith('.ico')) {
                return `data:image/x-icon;base64,${buf.toString('base64')}`
              } else if (buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50) {
                return `data:image/png;base64,${buf.toString('base64')}`
              }
            }
          }
        } catch {}
      }
    }
  } catch {}
  return null
}

/**
 * Standard known app executable locator as a fast, infallible zero-overhead fallback.
 */
function findKnownAppExecutable(searchName: string): string | undefined {
  const s = searchName.toLowerCase().trim()
  const localAppData = process.env['LOCALAPPDATA'] || ''
  const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const appData = process.env['APPDATA'] || ''

  const candidates: string[] = []

  if (/\bantigravity\b/i.test(s)) {
    candidates.push(
      path.join(localAppData, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
      path.join(localAppData, 'Antigravity IDE', 'Antigravity.exe'),
      path.join(progFiles, 'Antigravity IDE', 'Antigravity IDE.exe')
    )
  }
  if (/\b(visual studio code|vscode|code)\b/i.test(s)) {
    candidates.push(
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join(progFiles, 'Microsoft VS Code', 'Code.exe')
    )
  }
  if (/\bzen\b/i.test(s)) {
    candidates.push(
      path.join(progFiles, 'Zen Browser', 'zen.exe'),
      path.join(localAppData, 'Zen Browser', 'zen.exe')
    )
  }
  if (/\bzcode\b/i.test(s)) {
    candidates.push(
      path.join(localAppData, 'Programs', 'ZCode', 'ZCode.exe'),
      path.join(localAppData, 'ZCode', 'ZCode.exe')
    )
  }
  if (/\bdiscord\b/i.test(s)) {
    try {
      const dDir = path.join(localAppData, 'Discord')
      if (fs.existsSync(dDir)) {
        const ico = path.join(dDir, 'app.ico')
        if (fs.existsSync(ico)) candidates.push(ico)
        const sub = fs.readdirSync(dDir).filter((d) => d.startsWith('app-'))
        if (sub.length) candidates.push(path.join(dDir, sub[0], 'Discord.exe'))
      }
    } catch {}
    candidates.push(
      path.join(localAppData, 'Discord', 'Discord.exe'),
      path.join(localAppData, 'Discord', 'Update.exe')
    )
  }
  if (/\bchrome\b/i.test(s)) {
    candidates.push(
      path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')
    )
  }
  if (/\bsubtitle\b/i.test(s)) {
    candidates.push(
      path.join(progFiles, 'Subtitle Edit', 'SubtitleEdit.exe'),
      path.join(progFilesX86, 'Subtitle Edit', 'SubtitleEdit.exe')
    )
  }
  if (/\bspotify\b/i.test(s)) {
    candidates.push(
      path.join(appData, 'Spotify', 'Spotify.exe'),
      path.join(localAppData, 'Microsoft', 'WindowsApps', 'Spotify.exe')
    )
  }
  if (/\bsteam\b/i.test(s)) {
    candidates.push(
      path.join(progFilesX86, 'Steam', 'Steam.exe'),
      path.join(progFiles, 'Steam', 'Steam.exe')
    )
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return undefined
}

// Throttled queue: limits concurrent PowerShell child processes to 2 max
class AsyncQueue {
  private concurrency: number
  private running = 0
  private queue: Array<() => void> = []

  constructor(concurrency = 2) {
    this.concurrency = concurrency
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

const psIconQueue = new AsyncQueue(2)

function scanStartMenuShortcuts() {
  function scanDir(dir: string) {
    try {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir)
      for (const entry of entries) {
        const full = path.join(dir, entry)
        try {
          const stat = fs.statSync(full)
          if (stat.isDirectory()) {
            scanDir(full)
          } else if (entry.toLowerCase().endsWith('.lnk')) {
            const baseName = path.basename(entry, '.lnk').toLowerCase()
            if (!startMenuLnkMap.has(baseName)) {
              startMenuLnkMap.set(baseName, full)
            }
          }
        } catch {}
      }
    } catch {}
  }

  scanDir(path.join(process.env['APPDATA'] || '', 'Microsoft\\Windows\\Start Menu\\Programs'))
  scanDir(path.join(process.env['ProgramData'] || '', 'Microsoft\\Windows\\Start Menu\\Programs'))
}

// Initial shortcut indexing (fast, pure Node.js fs, 0ms PowerShell)
try {
  scanStartMenuShortcuts()
} catch {}

function findMatchingShortcut(name: string, appId: string): string | undefined {
  const nName = name.toLowerCase().trim()
  const nAppId = appId.toLowerCase().trim()

  if (startMenuLnkMap.has(nName)) return startMenuLnkMap.get(nName)
  if (startMenuLnkMap.has(nAppId)) return startMenuLnkMap.get(nAppId)

  const normName = nName.replace(/[^a-z0-9]/g, '')
  const normAppId = nAppId.replace(/[^a-z0-9]/g, '')

  // 1. Exact alphanumeric match
  for (const [key, p] of startMenuLnkMap.entries()) {
    const normKey = key.replace(/[^a-z0-9]/g, '')
    if (normKey && (normKey === normName || normKey === normAppId)) return p
  }

  // 2. Token-level matching (never arbitrary substring matches)
  const nameTokens = nName.split(/[\s\-_\.]+/).filter((t) => t.length >= 2)
  for (const [key, p] of startMenuLnkMap.entries()) {
    if (key === nName || key === nAppId) return p
    const keyTokens = key.split(/[\s\-_\.]+/).filter((t) => t.length >= 2)
    if (keyTokens.length >= 2 && nameTokens.length >= 2) {
      if (keyTokens.every((kt) => nameTokens.includes(kt))) return p
    }
  }
  return undefined
}

function getIconCacheKey(type: string, identifier: string): string {
  return `${type}:${identifier}`
}

async function runPowerShell(script: string, timeout = 10000): Promise<{ ok: boolean; stdout: string; error?: string }> {
  try {
    const { execFile } = require('child_process')
    const { promisify } = require('util')
    const execFileAsync = promisify(execFile)
    const utf8Setup = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8;\n'
    const fullCommand = utf8Setup + script
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', fullCommand],
      { timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    )
    return { ok: true, stdout: String(stdout) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, stdout: '', error: message }
  }
}

function psQuote(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`
}

async function extractUwpAppIcon(cleanId: string): Promise<string | null> {
  try {
    const escaped = cleanId.replace(/'/g, "''")
    const psScript = `
      $target = '${escaped}'
      $cleanId = $target -replace '^explorer\\.exe\\s+shell:AppsFolder\\\\', ''
      $cleanId = $cleanId -replace '^shell:AppsFolder\\\\', ''

      $packageName = ($cleanId.Split('!')[0]).Split('_')[0]
      $pkg = Get-AppxPackage -Name "*$packageName*" -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($pkg) {
        $manifestPath = "$($pkg.InstallLocation)\\AppxManifest.xml"
        if (Test-Path $manifestPath) {
          $manifest = [xml](Get-Content $manifestPath)
          $apps = $manifest.Package.Applications.Application
          $logoRel = $null
          foreach ($a in $apps) {
            $ve = $a.VisualElements
            if ($ve) {
              $logoRel = $ve.Square44x44Logo
              if (-not $logoRel) { $logoRel = $ve.Square150x150Logo }
              if (-not $logoRel) { $logoRel = $ve.Logo }
              if ($logoRel) { break }
            }
          }
          if ($logoRel) {
            $logoBase = [System.IO.Path]::GetFileNameWithoutExtension($logoRel)
            $img = Get-ChildItem "$($pkg.InstallLocation)" -Recurse -Filter "*$logoBase*.png" -ErrorAction SilentlyContinue |
                   Sort-Object Length -Descending | Select-Object -First 1
            if ($img) {
              $bytes = [System.IO.File]::ReadAllBytes($img.FullName)
              [System.Convert]::ToBase64String($bytes)
            }
          }
        }
      }
    `
    const res = await runPowerShell(psScript, 5000)
    if (res.ok) {
      const base64 = res.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
      if (base64.length > 50 && /^[A-Za-z0-9+/=]+$/.test(base64)) {
        return `data:image/png;base64,${base64}`
      }
    }
    return null
  } catch {
    return null
  }
}

async function extractWindowsAppIcon(
  rawKey: string,
  name?: string,
  target?: string
): Promise<string | null> {
  const cleanRaw = String(rawKey || '').trim()
  const cleanName = String(name || '').trim()
  const cleanTarget = String(target || '').trim()

  if (!cleanRaw && !cleanName && !cleanTarget) return null

  // Clean prefix if passed as explorer.exe shell:AppsFolder\...
  const cleanId = cleanRaw
    .replace(/^explorer\.exe\s+shell:AppsFolder\\/i, '')
    .replace(/^shell:AppsFolder\\/i, '')
    .trim()

  const keysToCheck = [
    getIconCacheKey('app', cleanRaw.toLowerCase()),
    getIconCacheKey('app', cleanId.toLowerCase()),
  ]
  if (cleanTarget) keysToCheck.push(getIconCacheKey('app', cleanTarget.toLowerCase()))
  if (cleanName) keysToCheck.push(getIconCacheKey('app', cleanName.toLowerCase()))

  // 1. Check positive cache (memory + disk)
  for (const k of keysToCheck) {
    const cached = getIconCache(k)
    if (cached) return cached
  }

  // 2. Check negative cache
  if (keysToCheck.some((k) => NEGATIVE_ICON_CACHE.has(k))) return null

  const recordSuccess = (dataUrl: string) => {
    for (const k of keysToCheck) setIconCache(k, dataUrl)
    return dataUrl
  }

  const recordFailure = () => {
    for (const k of keysToCheck) NEGATIVE_ICON_CACHE.add(k)
    saveNegativeCacheToDisk()
    return null
  }

  try {
    // 3. Direct candidate file check (.exe, .ico, etc. - skip .lnk here so we resolve its real target first)
    const directCandidates = [
      cleanTarget,
      cleanRaw,
      cleanId,
    ].filter((p) => Boolean(p && !p.toLowerCase().endsWith('.lnk') && fs.existsSync(p)))

    for (const candidate of directCandidates) {
      if (candidate.toLowerCase().endsWith('.png') || candidate.toLowerCase().endsWith('.ico')) {
        try {
          const buf = fs.readFileSync(candidate)
          const mime = candidate.toLowerCase().endsWith('.ico') ? 'image/x-icon' : 'image/png'
          const durl = `data:${mime};base64,${buf.toString('base64')}`
          if (!isGenericShortcutIcon(durl)) return recordSuccess(durl)
        } catch {}
      }
      const manifestIcon = readVisualElementsManifest(candidate)
      if (manifestIcon && !isGenericShortcutIcon(manifestIcon)) {
        return recordSuccess(manifestIcon)
      }
      try {
        const icon = await app.getFileIcon(candidate, { size: 'normal' })
        if (icon && !icon.isEmpty()) {
          const durl = icon.toDataURL()
          if (!isGenericShortcutIcon(durl)) {
            return recordSuccess(durl)
          }
        }
      } catch {}
    }

    // 4. Start Menu shortcut lookup via fast binary LNK parser (pure JS, 0ms, zero Chromium NOTREACHED errors)
    const lnkPath =
      findMatchingShortcut(cleanName || cleanId, cleanRaw) ||
      (cleanName ? findMatchingShortcut(cleanName, cleanName) : undefined)

    if (lnkPath && fs.existsSync(lnkPath)) {
      const realTarget = readLnkTarget(lnkPath)
      if (realTarget && fs.existsSync(realTarget)) {
        const manifestIcon = readVisualElementsManifest(realTarget)
        if (manifestIcon && !isGenericShortcutIcon(manifestIcon)) {
          return recordSuccess(manifestIcon)
        }
        try {
          const icon = await app.getFileIcon(realTarget, { size: 'normal' })
          if (icon && !icon.isEmpty()) {
            const durl = icon.toDataURL()
            if (!isGenericShortcutIcon(durl)) {
              return recordSuccess(durl)
            }
          }
        } catch {}
      }
    }

    // 5. Look for known applications in standard install locations (AntiGravity, VS Code, Discord, Zen, etc.)
    const searchName = `${cleanName} ${cleanId} ${cleanTarget}`
    const knownExe = findKnownAppExecutable(searchName)
    if (knownExe && fs.existsSync(knownExe)) {
      if (knownExe.toLowerCase().endsWith('.png') || knownExe.toLowerCase().endsWith('.ico')) {
        try {
          const buf = fs.readFileSync(knownExe)
          const mime = knownExe.toLowerCase().endsWith('.ico') ? 'image/x-icon' : 'image/png'
          const durl = `data:${mime};base64,${buf.toString('base64')}`
          if (!isGenericShortcutIcon(durl)) return recordSuccess(durl)
        } catch {}
      }
      const manifestIcon = readVisualElementsManifest(knownExe)
      if (manifestIcon && !isGenericShortcutIcon(manifestIcon)) {
        return recordSuccess(manifestIcon)
      }
      try {
        const icon = await app.getFileIcon(knownExe, { size: 'normal' })
        if (icon && !icon.isEmpty()) {
          const durl = icon.toDataURL()
          if (!isGenericShortcutIcon(durl)) {
            return recordSuccess(durl)
          }
        }
      } catch {}
    }

    // 6. Start Menu .lnk direct icon extraction fallback
    if (lnkPath && fs.existsSync(lnkPath)) {
      try {
        const icon = await app.getFileIcon(lnkPath, { size: 'normal' })
        if (icon && !icon.isEmpty()) {
          const durl = icon.toDataURL()
          // Windows returns a generic white document with arrow on unresolved links — reject it!
          if (!isGenericShortcutIcon(durl)) {
            return recordSuccess(durl)
          }
        }
      } catch {}
    }

    // 7. UWP / AppX apps (e.g. Sticky Notes, 3B Görüntüleyici)
    const isUwp = cleanId.includes('!') || cleanId.includes('_')
    if (isUwp) {
      const dataUrl = await psIconQueue.run(async () => {
        return extractUwpAppIcon(cleanId)
      })
      if (dataUrl && !isGenericShortcutIcon(dataUrl)) {
        return recordSuccess(dataUrl)
      }
    }

    return recordFailure()
  } catch {
    return recordFailure()
  }
}

async function fetchFavicon(url: string): Promise<string | null> {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname

    const cacheKey = getIconCacheKey('favicon', domain)
    const cached = getIconCache(cacheKey)
    if (cached) return cached

    const faviconUrls = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    ]

    for (const faviconUrl of faviconUrls) {
      try {
        const dataUrl = await fetchUrlAsDataUrl(faviconUrl)
        if (dataUrl) {
          setIconCache(cacheKey, dataUrl)
          return dataUrl
        }
      } catch {
        continue
      }
    }
    return null
  } catch {
    return null
  }
}

function fetchUrlAsDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const request = net.request(url)
    const chunks: Buffer[] = []
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        request.abort()
        resolve(null)
      }
    }, 5000)

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve(null)
        }
        return
      }

      response.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk))
      })

      response.on('end', () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        const buffer = Buffer.concat(chunks)
        const mimeType = getMimeTypeFromUrl(url, buffer)
        const base64 = buffer.toString('base64')
        resolve(`data:${mimeType};base64,${base64}`)
      })
    })

    request.on('error', () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve(null)
      }
    })

    request.end()
  })
}

function getMimeTypeFromUrl(url: string, buffer: Buffer): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0]
  const signatures: Record<string, string> = {
    ico: 'image/x-icon',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }

  if (ext && signatures[ext]) return signatures[ext]

  if (buffer.length >= 4) {
    const header = buffer.subarray(0, 4)
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return 'image/png'
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg'
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x47) return 'image/gif'
    if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x01 && header[3] === 0x00) return 'image/x-icon'
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return 'image/webp'
    if (header[0] === 0x3c && header[1] === 0x3f && header[2] === 0x78 && header[3] === 0x6d) return 'image/svg+xml'
    if (header[0] === 0x3c && header[1] === 0x73 && header[2] === 0x76 && header[3] === 0x67) return 'image/svg+xml'
  }

  return 'image/png'
}

let win: BrowserWindow | null = null
let captureWin: BrowserWindow | null = null
let captureDataUrl: string | null = null
let captureJpegBuffer: Buffer | null = null
let captureCursorInfo: { x: number; y: number } | null = null

let tray: Tray | null = null
let appIsQuitting = false
let currentAccelerator = ''
let globalShortcutRegistrationFailed = false
let settingsAccelerator = ''
let settingsShortcutRegistrationFailed = false
let screenshotAccelerator = ''
let screenshotRegistrationFailed = false

const WIDTH = 640
const HEIGHT = 480

function createWindow() {
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    minWidth: WIDTH,
    maxWidth: WIDTH,
    minHeight: HEIGHT,
    maxHeight: HEIGHT,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#090A0C',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // DevTools never open automatically — production or development.
  // In development they are available via the explicit F12 toggle only.
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const prodPath = path.join(__dirname, '../../dist-renderer/index.html')
    win.loadFile(prodPath)
  }

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Lifecycle] [Main] did-fail-load:', errorCode, errorDescription, validatedURL)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Lifecycle] [Renderer] gone:', details.reason, 'exitCode:', details.exitCode)
    if (!appIsQuitting && details.reason !== 'clean-exit') {
      console.warn('[Lifecycle] [Main] Recovering renderer after abnormal exit...')
      try {
        win?.reload()
      } catch {}
    }
  })

  win.webContents.on('crashed', () => {
    console.error('[Lifecycle] [Renderer] crashed')
    if (!appIsQuitting) {
      try {
        win?.reload()
      } catch {}
    }
  })

  win.on('unresponsive', () => {
    console.warn('[Lifecycle] MainWindow became unresponsive')
  })

  win.on('responsive', () => {
    console.log('[Lifecycle] MainWindow became responsive')
  })

  win.once('ready-to-show', () => {
    if (!win) return
    console.log('[Lifecycle] MainWindow ready-to-show')
    win.setAlwaysOnTop(true, 'normal')
    if (getSetting('startMinimized', false)) {
      console.log('[Lifecycle] startMinimized enabled — staying hidden in background')
      return
    }
    showWindow()
    setTimeout(() => {
      void discoverInstalledApps()
    }, 2000)
  })

  win.on('blur', () => {
    if (Date.now() - lastWindowShownTime < 500) {
      return
    }
    if (win && !win.webContents.isDevToolsOpened()) {
      console.log('[Lifecycle] MainWindow blur -> hideWindow')
      hideWindow()
    }
  })

  win.on('focus', () => {
    if (win) {
      win.webContents.send('window:focus')
    }
  })

  win.on('close', (e) => {
    const closeToTray = getSetting('closeToTray', true)
    console.log('[Lifecycle] MainWindow close event. appIsQuitting =', appIsQuitting, 'closeToTray =', closeToTray)
    if (!appIsQuitting && closeToTray) {
      e.preventDefault()
      hideWindow()
      return
    }
    win = null
  })
}

let lastWindowShownTime = 0

function positionLauncherOnCursorDisplay(launcherWindow: BrowserWindow) {
  let cursorPos = screen.getCursorScreenPoint()
  // Guard against uninitialized Win32 coordinates
  if (!Number.isFinite(cursorPos.x) || cursorPos.x < -100000 || cursorPos.x > 100000) {
    const primary = screen.getPrimaryDisplay()
    cursorPos = { x: primary.bounds.x + primary.bounds.width / 2, y: primary.bounds.y + primary.bounds.height / 2 }
  }
  const display = screen.getDisplayNearestPoint(cursorPos)
  const [winWidth, winHeight] = launcherWindow.getSize()

  const targetX = Math.round(display.bounds.x + (display.bounds.width - winWidth) / 2)
  const targetY = Math.round(display.bounds.y + (display.bounds.height - winHeight) / 2)

  launcherWindow.setPosition(targetX, targetY)
  console.log(`[Lifecycle] Launcher centered on display ${display.id} (bounds: ${JSON.stringify(display.bounds)}) at (${targetX}, ${targetY}) for cursor at (${cursorPos.x}, ${cursorPos.y})`)
}

function showWindow() {
  console.log('[Lifecycle] showWindow called')
  lastWindowShownTime = Date.now()
  if (!win) {
    createWindow()
  }
  if (win && !win.isDestroyed()) {
    positionLauncherOnCursorDisplay(win)
    win.show()
    // Re-verify position after show so Windows DWM preserves placement on secondary display
    positionLauncherOnCursorDisplay(win)
    win.focus()
    win.setAlwaysOnTop(true, 'normal')
    win.webContents.send('window:focus')
  }
}

function hideWindow() {
  if (win && win.isVisible()) {
    console.log('[Lifecycle] hideWindow called')
    win!.hide()
  }
}

function toggleWindow() {
  // While the screenshot overlay is up and visible, the show shortcut stays inert
  if (captureWin && !captureWin.isDestroyed() && captureWin.isVisible()) return
  if (win && win.isVisible()) {
    hideWindow()
  } else {
    showWindow()
  }
}

/** Global settings shortcut: reveal the launcher if hidden, open settings. */
function openSettingsViaShortcut() {
  if (captureWin && !captureWin.isDestroyed() && captureWin.isVisible()) return
  if (!win || !win.isVisible()) {
    showWindow()
  }
  win?.webContents.send('app:open-settings')
}

function closeLauncher() {
  const closeToTray = getSetting('closeToTray', true)
  console.log('[Lifecycle] closeLauncher called. closeToTray =', closeToTray)
  if (closeToTray) {
    hideWindow()
  } else {
    appIsQuitting = true
    app.quit()
  }
}

/* ------------------------------- Tray ---------------------------------- */

function createTray() {
  if (tray) return
  try {
    const rawIcon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL)
    const icon = rawIcon.isEmpty() ? rawIcon : rawIcon.resize({ width: 16, height: 16 })
    tray = new Tray(icon)
    tray.setToolTip('Exist Flow')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show Exist Flow', click: () => showWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => {
            console.log('[Lifecycle] Tray Quit clicked -> quitting app')
            appIsQuitting = true
            app.quit()
          } },
      ])
    )
    tray.on('click', () => toggleWindow())
    console.log('[Lifecycle] Tray created successfully')
  } catch (err) {
    console.error('[Lifecycle] Failed to create tray:', err)
  }
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/* ---------------------------- Shortcuts -------------------------------- */

function registerShortcuts() {
  if (currentAccelerator) {
    try { globalShortcut.unregister(currentAccelerator) } catch {}
  }
  if (settingsAccelerator) {
    try { globalShortcut.unregister(settingsAccelerator) } catch {}
  }
  if (screenshotAccelerator) {
    try { globalShortcut.unregister(screenshotAccelerator) } catch {}
  }

  // 1. Launcher Global Shortcut
  const preferred = getSetting<string>('globalShortcut', 'ctrl+space')
  const accelerator = toAccelerator(preferred) || 'CommandOrControl+Space'
  let registered = false
  try {
    registered = globalShortcut.register(accelerator, () => toggleWindow())
  } catch (err) {
    console.error(`[Main] Global shortcut registration error for "${preferred}" (${accelerator}):`, err)
    registered = false
  }
  if (registered) {
    currentAccelerator = accelerator
    globalShortcutRegistrationFailed = false
    console.log(`[Main] Launcher shortcut registered: "${preferred}" (${accelerator})`)
  } else {
    globalShortcutRegistrationFailed = true
    console.warn(`[Main] Global shortcut "${preferred}" (${accelerator}) unavailable (claimed by OS or another app)`)
    try {
      const fallbackOk = globalShortcut.register('CommandOrControl+Space', () => toggleWindow())
      if (fallbackOk) {
        currentAccelerator = 'CommandOrControl+Space'
        console.log('[Main] Fell back to Ctrl+Space for launcher')
      } else {
        currentAccelerator = ''
      }
    } catch {
      currentAccelerator = ''
    }
  }

  // 2. Global settings shortcut (Ctrl+, by default) — user configurable
  const settingsPreferred = getSetting<string>('settingsShortcut', 'ctrl+,')
  const settingsAcc = toAccelerator(settingsPreferred) || 'Control+,'
  let settingsOk = false
  try {
    settingsOk = globalShortcut.register(settingsAcc, () => openSettingsViaShortcut())
  } catch (err) {
    console.error(`[Main] Settings shortcut registration error for "${settingsPreferred}" (${settingsAcc}):`, err)
    settingsOk = false
  }
  if (settingsOk) {
    settingsAccelerator = settingsAcc
    settingsShortcutRegistrationFailed = false
    console.log(`[Main] Settings shortcut registered: "${settingsPreferred}" (${settingsAcc})`)
  } else {
    settingsAccelerator = ''
    settingsShortcutRegistrationFailed = true
    console.warn(`[Main] Settings shortcut "${settingsPreferred}" (${settingsAcc}) unavailable`)
  }

  // 3. Global screenshot shortcut (Print Screen by default) — user configurable
  const screenshotPreferred = getSetting<string>('screenshotShortcut', 'Print Screen')
  const screenshotAcc = toAccelerator(screenshotPreferred) || 'PrintScreen'
  let screenshotOk = false
  try {
    screenshotOk = globalShortcut.register(screenshotAcc, () => {
      void startScreenshot()
    })
  } catch (err) {
    console.error(`[Main] Screenshot shortcut registration error for "${screenshotPreferred}" (${screenshotAcc}):`, err)
    screenshotOk = false
  }
  if (screenshotOk) {
    screenshotAccelerator = screenshotAcc
    screenshotRegistrationFailed = false
    console.log(`[Main] Screenshot shortcut registered: "${screenshotPreferred}" (${screenshotAcc})`)
  } else {
    screenshotAccelerator = ''
    screenshotRegistrationFailed = true
    console.warn(`[Main] Screenshot shortcut "${screenshotPreferred}" (${screenshotAcc}) unavailable`)
  }

  // Development only: explicit DevTools toggle (never automatic).
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    try {
      globalShortcut.register('F12', () => {
        if (!win) return
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools()
        } else {
          win.webContents.openDevTools({ mode: 'detach' })
        }
      })
      console.log('[Main] DevTools toggle: F12 (development only)')
    } catch {
      // ignore — F12 may be taken; DevTools stay manual
    }
  }
}

/* --------------------- Per-item global shortcuts ------------------------ */

const itemShortcuts = new Map<string, string>() // accelerator → itemId

async function openItemDirect(item: {
  id?: string
  target: string
  type?: string
  name?: string
  shortcut?: string
  arguments?: string[]
  workingDirectory?: string
}): Promise<void> {
  if (item.target === 'flow:screenshot') {
    void startScreenshot()
    return
  }
  if (item.target.startsWith('http://') || item.target.startsWith('https://')) {
    shell.openExternal(item.target)
    return
  }
  const isPath = /^([A-Za-z]:[\\/]|\/\/|file:\/\/)/.test(item.target)
  if (isPath) {
    void shell.openPath(item.target.replace('file://', ''))
    return
  }
  if (item.type === 'application') {
    await launchApplication(item.target, item.arguments, item.workingDirectory, false)
    return
  }
  await execViaShell(item.target, item.arguments, item.workingDirectory)
}

/** Re-registers every item-level and project-level global shortcut from persisted flow data. */
function syncItemShortcuts() {
  for (const accelerator of Array.from(itemShortcuts.keys())) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      // ignore
    }
  }
  itemShortcuts.clear()

  let items: Parameters<typeof openItemDirect>[0][] = []
  let projects: Array<{ id: string; name: string; shortcut?: string }> = []
  try {
    const data = store.get('flow-data') as
      | {
          items?: Parameters<typeof openItemDirect>[0][]
          projects?: Array<{ id: string; name: string; shortcut?: string }>
        }
      | undefined
    items = data?.items || []
    projects = data?.projects || []
  } catch {
    return
  }

  // 1. Direct item shortcuts: executes the action directly without opening launcher
  for (const item of items) {
    if (!item?.shortcut || !item?.target) continue
    const accelerator = toAccelerator(String(item.shortcut))
    if (
      !accelerator ||
      accelerator === currentAccelerator ||
      accelerator === settingsAccelerator ||
      accelerator === screenshotAccelerator ||
      itemShortcuts.has(accelerator)
    )
      continue
    try {
      const ok = globalShortcut.register(accelerator, () => {
        void openItemDirect(item)
      })
      if (ok) {
        itemShortcuts.set(accelerator, item.id || accelerator)
        console.log(`[Shortcuts] Item registered: "${item.shortcut}" (${accelerator}) -> "${item.name || item.id}"`)
      } else {
        console.warn(`[Shortcuts] Item shortcut "${item.shortcut}" unavailable for "${item.name || item.id}"`)
      }
    } catch (err) {
      console.warn(`[Shortcuts] Item registration error for "${item.shortcut}":`, err)
    }
  }

  // 2. Project shortcuts: reveals the launcher and selects the target project
  for (const proj of projects) {
    if (!proj?.shortcut || !proj?.id) continue
    const accelerator = toAccelerator(String(proj.shortcut))
    if (
      !accelerator ||
      accelerator === currentAccelerator ||
      accelerator === settingsAccelerator ||
      accelerator === screenshotAccelerator ||
      itemShortcuts.has(accelerator)
    )
      continue
    try {
      const ok = globalShortcut.register(accelerator, () => {
        console.log(`[Shortcuts] Project triggered: "${proj.name}" (${proj.id})`)
        showWindow()
        win?.webContents.send('app:open-project', proj.id)
      })
      if (ok) {
        itemShortcuts.set(accelerator, `project:${proj.id}`)
        console.log(`[Shortcuts] Project registered: "${proj.shortcut}" (${accelerator}) -> "${proj.name}"`)
      } else {
        console.warn(`[Shortcuts] Project shortcut "${proj.shortcut}" unavailable for "${proj.name || proj.id}"`)
      }
    } catch (err) {
      console.warn(`[Shortcuts] Project registration error for "${proj.shortcut}":`, err)
    }
  }
}

/* --------------------------- Screenshot -------------------------------- */

function createCaptureWindow(targetDisplay?: Electron.Display): BrowserWindow {
  if (captureWin && !captureWin.isDestroyed()) return captureWin

  const disp = targetDisplay || screen.getPrimaryDisplay()
  captureWin = new BrowserWindow({
    x: disp.bounds.x,
    y: disp.bounds.y,
    width: disp.bounds.width,
    height: disp.bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    fullscreenable: false,
    show: false,
    focusable: false, // Prevents stealing focus or triggering blur on the launcher window
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // When page finishes loading, deliver buffer or dataUrl if ready
  captureWin.webContents.on('did-finish-load', () => {
    const payload = captureJpegBuffer || captureDataUrl
    if (payload && captureWin && !captureWin.isDestroyed()) {
      captureWin.webContents.send('screenshot:capture-ready', payload)
    }
  })

  captureWin.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault()
      captureWin?.hide()
      captureWin?.setFocusable(false)
    }
  })

  captureWin.on('closed', () => {
    captureWin = null
    captureDataUrl = null
    captureJpegBuffer = null
    captureCursorInfo = null
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void captureWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}/?mode=capture`)
  } else {
    void captureWin.loadFile(path.join(__dirname, '../../dist-renderer/index.html'), {
      query: { mode: 'capture' },
    })
  }

  return captureWin
}

/** Absolute epoch ms, comparable across main and renderer processes. */
function epochNow(): number {
  return performance.timeOrigin + performance.now()
}

interface ScreenshotRun {
  id: number
  mode: 'overlay-first' | 'capture-first'
  marks: Record<string, number> // stage -> epoch ms
  info: Record<string, unknown>
}

let screenshotRunSeq = 0
let currentScreenshotRun: ScreenshotRun | null = null
const completedScreenshotRuns: ScreenshotRun[] = []

function markScreenshot(stage: string, info?: Record<string, unknown>, at = epochNow()): void {
  const run = currentScreenshotRun
  if (!run) return
  run.marks[stage] = at
  if (info) Object.assign(run.info, info)
  const t0 = run.marks.trigger ?? at
  const extra = info ? ' ' + JSON.stringify(info) : ''
  console.log(`[Screenshot #${run.id}] ${stage.padEnd(16)} +${(at - t0).toFixed(1)}ms${extra}`)
}

function showCaptureWindow(display: Electron.Display): void {
  if (!captureWin || captureWin.isDestroyed()) return
  const bounds = {
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
  }
  captureWin.setBounds(bounds)
  captureWin.setAlwaysOnTop(true, 'screen-saver')
  captureWin.setFocusable(true)
  captureWin.show()
  captureWin.setBounds(bounds)
  captureWin.focus()
  const shown = captureWin.getBounds()
  const host = screen.getDisplayNearestPoint({ x: shown.x + shown.width / 2, y: shown.y + shown.height / 2 })
  console.log(
    `[Capture] overlay shown bounds=${JSON.stringify(shown)} onDisplay=${host.id} ` +
      `(target=${display.id}, match=${host.id === display.id})`
  )
}

/** How a DesktopCapturerSource was bound to an Electron Display. */
type SourceMatchMethod = 'display_id' | 'screen-index' | 'screen-index-sorted'

interface SourceMatch {
  source: Electron.DesktopCapturerSource
  method: SourceMatchMethod
}

/**
 * Matches an Electron Display to a DesktopCapturerSource.
 *
 * Windows/Electron 27 delivers `screen:N:0` ids; `display_id` is populated on
 * some machines and empty on others, so matching is sequenced:
 *   1. `display_id`          — direct, unambiguous
 *   2. `screen:N:0` by index — source id index against screen.getAllDisplays() order
 * Never falls back to `sources[0]`: an unmatched display is an error.
 */
function selectSourceForDisplay(
  sources: Electron.DesktopCapturerSource[],
  targetDisplay: Electron.Display,
  allDisplays: Electron.Display[]
): SourceMatch | null {
  if (!sources.length) return null
  const targetIdStr = String(targetDisplay.id)

  // 1. Direct display_id match when the platform reports it
  const byDisplayId = sources.find((s) => s.display_id && String(s.display_id) === targetIdStr)
  if (byDisplayId) {
    console.log(`[Capture] Matched via display_id: source "${byDisplayId.id}" (display_id: "${byDisplayId.display_id}") for display ${targetDisplay.id}`)
    return { source: byDisplayId, method: 'display_id' }
  }

  // 2. Source id index against screen.getAllDisplays() order (screen:N:0)
  const displayIndex = allDisplays.findIndex((d) => d.id === targetDisplay.id)
  if (displayIndex !== -1) {
    const byExactId = sources.find((s) => s.id === `screen:${displayIndex}:0`)
    if (byExactId) {
      console.log(`[Capture] Matched via screen-index (exact "${byExactId.id}") for display ${targetDisplay.id} (index ${displayIndex})`)
      return { source: byExactId, method: 'screen-index' }
    }
    const byPrefixId = sources.find((s) => s.id.startsWith(`screen:${displayIndex}:`))
    if (byPrefixId) {
      console.log(`[Capture] Matched via screen-index (prefix "${byPrefixId.id}") for display ${targetDisplay.id} (index ${displayIndex})`)
      return { source: byPrefixId, method: 'screen-index' }
    }
    if (sources[displayIndex]) {
      console.log(`[Capture] Matched via screen-index (sources array index ${displayIndex}, id "${sources[displayIndex].id}") for display ${targetDisplay.id}`)
      return { source: sources[displayIndex], method: 'screen-index' }
    }
  }

  // 3. Fallback against displays sorted top-left -> bottom-right if order differed
  const sorted = [...allDisplays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const sortedIndex = sorted.findIndex((d) => d.id === targetDisplay.id)
  if (sortedIndex !== -1 && sortedIndex !== displayIndex) {
    const bySorted = sources.find((s) => s.id === `screen:${sortedIndex}:0`)
    if (bySorted) {
      console.log(`[Capture] Matched via screen-index-sorted ("${bySorted.id}") for display ${targetDisplay.id} (sorted index ${sortedIndex})`)
      return { source: bySorted, method: 'screen-index-sorted' }
    }
  }

  // sources[0] fallback is strictly prohibited
  console.warn(`[Capture] No source matched for display ${targetDisplay.id} among ${sources.length} sources (sources[0] fallback prohibited)`)
  return null
}

function logAvailableSources(sources: Electron.DesktopCapturerSource[], displays: Electron.Display[]): void {
  const src = sources.map((s) => `${s.id}|display_id=${s.display_id || ''}|${s.name}`).join(' , ')
  const disp = displays.map((d, i) => `#${i}:${d.id}@${d.bounds.x},${d.bounds.y}`).join(' , ')
  console.warn(`[Capture] NO source matched — sources: [${src}] displays: [${disp}]`)
}

async function startScreenshot(options?: { displayId?: number | string; point?: { x: number; y: number } }) {
  const runId = ++screenshotRunSeq
  currentScreenshotRun = {
    id: runId,
    mode: 'capture-first',
    marks: {},
    info: {},
  }
  markScreenshot('trigger', { mode: currentScreenshotRun.mode })

  captureJpegBuffer = null
  captureDataUrl = null

  // Determine target display from cursor position (or test options)
  let cursorPos = (options?.point && Number.isFinite(options.point.x) && Number.isFinite(options.point.y))
    ? options.point
    : screen.getCursorScreenPoint()

  // Guard against uninitialized Win32 cursor coordinates
  if (!Number.isFinite(cursorPos.x) || cursorPos.x < -100000 || cursorPos.x > 100000) {
    const primary = screen.getPrimaryDisplay()
    cursorPos = { x: primary.bounds.x + primary.bounds.width / 2, y: primary.bounds.y + primary.bounds.height / 2 }
  }

  const allDisplays = screen.getAllDisplays()
  let display: Electron.Display
  if (options?.displayId != null) {
    const matched = allDisplays.find((d) => String(d.id) === String(options.displayId))
    display = matched || screen.getDisplayNearestPoint(cursorPos)
  } else {
    display = screen.getDisplayNearestPoint(cursorPos)
  }
  const displayIndex = allDisplays.findIndex((d) => d.id === display.id)
  console.log(`[Capture] Target display: ID=${display.id} (index ${displayIndex}), cursor=(${cursorPos.x}, ${cursorPos.y}), bounds=${JSON.stringify(display.bounds)}`)

  if (!captureWin || captureWin.isDestroyed()) {
    createCaptureWindow(display)
    markScreenshot('window-created')
  }

  // Position capture window onto target display and ensure it is hidden during capture
  if (captureWin && !captureWin.isDestroyed()) {
    captureWin.setBounds({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
    })
    if (captureWin.isVisible()) {
      captureWin.hide()
      captureWin.setFocusable(false)
    }
    markScreenshot('bounds-set', { bounds: JSON.stringify(display.bounds) })
  }

  // Determine cursor capture position and settings flag
  const captureCursorEnabled = getSetting<boolean>('screenshotCaptureCursor', false)
  const cursorRelX = Math.max(0, Math.min(display.bounds.width, cursorPos.x - display.bounds.x))
  const cursorRelY = Math.max(0, Math.min(display.bounds.height, cursorPos.y - display.bounds.y))
  captureCursorInfo = { x: cursorRelX, y: cursorRelY }

  // Renderer resets its state for this run id
  try {
    captureWin?.webContents.send('screenshot:begin', {
      runId,
      t0: currentScreenshotRun.marks.trigger,
      cursor: captureCursorInfo,
      captureCursor: captureCursorEnabled,
    })
    markScreenshot('begin-ipc')
  } catch {}

  // Hide launcher if visible so it is not part of the capture
  if (win && win.isVisible()) {
    hideWindow()
    // Give DWM time to unmap the launcher window so it isn't captured
    await new Promise((r) => setTimeout(r, 60))
    markScreenshot('launcher-hidden')
  }

  const sendFailure = (reason: string) => {
    markScreenshot('capture-failed', { reason })
    showCaptureWindow(display)
    try {
      captureWin?.webContents.send('screenshot:capture-failed', { runId, reason })
    } catch {}
  }

  try {
    const scale = display.scaleFactor || 1
    const requestedWidth = Math.round(display.size.width * scale)
    const requestedHeight = Math.round(display.size.height * scale)
    markScreenshot('capture-start', { requested: `${requestedWidth}x${requestedHeight}` })
    let sources = await desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false,
      thumbnailSize: {
        width: requestedWidth,
        height: requestedHeight,
      },
    })
    if (runId !== screenshotRunSeq) return // superseded by a newer trigger

    markScreenshot('sources-listed', {
      count: sources.length,
      ids: sources.map((s) => `${s.id}${s.display_id ? `(${s.display_id})` : '(no display_id)'}`).join(','),
    })

    let match = selectSourceForDisplay(sources, display, allDisplays)
    if (!match) {
      logAvailableSources(sources, allDisplays)
      sendFailure('no-screen-source')
      return
    }

    let source = match.source
    let size = source.thumbnail.getSize()

    // If thumbnail came back empty (desktop busy/lock), retry once
    if (source.thumbnail.isEmpty() || size.width === 0 || size.height === 0) {
      console.warn(`[Capture] Empty thumbnail for "${source.id}" on first attempt. Retrying in 80ms...`)
      await new Promise((r) => setTimeout(r, 80))
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false,
        thumbnailSize: {
          width: requestedWidth,
          height: requestedHeight,
        },
      })
      if (runId !== screenshotRunSeq) return
      match = selectSourceForDisplay(sources, display, allDisplays)
      if (!match) {
        logAvailableSources(sources, allDisplays)
        sendFailure('no-screen-source')
        return
      }
      source = match.source
      size = source.thumbnail.getSize()
    }

    markScreenshot('source-selected', {
      targetDisplayId: display.id,
      sourceId: source.id,
      sourceName: source.name,
      sourceDisplayId: source.display_id || '(empty)',
      matchMethod: match.method,
    })
    console.log(
      `[Capture] display ${display.id} -> source "${source.id}" via ${match.method} ` +
        `(display_id="${source.display_id || ''}", name="${source.name}")`
    )

    markScreenshot('capture-end', { width: size.width, height: size.height })
    if (source.thumbnail.isEmpty() || size.width === 0 || size.height === 0) {
      console.warn(
        `[Capture] EMPTY THUMBNAIL for "${source.id}" — requested ${requestedWidth}x${requestedHeight}, ` +
          `got ${size.width}x${size.height}, isEmpty=${source.thumbnail.isEmpty()}`
      )
      sendFailure('empty-thumbnail')
      return
    }
    if (size.width !== requestedWidth || size.height !== requestedHeight) {
      console.warn(
        `[Capture] thumbnail size mismatch for "${source.id}" — requested ${requestedWidth}x${requestedHeight}, ` +
          `got ${size.width}x${size.height}`
      )
    }

    // JPEG 75 reduces buffer size and encode latency significantly with zero discernible loss
    captureJpegBuffer = source.thumbnail.toJPEG(75)
    markScreenshot('encode-end', { bytes: captureJpegBuffer.length })

    if (captureWin && !captureWin.isDestroyed()) {
      showCaptureWindow(display)
      markScreenshot('show-called')
      captureWin.webContents.send('screenshot:capture-ready', captureJpegBuffer)
      markScreenshot('ipc-sent')
    }
  } catch (err) {
    console.error('[Main] Screenshot capture failed:', err)
    sendFailure(err instanceof Error ? err.message : String(err))
  }
}

// Renderer-side timing marks (first visible frame, img onload/onerror, settled)
ipcMain.on('screenshot:metric', (_event, payload: { runId: number; stage: string; at: number; info?: Record<string, unknown> }) => {
  const run = currentScreenshotRun
  if (!run || !payload || payload.runId !== run.id) return
  markScreenshot(payload.stage, payload.info, payload.at)
  if (payload.stage === 'settled' || payload.stage === 'img-error' || payload.stage === 'error-shown') {
    const t0 = run.marks.trigger
    const rel = (k: string) => (run.marks[k] != null ? +(run.marks[k] - t0).toFixed(1) : null)
    console.log(
      `[Screenshot #${run.id}] SUMMARY mode=${run.mode} firstFrame=${rel('first-frame')}ms ` +
        `captureEnd=${rel('capture-end')}ms imgLoad=${rel('img-load')}ms settled=${rel('settled')}ms`
    )
    completedScreenshotRuns.push(run)
  }
})

function closeCapture() {
  captureDataUrl = null
  captureJpegBuffer = null
  captureCursorInfo = null
  if (captureWin && !captureWin.isDestroyed()) {
    try {
      captureWin.webContents.send('screenshot:reset')
    } catch {}
    captureWin.hide()
    captureWin.setFocusable(false)
  }
}

function sanitizePersistentStore(): void {
  try {
    const rawData = store.get('flow-data') as Record<string, any> | undefined
    if (rawData && Array.isArray(rawData.items)) {
      let changed = false
      const iconCache = (store.get('iconCache') as Record<string, string> | undefined) || {}
      let iconCacheChanged = false

      for (const item of rawData.items) {
        if (item.icon && item.icon.dataUrl && isGenericShortcutIcon(item.icon.dataUrl)) {
          item.icon = undefined
          changed = true
        }
        if (iconCache[item.id] && isGenericShortcutIcon(iconCache[item.id])) {
          delete iconCache[item.id]
          iconCacheChanged = true
        }
      }

      if (changed) {
        store.set('flow-data', rawData)
      }
      if (iconCacheChanged) {
        store.set('iconCache', iconCache)
      }
    }
  } catch {}
}

app.whenReady().then(() => {
  cleanupLegacyConflictingCache()
  sanitizePersistentStore()
  loadNegativeCacheFromDisk()

  if (getSetting('closeToTray', true)) {
    createTray()
  }
  registerShortcuts()
  syncItemShortcuts()
  createWindow()
  try {
    createCaptureWindow()
  } catch {}

  // Real-time screenshot latency measurement (scripts/measure_screenshot.js)
  const measureRuns = Number(process.env.EXIST_FLOW_MEASURE || 0)
  if (measureRuns > 0 && captureWin) {
    const outFile = process.env.EXIST_FLOW_MEASURE_OUT || path.join(app.getPath('temp'), 'exist-flow-screenshot-measure.json')
    captureWin.webContents.once('did-finish-load', async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
      await wait(800)
      for (let i = 0; i < measureRuns; i++) {
        const before = completedScreenshotRuns.length
        void startScreenshot()
        const deadline = Date.now() + 5000
        while (completedScreenshotRuns.length === before && Date.now() < deadline) await wait(20)
        if (completedScreenshotRuns.length === before && currentScreenshotRun) {
          currentScreenshotRun.info.timedOut = true
          completedScreenshotRuns.push(currentScreenshotRun)
        }
        await wait(250)
        closeCapture()
        await wait(400)
      }
      const runs = completedScreenshotRuns.map((r) => {
        const t0 = r.marks.trigger
        const rel: Record<string, number> = {}
        for (const [k, v] of Object.entries(r.marks)) rel[k] = +(v - t0).toFixed(1)
        return { id: r.id, mode: r.mode, info: r.info, msFromTrigger: rel }
      })
      require('fs').writeFileSync(outFile, JSON.stringify({ requested: measureRuns, captureExclusion: false, runs }, null, 2))
      console.log(`[Measure] wrote ${runs.length}/${measureRuns} runs to ${outFile}`)
      appIsQuitting = true
      app.quit()
    })
  }

  // Controlled idle pre-warm of discovered apps metadata & icons
  setTimeout(() => {
    void prewarmDiscoveredApps()
  }, 1500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('child-process-gone', (_event, details) => {
  console.error('[Lifecycle] child-process-gone:', details.type, details.name, details.reason, 'exitCode:', details.exitCode)
})

app.on('before-quit', () => {
  console.log('[Lifecycle] before-quit')
  appIsQuitting = true
})

app.on('window-all-closed', () => {
  const closeToTray = getSetting('closeToTray', true)
  console.log('[Lifecycle] window-all-closed. platform =', process.platform, 'closeToTray =', closeToTray)
  if (process.platform !== 'darwin' && !closeToTray) {
    console.log('[Lifecycle] Quitting app because closeToTray is false and all windows closed')
    app.quit()
  }
})

app.on('will-quit', () => {
  console.log('[Lifecycle] will-quit')
  globalShortcut.unregisterAll()
})

/* ------------------------------- IPC ----------------------------------- */

ipcMain.handle('window:hide', () => {
  hideWindow()
})

ipcMain.handle('window:show', () => {
  showWindow()
})

ipcMain.handle('window:focus', () => {
  if (win) {
    win.focus()
  }
})

ipcMain.handle('window:close', () => {
  closeLauncher()
})

ipcMain.handle('store:get', (_event, key?: string) => {
  if (key) {
    return store.get(key)
  }
  return store.store
})

ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
  store.set(key, value)
})

ipcMain.handle('store:delete', (_event, key: string) => {
  store.delete(key)
})

ipcMain.handle('shortcuts:sync', () => {
  syncItemShortcuts()
  return { success: true }
})

ipcMain.handle('shortcuts:validate', (_event, input: string, targetId?: string) => {
  const trimmed = String(input || '').trim()
  if (!trimmed) return { success: false, error: 'Kısayol boş olamaz' }
  const accelerator = toAccelerator(trimmed)
  if (!accelerator) return { success: false, error: 'Geçersiz kısayol kombinasyonu' }

  if (accelerator === currentAccelerator) {
    return { success: false, error: 'Launcher kısayolu ile çakışıyor' }
  }
  if (accelerator === settingsAccelerator) {
    return { success: false, error: 'Ayarlar kısayolu ile çakışıyor' }
  }
  if (accelerator === screenshotAccelerator) {
    return { success: false, error: 'Ekran görüntüsü kısayolu ile çakışıyor' }
  }

  const existingOwner = itemShortcuts.get(accelerator)
  if (existingOwner && existingOwner !== targetId && existingOwner !== `project:${targetId}`) {
    return { success: false, error: 'Bu kısayol zaten başka bir öğe veya projeye atanmış' }
  }

  const wasRegisteredHere = existingOwner === targetId || existingOwner === `project:${targetId}`
  if (wasRegisteredHere) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {}
  }

  let testOk = false
  try {
    testOk = globalShortcut.register(accelerator, () => {})
  } catch (err) {
    console.error(`[Shortcuts] Validation test error for "${trimmed}" (${accelerator}):`, err)
    testOk = false
  }

  if (testOk) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {}
    if (wasRegisteredHere) {
      try {
        globalShortcut.register(accelerator, () => {})
      } catch {}
    }
    return { success: true, accelerator }
  }

  console.warn(`[Shortcuts] Validation failed for "${trimmed}" (${accelerator}) — in use by another app or OS`)
  return { success: false, error: 'Bu kısayol başka bir uygulama tarafından kullanılıyor' }
})

function execViaShell(
  target: string,
  args?: string[],
  workingDirectory?: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    const command = args?.length ? `"${target}" ${args.join(' ')}` : target
    const execOptions: { windowsHide: boolean; cwd?: string } = { windowsHide: true }
    if (workingDirectory) {
      execOptions.cwd = workingDirectory
    }

    exec(command, execOptions, (error: unknown) => {
      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[Main] Failed to execute command:', message)
        resolve({ success: false, error: message })
        return
      }
      resolve({ success: true })
    })
  })
}

/**
 * Launch a desktop application through the shell (ShellExecute), which
 * resolves bare names ("discord", "chrome") via App Paths / PATH and
 * full paths ("C:\Program Files\...") directly.
 */
async function launchApplication(
  target: string,
  args?: string[],
  workingDirectory?: string,
  elevated = false
): Promise<{ success: boolean; error?: string }> {
  let filePath = target
  const targetArgs = [...(args || [])]
  const isPathLike = /^([A-Za-z]:[\\/]|\\\\|file:\/\/)/.test(target)

  // "explorer.exe shell:AppsFolder\X" → file + inline arguments
  if (!isPathLike && /\s/.test(target)) {
    const idx = target.search(/\s/)
    filePath = target.slice(0, idx)
    const rest = target.slice(idx + 1).trim()
    if (rest) targetArgs.unshift(rest)
  }

  let script = `Start-Process -FilePath ${psQuote(filePath)}`
  if (targetArgs.length) {
    script += ` -ArgumentList @(${targetArgs.map(psQuote).join(',')})`
  }
  if (workingDirectory) {
    script += ` -WorkingDirectory ${psQuote(workingDirectory)}`
  }
  if (elevated) {
    script += ' -Verb RunAs'
  }

  const res = await runPowerShell(script, 15000)
  if (res.ok) return { success: true }

  if (elevated) {
    // User declined UAC or elevation failed — surface it, no fallback.
    return { success: false, error: res.error }
  }

  // Fallback for targets that are shell commands rather than launchable files
  return execViaShell(target, args, workingDirectory)
}

ipcMain.handle(
  'app:open',
  async (_event, target: string, args?: string[], workingDirectory?: string, kind?: string) => {
    if (target === 'flow:screenshot') {
      void startScreenshot()
      return { success: true }
    }

    if (target.startsWith('http://') || target.startsWith('https://')) {
      shell.openExternal(target)
      return { success: true }
    }

    const isPath = /^([A-Za-z]:[\\/]|\/\/|file:\/\/)/.test(target)
    if (isPath) {
      const filePath = target.replace('file://', '')
      shell.openPath(filePath).catch((err) => {
        console.error('Failed to open path:', err)
      })
      return { success: true }
    }

    if (kind === 'application') {
      return launchApplication(target, args, workingDirectory, false)
    }

    return execViaShell(target, args, workingDirectory)
  }
)

ipcMain.handle('app:open-elevated', async (_event, target: string, args?: string[], workingDirectory?: string) => {
  return launchApplication(target, args, workingDirectory, true)
})

ipcMain.handle('app:reveal', (_event, targetPath: string) => {
  try {
    shell.showItemInFolder(targetPath)
    return { success: true }
  } catch (err) {
    console.error('[Main] reveal failed:', err)
    return { success: false }
  }
})

let cachedDiscoveredApps: Array<{
  name: string
  appId: string
  target: string
  workingDirectory?: string
  icon?: string
  description?: string
  iconDataUrl?: string
}> | null = null

let discoverAppsPromise: Promise<Array<{
  name: string
  appId: string
  target: string
  workingDirectory?: string
  icon?: string
  description?: string
  iconDataUrl?: string
}>> | null = null

function guessAppDescription(name: string, target: string): string {
  const lower = `${name} ${target}`.toLowerCase()
  if (/\b(antigravity|anti gravity)\b/i.test(lower)) return 'AI code editor'
  if (/\b(browser|web|internet|chrome|firefox|edge|brave|opera|zen)\b/i.test(lower)) return 'Web browser'
  if (/\b(visual studio code|vscode|cursor|windsurf|zcode)\b/i.test(lower)) return 'Code editor'
  if (/\b(code|editor|ide|dev|studio)\b/i.test(lower)) return 'Code editor'
  if (/\b(after effects|aftereffects|motion graphics|vfx|compositing)\b/i.test(lower)) return 'Motion graphics & VFX'
  if (/\b(illustrator|vector)\b/i.test(lower)) return 'Vector graphics editor'
  if (/\b(unreal|unity)\b/i.test(lower)) return 'Game engine & 3D'
  if (/\b(fl studio|fl64|ableton|audacity|daw)\b/i.test(lower)) return 'Digital audio workstation'
  if (/\b(discord|slack|teams|skype|telegram|whatsapp|zoom)\b/i.test(lower)) return 'Communication'
  if (/\b(spotify|itunes|music|soundcloud)\b/i.test(lower)) return 'Music streaming'
  if (/\b(vlc|player|media|video|audio|mpv)\b/i.test(lower)) return 'Media player'
  if (/\b(subtitle edit|subtitle)\b/i.test(lower)) return 'Subtitle editor'
  if (/\b(steam|epic|games|battle\.net|ubisoft)\b/i.test(lower)) return 'Game launcher'
  if (/\b(7-zip|7z|winrar|zip|archive)\b/i.test(lower)) return 'File archiver'
  if (/\b(sticky notes|notes|obsidian|notion)\b/i.test(lower)) return 'Notes'
  if (/\b(3b g\u00f6r\u00fcnt\u00fcleyici|3d viewer|blender)\b/i.test(lower)) return '3D creation suite'
  if (/\b(photoshop|gimp|paint|photo|draw)\b/i.test(lower)) return 'Image editor'
  if (/\b(premiere|davinci|video editor|resolve)\b/i.test(lower)) return 'Video editor'
  if (/\b(word|excel|powerpoint|office|docs)\b/i.test(lower)) return 'Office suite'
  if (/\b(powershell|terminal|cmd|shell|console)\b/i.test(lower)) return 'Command shell'
  if (/\b(calculator|hesap makinesi)\b/i.test(lower)) return 'Calculator'
  if (/\b(settings|ayarlar)\b/i.test(lower)) return 'System settings'
  if (/\b(taskmgr|task manager|g\u00f6rev y\u00f6neticisi)\b/i.test(lower)) return 'System monitor'
  if (/\b(github|git)\b/i.test(lower)) return 'Development platform'
  return 'Windows application'
}

function attachCachedIconsToDiscoveredApps(
  apps: Array<{
    name: string
    appId: string
    target: string
    workingDirectory?: string
    icon?: string
    description?: string
    iconDataUrl?: string
  }>
) {
  for (const app of apps) {
    if (!app.iconDataUrl || isGenericShortcutIcon(app.iconDataUrl)) {
      app.iconDataUrl = undefined
      const cached =
        getIconCache(getIconCacheKey('app', app.appId.toLowerCase())) ||
        getIconCache(getIconCacheKey('app', app.name.toLowerCase())) ||
        (app.target ? getIconCache(getIconCacheKey('app', app.target.toLowerCase())) : undefined)
      if (cached && !isGenericShortcutIcon(cached)) {
        app.iconDataUrl = cached
      }
    }
  }
}

async function discoverInstalledApps(): Promise<Array<{
  name: string
  appId: string
  target: string
  workingDirectory?: string
  icon?: string
  description?: string
  iconDataUrl?: string
}>> {
  if (cachedDiscoveredApps) {
    attachCachedIconsToDiscoveredApps(cachedDiscoveredApps)
    return cachedDiscoveredApps
  }

  // Check persistent disk cache for immediate 0ms load
  try {
    const diskFile = getDiscoveredAppsCacheFile()
    if (diskFile && fs.existsSync(diskFile)) {
      const raw = fs.readFileSync(diskFile, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Sanitize out any corrupt generic icons that might have been saved previously
        for (const item of parsed) {
          if (item.iconDataUrl && isGenericShortcutIcon(item.iconDataUrl)) {
            item.iconDataUrl = undefined
          }
        }
        cachedDiscoveredApps = parsed
        attachCachedIconsToDiscoveredApps(cachedDiscoveredApps)
        return cachedDiscoveredApps
      }
    }
  } catch {}

  if (discoverAppsPromise) return discoverAppsPromise

  discoverAppsPromise = (async () => {
    try {
      const res = await runPowerShell(
        'Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress',
        20000
      )
      if (!res.ok) return []
      const raw = JSON.parse(res.stdout)
      const apps = Array.isArray(raw) ? raw : [raw]

      const KNOWN_FOLDER_GUIDS: Record<string, string> = {
        '{6D809377-6AF0-444B-8957-A3773F02200E}': process.env['ProgramFiles'] || 'C:\\Program Files',
        '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}': process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
        '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}': (process.env['SystemRoot'] || 'C:\\Windows') + '\\System32',
        '{D65231B0-B2F1-4857-A4CE-A8E7C6EA7D27}': (process.env['SystemRoot'] || 'C:\\Windows') + '\\SysWOW64',
        '{A52BBA46-E9E1-435F-B3D9-28DAA648C0F6}': process.env['LOCALAPPDATA'] || '',
        '{3EB685D2-65B9-4CF6-A03A-E3EF65729F3D}': process.env['APPDATA'] || '',
      }

      // Refresh Start Menu shortcuts if needed
      if (startMenuLnkMap.size === 0) {
        scanStartMenuShortcuts()
      }

      const resolved = apps.map((app: { Name?: string; AppID?: string }) => {
        const name = (app.Name || 'Unknown').trim()
        const appId = (app.AppID || '').trim()

        let target = ''
        let workingDirectory: string | undefined

        // Check if AppID is a GUID-prefixed path or direct path
        let candidatePath = appId
        for (const [guid, root] of Object.entries(KNOWN_FOLDER_GUIDS)) {
          if (candidatePath.startsWith(guid)) {
            candidatePath = candidatePath.replace(guid, root)
            break
          }
        }

        if (candidatePath && /\.exe$/i.test(candidatePath) && fs.existsSync(candidatePath)) {
          target = candidatePath
          workingDirectory = path.dirname(candidatePath)
        } else {
          // 1. Check Start Menu .lnk shortcuts via fast binary parser (pure JS, 0ms, zero NOTREACHED assertions)
          const lnkFile = findMatchingShortcut(name, appId)
          if (lnkFile && fs.existsSync(lnkFile)) {
            const realTarget = readLnkTarget(lnkFile)
            if (realTarget && /\.exe$/i.test(realTarget) && fs.existsSync(realTarget)) {
              target = realTarget
              workingDirectory = path.dirname(realTarget)
            }
          }

          // 2. Check standard known application executable locations if not resolved yet
          if (!target) {
            const knownExe = findKnownAppExecutable(name + ' ' + appId)
            if (knownExe && fs.existsSync(knownExe)) {
              target = knownExe
              workingDirectory = path.dirname(knownExe)
            }
          }
        }

        // If not a direct executable, use Windows shell:AppsFolder invocation
        if (!target) {
          target = `explorer.exe shell:AppsFolder\\${appId}`
        }

        const description = guessAppDescription(name, target)

        return {
          name,
          appId,
          target,
          workingDirectory,
          icon: appId ? `app:${appId}` : undefined,
          description,
        }
      })

      attachCachedIconsToDiscoveredApps(resolved)
      cachedDiscoveredApps = resolved

      // Persist to disk cache
      try {
        const diskFile = getDiscoveredAppsCacheFile()
        if (diskFile) {
          const dir = path.dirname(diskFile)
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(diskFile, JSON.stringify(resolved), 'utf8')
        }
      } catch {}

      return resolved
    } catch (err) {
      console.error('[Main] app:discover failed:', err)
      return []
    } finally {
      discoverAppsPromise = null
    }
  })()

  return discoverAppsPromise
}

async function prewarmDiscoveredApps(): Promise<void> {
  try {
    const apps = await discoverInstalledApps()
    let updated = false
    const prioritizedKeywords = [
      'antigravity',
      'visual studio code',
      'code',
      'discord',
      'chrome',
      'zen',
      'zcode',
      'spotify',
      'steam',
      'subtitle',
      'sticky notes',
      '3b',
      '3d',
    ]

    // 1. First prewarm high-priority apps
    for (const app of apps) {
      const lower = `${app.name} ${app.appId} ${app.target}`.toLowerCase()
      if (prioritizedKeywords.some((kw) => lower.includes(kw))) {
        if (!app.iconDataUrl || isGenericShortcutIcon(app.iconDataUrl)) {
          const dataUrl = await extractWindowsAppIcon(app.appId, app.name, app.target)
          if (dataUrl && !isGenericShortcutIcon(dataUrl)) {
            app.iconDataUrl = dataUrl
            updated = true
          }
        }
      }
    }

    // 2. Prewarm the first 40 remaining apps
    let prewarmedCount = 0
    for (const app of apps) {
      if (prewarmedCount >= 40) break
      if (!app.iconDataUrl || isGenericShortcutIcon(app.iconDataUrl)) {
        const dataUrl = await extractWindowsAppIcon(app.appId, app.name, app.target)
        if (dataUrl && !isGenericShortcutIcon(dataUrl)) {
          app.iconDataUrl = dataUrl
          prewarmedCount++
          updated = true
        }
      }
    }

    // 3. Persist to disk cache so icons are saved across restarts
    if (updated) {
      try {
        const diskFile = getDiscoveredAppsCacheFile()
        if (diskFile) {
          fs.writeFileSync(diskFile, JSON.stringify(apps), 'utf8')
        }
      } catch {}
    }
  } catch {}
}

ipcMain.handle('app:discover', async () => {
  return discoverInstalledApps()
})

ipcMain.handle('app:extract-icon', async (_event, appId: string, name?: string, target?: string) => {
  const dataUrl = await extractWindowsAppIcon(appId, name, target)
  return { success: !!dataUrl, dataUrl: dataUrl || undefined }
})

ipcMain.handle('app:fetch-favicon', async (_event, url: string) => {
  const dataUrl = await fetchFavicon(url)
  return { success: !!dataUrl, dataUrl: dataUrl || undefined }
})

ipcMain.handle('icon:clear-cache', () => {
  ICON_CACHE.clear()
  NEGATIVE_ICON_CACHE.clear()
  try {
    const dir = getIconCacheDir()
    if (dir && fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, f)) } catch {}
      }
    }
    const neg = getNegativeCacheFile()
    if (neg && fs.existsSync(neg)) fs.unlinkSync(neg)
    const disc = getDiscoveredAppsCacheFile()
    if (disc && fs.existsSync(disc)) fs.unlinkSync(disc)
    cachedDiscoveredApps = null
  } catch {}
  return { success: true }
})

ipcMain.handle('clipboard:readText', async () => {
  const { clipboard } = require('electron')
  return clipboard.readText()
})

ipcMain.handle('clipboard:writeText', async (_event, text: string) => {
  const { clipboard } = require('electron')
  clipboard.writeText(text)
})

ipcMain.handle('clipboard:writeImage', async (_event, dataUrl: string) => {
  try {
    const image = nativeImage.createFromDataURL(dataUrl)
    if (image.isEmpty()) return { success: false }
    const { clipboard } = require('electron')
    clipboard.writeImage(image)
    return { success: true }
  } catch (err) {
    console.error('[Main] clipboard writeImage failed:', err)
    return { success: false }
  }
})

/* ----------------------------- Settings -------------------------------- */

ipcMain.handle('settings:get-global-shortcut-status', () => {
  return {
    registered: !globalShortcutRegistrationFailed && Boolean(currentAccelerator),
    accelerator: currentAccelerator,
    configured: getSetting<string>('globalShortcut', 'ctrl+space'),
    error: globalShortcutRegistrationFailed
      ? 'Bu kısayol başka bir uygulama tarafından kullanılıyor (Ctrl+Space geçici olarak devrede)'
      : null,
  }
})

ipcMain.handle('settings:get-settings-shortcut-status', () => {
  return {
    registered: !settingsShortcutRegistrationFailed && Boolean(settingsAccelerator),
    accelerator: settingsAccelerator,
    configured: getSetting<string>('settingsShortcut', 'ctrl+,'),
    error: settingsShortcutRegistrationFailed
      ? 'Bu kısayol başka bir uygulama tarafından kullanılıyor'
      : null,
  }
})

ipcMain.handle('settings:set-global-shortcut', (_event, input: string) => {
  const accelerator = toAccelerator(input)
  if (!accelerator) {
    return { success: false, error: 'Geçersiz kısayol kombinasyonu' }
  }
  if (accelerator === settingsAccelerator) {
    return { success: false, error: 'Ayarlar kısayolu ile çakışıyor' }
  }
  if (accelerator === screenshotAccelerator) {
    return { success: false, error: 'Ekran görüntüsü kısayolu ile çakışıyor' }
  }
  if (itemShortcuts.has(accelerator)) {
    return { success: false, error: 'Bir akış veya proje kısayolu ile çakışıyor' }
  }

  const previous = currentAccelerator
  if (previous) {
    try {
      globalShortcut.unregister(previous)
    } catch {}
  }

  let ok = false
  try {
    ok = globalShortcut.register(accelerator, () => toggleWindow())
  } catch (err) {
    console.error(`[Main] Failed to register global shortcut "${input}" (${accelerator}):`, err)
    ok = false
  }

  if (ok) {
    currentAccelerator = accelerator
    globalShortcutRegistrationFailed = false
    console.log(`[Main] Global shortcut updated: "${input}" (${accelerator})`)
    return { success: true }
  }

  console.warn(`[Main] Global shortcut "${input}" (${accelerator}) registration failed — already in use by OS or another application`)
  globalShortcutRegistrationFailed = true

  // Restore previous accelerator if possible
  if (previous) {
    try {
      const restored = globalShortcut.register(previous, () => toggleWindow())
      if (restored) {
        currentAccelerator = previous
      }
    } catch {}
  }
  return { success: false, error: 'Bu kısayol başka bir uygulama tarafından kullanılıyor' }
})

ipcMain.handle('settings:set-settings-shortcut', (_event, input: string) => {
  const accelerator = toAccelerator(input)
  if (!accelerator) {
    return { success: false, error: 'Geçersiz kısayol kombinasyonu' }
  }
  if (accelerator === currentAccelerator) {
    return { success: false, error: 'Launcher kısayolu ile çakışıyor' }
  }
  if (accelerator === screenshotAccelerator) {
    return { success: false, error: 'Ekran görüntüsü kısayolu ile çakışıyor' }
  }
  if (itemShortcuts.has(accelerator)) {
    return { success: false, error: 'Bir akış veya proje kısayolu ile çakışıyor' }
  }

  const previous = settingsAccelerator
  if (previous) {
    try {
      globalShortcut.unregister(previous)
    } catch {}
  }

  let ok = false
  try {
    ok = globalShortcut.register(accelerator, () => openSettingsViaShortcut())
  } catch (err) {
    console.error(`[Main] Failed to register settings shortcut "${input}" (${accelerator}):`, err)
    ok = false
  }

  if (ok) {
    settingsAccelerator = accelerator
    settingsShortcutRegistrationFailed = false
    console.log(`[Main] Settings shortcut updated: "${input}" (${accelerator})`)
    return { success: true }
  }

  console.warn(`[Main] Settings shortcut "${input}" (${accelerator}) registration failed — already in use by OS or another application`)
  settingsShortcutRegistrationFailed = true

  // Restore previous accelerator
  if (previous) {
    try {
      globalShortcut.register(previous, () => openSettingsViaShortcut())
    } catch {}
  }
  return { success: false, error: 'Bu kısayol başka bir uygulama tarafından kullanılıyor' }
})

ipcMain.handle('settings:get-screenshot-shortcut-status', () => {
  return {
    registered: !screenshotRegistrationFailed && Boolean(screenshotAccelerator),
    accelerator: screenshotAccelerator,
  }
})

ipcMain.handle('settings:set-screenshot-shortcut', (_event, input: string) => {
  const trimmed = String(input || '').trim()
  if (!trimmed) {
    if (screenshotAccelerator) {
      try {
        globalShortcut.unregister(screenshotAccelerator)
      } catch {
        // ignore
      }
    }
    screenshotAccelerator = ''
    screenshotRegistrationFailed = false
    return { success: true }
  }

  const accelerator = toAccelerator(trimmed)
  if (!accelerator) {
    const isSingleKey = !trimmed.includes('+') && trimmed.length > 0
    return {
      success: false,
      error: isSingleKey
        ? 'Modifiers (Ctrl/Alt/Shift) required'
        : 'Invalid shortcut',
    }
  }
  if (accelerator === currentAccelerator) {
    return { success: false, error: 'Conflicts with the launcher shortcut' }
  }
  if (accelerator === settingsAccelerator) {
    return { success: false, error: 'Conflicts with the settings shortcut' }
  }
  if (itemShortcuts.has(accelerator)) {
    return { success: false, error: 'Conflicts with an item shortcut' }
  }

  const previous = screenshotAccelerator
  if (previous) {
    try {
      globalShortcut.unregister(previous)
    } catch {
      // ignore
    }
  }

  let ok = false
  try {
    ok = globalShortcut.register(accelerator, () => {
      void startScreenshot()
    })
  } catch {
    ok = false
  }

  if (ok) {
    screenshotAccelerator = accelerator
    screenshotRegistrationFailed = false
    return { success: true }
  }

  // Restore previous accelerator
  if (previous) {
    try {
      globalShortcut.register(previous, () => {
        void startScreenshot()
      })
    } catch {
      // ignore
    }
  }
  screenshotRegistrationFailed = !screenshotAccelerator
  return { success: false, error: 'Shortcut is unavailable (already in use)' }
})

ipcMain.handle('settings:set-launch-at-login', (_event, enabled: boolean) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()],
    })
    return { success: true }
  } catch (err) {
    console.error('[Main] setLoginItemSettings failed:', err)
    return { success: false }
  }
})

ipcMain.handle('settings:get-launch-at-login', () => {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
})

ipcMain.handle('settings:set-tray', (_event, enabled: boolean) => {
  if (enabled) createTray()
  else destroyTray()
  return { success: true }
})

/* ------------------------------- Dialogs -------------------------------- */

async function showOpenDialogSafe(options: {
  title?: string
  properties: string[]
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}) {
  const parent =
    captureWin && !captureWin.isDestroyed() && captureWin.isVisible()
      ? captureWin
      : win && !win.isDestroyed() && win.isVisible()
        ? win
        : null
  if (parent) {
    return dialog.showOpenDialog(parent, options as Electron.OpenDialogOptions)
  }
  return dialog.showOpenDialog(options as Electron.OpenDialogOptions)
}

async function showSaveDialogSafe(options: {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}) {
  const parent =
    captureWin && !captureWin.isDestroyed() && captureWin.isVisible()
      ? captureWin
      : win && !win.isDestroyed() && win.isVisible()
        ? win
        : null
  if (parent) {
    return dialog.showSaveDialog(parent, options as Electron.SaveDialogOptions)
  }
  return dialog.showSaveDialog(options as Electron.SaveDialogOptions)
}

function getDefaultScreenshotDirectory(): string {
  try {
    return path.join(app.getPath('pictures'), 'Screenshots')
  } catch {
    return app.getPath('pictures')
  }
}

function getScreenshotDirectory(): string {
  const configured = getSetting<string>('screenshotDirectory', '').trim()
  if (configured) return configured
  return getDefaultScreenshotDirectory()
}

function ensureDirectoryExists(dirPath: string): void {
  const fs = require('fs')
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch (err) {
    console.error('[Main] Failed to create screenshot directory:', err)
  }
}

ipcMain.handle('settings:choose-directory', async () => {
  const currentDir = getScreenshotDirectory()
  ensureDirectoryExists(currentDir)
  const result = await showOpenDialogSafe({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: currentDir,
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

/* ------------------------------- Data ---------------------------------- */

ipcMain.handle('data:export', async () => {
  const result = await showSaveDialogSafe({
    title: 'Export Exist Flow data',
    defaultPath: path.join(app.getPath('documents'), 'exist-flow-export.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return { success: false, canceled: true }
  try {
    const fs = require('fs')
    const payload = {
      'flow-data': store.get('flow-data'),
      settings: store.get('settings'),
    }
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { success: true, filePath: result.filePath }
  } catch (err) {
    console.error('[Main] export failed:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('data:import', async () => {
  const result = await showOpenDialogSafe({
    title: 'Import Exist Flow data',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true }
  try {
    const fs = require('fs')
    const raw = fs.readFileSync(result.filePaths[0], 'utf8')
    const parsed = JSON.parse(raw)
    const flowData = parsed?.['flow-data']
    if (!flowData || !Array.isArray(flowData.items)) {
      return { success: false, error: 'Not a valid Exist Flow export' }
    }
    store.set('flow-data', flowData)
    if (parsed.settings && typeof parsed.settings === 'object') {
      store.set('settings', parsed.settings)
    }
    return { success: true }
  } catch (err) {
    console.error('[Main] import failed:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

/* ---------------------------- Screenshot ------------------------------- */

ipcMain.handle('screenshot:start', async (_event, options?: { displayId?: number | string; point?: { x: number; y: number } }) => {
  await startScreenshot(options)
  return { success: true }
})

ipcMain.handle('screenshot:get-data', () => {
  const captureCursorEnabled = getSetting<boolean>('screenshotCaptureCursor', false)
  return {
    buffer: captureJpegBuffer,
    dataUrl: captureDataUrl,
    cursor: captureCursorInfo,
    captureCursor: captureCursorEnabled,
  }
})

ipcMain.handle('screenshot:image-ready', () => {
  ipcMain.emit('screenshot:image-ready-internal')
  return { success: true }
})

ipcMain.handle('screenshot:copy', async (_event, dataUrl: string) => {
  try {
    const image = nativeImage.createFromDataURL(dataUrl)
    if (image.isEmpty()) return { success: false }
    const { clipboard } = require('electron')
    clipboard.writeImage(image)
    return { success: true }
  } catch (err) {
    console.error('[Main] screenshot copy failed:', err)
    return { success: false }
  }
})

function getScreenshotFormat(explicit?: string): 'png' | 'jpg' {
  if (explicit === 'jpg' || explicit === 'png') return explicit
  return getSetting<string>('screenshotFormat', 'png') === 'jpg' ? 'jpg' : 'png'
}

function buildScreenshotFileName(fmt: 'png' | 'jpg', when = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`
  return `Exist Flow Screenshot ${stamp}.${fmt}`
}

function uniqueScreenshotPath(directory: string, fileName: string): string {
  const fs = require('fs')
  let candidate = path.join(directory, fileName)
  if (!fs.existsSync(candidate)) return candidate
  const ext = path.extname(fileName)
  const base = fileName.slice(0, fileName.length - ext.length)
  for (let i = 2; i < 100; i++) {
    const next = path.join(directory, `${base} (${i})${ext}`)
    if (!fs.existsSync(next)) return next
  }
  return candidate
}

function writeScreenshotFile(dataUrl: string, filePath: string, fmt: 'png' | 'jpg'): void {
  const fs = require('fs')
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  let buffer: Buffer = Buffer.from(base64, 'base64')
  if (fmt === 'jpg') {
    // Overlay always crops to PNG; re-encode when the user wants JPEG
    const image = nativeImage.createFromBuffer(buffer)
    if (!image.isEmpty()) {
      const jpeg = image.toJPEG(90)
      if (jpeg) buffer = jpeg
    }
  }
  fs.writeFileSync(filePath, buffer)
}

ipcMain.handle('screenshot:save', async (_event, dataUrl: string, format?: string) => {
  const fmt = getScreenshotFormat(format)
  const directory = getScreenshotDirectory()
  ensureDirectoryExists(directory)
  const fileName = buildScreenshotFileName(fmt)

  const result = await showSaveDialogSafe({
    title: 'Save screenshot',
    defaultPath: path.join(directory, fileName),
    filters:
      fmt === 'jpg'
        ? [{ name: 'JPEG image', extensions: ['jpg', 'jpeg'] }]
        : [{ name: 'PNG image', extensions: ['png'] }],
  })
  if (result.canceled || !result.filePath) return { success: false, canceled: true }

  try {
    writeScreenshotFile(dataUrl, result.filePath, fmt)
    return { success: true, filePath: result.filePath }
  } catch (err) {
    console.error('[Main] screenshot save failed:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

// Silent auto-save: no dialog, unique name in the configured directory.
ipcMain.handle('screenshot:save-auto', (_event, dataUrl: string) => {
  try {
    const fmt = getScreenshotFormat()
    const directory = getScreenshotDirectory()
    ensureDirectoryExists(directory)
    const filePath = uniqueScreenshotPath(directory, buildScreenshotFileName(fmt))
    writeScreenshotFile(dataUrl, filePath, fmt)
    return { success: true, filePath }
  } catch (err) {
    console.error('[Main] screenshot auto-save failed:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('screenshot:cancel', () => {
  closeCapture()
  return { success: true }
})

ipcMain.handle('screenshot:complete', () => {
  closeCapture()
  return { success: true }
})
