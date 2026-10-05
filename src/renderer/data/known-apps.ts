// Local known-application database — description + keyword metadata
// generated entirely offline from executable names / app names.

export interface KnownApp {
  /** Lowercase matchers: bare name, exe filename, common aliases. */
  match: string[]
  description: string
  keywords: string[]
}

const KNOWN_APPS: KnownApp[] = [
  { match: ['code', 'code.exe', 'visual studio code', 'vscode', 'vs code'], description: 'Code editor', keywords: ['editor', 'development', 'microsoft', 'ide'] },
  { match: ['chrome', 'chrome.exe', 'google chrome'], description: 'Web browser', keywords: ['browser', 'web', 'google', 'internet'] },
  { match: ['msedge', 'msedge.exe', 'microsoft edge', 'edge'], description: 'Web browser', keywords: ['browser', 'web', 'microsoft', 'internet'] },
  { match: ['firefox', 'firefox.exe', 'mozilla firefox'], description: 'Web browser', keywords: ['browser', 'web', 'mozilla', 'internet'] },
  { match: ['brave', 'brave.exe', 'brave browser'], description: 'Web browser', keywords: ['browser', 'web', 'privacy'] },
  { match: ['discord', 'discord.exe'], description: 'Communication', keywords: ['chat', 'gaming', 'voice', 'community'] },
  { match: ['github', 'github desktop', 'githubdesktop.exe'], description: 'Development platform', keywords: ['git', 'code', 'repository', 'version control'] },
  { match: ['steam', 'steam.exe'], description: 'Game launcher', keywords: ['games', 'store', 'valve', 'gaming'] },
  { match: ['spotify', 'spotify.exe'], description: 'Music streaming', keywords: ['music', 'audio', 'playlists'] },
  { match: ['slack', 'slack.exe'], description: 'Team communication', keywords: ['chat', 'work', 'teams', 'messages'] },
  { match: ['notion', 'notion.exe'], description: 'Notes and workspace', keywords: ['notes', 'docs', 'wiki', 'productivity'] },
  { match: ['figma', 'figma.exe'], description: 'Design tool', keywords: ['design', 'ui', 'prototype', 'graphics'] },
  { match: ['explorer', 'explorer.exe', 'file explorer'], description: 'File manager', keywords: ['files', 'folders', 'windows'] },
  { match: ['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'], description: 'Command shell', keywords: ['terminal', 'shell', 'commands', 'microsoft'] },
  { match: ['cmd', 'cmd.exe', 'command prompt'], description: 'Command shell', keywords: ['terminal', 'shell', 'dos'] },
  { match: ['windowsterminal', 'windowsterminal.exe', 'windows terminal'], description: 'Terminal emulator', keywords: ['terminal', 'shell', 'console'] },
  { match: ['obsidian', 'obsidian.exe'], description: 'Knowledge base', keywords: ['notes', 'markdown', 'knowledge'] },
  { match: ['postman', 'postman.exe'], description: 'API client', keywords: ['api', 'http', 'rest', 'development'] },
  { match: ['docker', 'docker.exe', 'docker desktop'], description: 'Container platform', keywords: ['containers', 'devops', 'development'] },
  { match: ['git', 'git.exe'], description: 'Version control', keywords: ['git', 'repository', 'development'] },
  { match: ['node', 'node.exe', 'nodejs'], description: 'JavaScript runtime', keywords: ['javascript', 'node', 'development', 'runtime'] },
  { match: ['snippingtool', 'snippingtool.exe', 'snipping tool'], description: 'Screen capture', keywords: ['screenshot', 'capture', 'snip'] },
  { match: ['calculator', 'calculator.exe'], description: 'Calculator', keywords: ['math', 'numbers'] },
  { match: ['whatsapp', 'whatsapp.exe'], description: 'Messaging', keywords: ['chat', 'messages', 'mobile'] },
  { match: ['telegram', 'telegram.exe'], description: 'Messaging', keywords: ['chat', 'messages'] },
  { match: ['vlc', 'vlc.exe', 'vlc media player'], description: 'Media player', keywords: ['video', 'player', 'media'] },
  { match: ['itunes', 'itunes.exe'], description: 'Media player', keywords: ['music', 'apple', 'media'] },
  { match: ['blender', 'blender.exe'], description: '3D creation suite', keywords: ['3d', 'modeling', 'graphics'] },
  { match: ['photoshop', 'photoshop.exe', 'adobe photoshop'], description: 'Image editor', keywords: ['photos', 'design', 'adobe'] },
  { match: ['premiere', 'adobe premiere', 'premiere pro'], description: 'Video editor', keywords: ['video', 'editing', 'adobe'] },
  { match: ['outlook', 'outlook.exe', 'microsoft outlook'], description: 'Email client', keywords: ['email', 'mail', 'calendar', 'microsoft'] },
  { match: ['teams', 'teams.exe', 'microsoft teams'], description: 'Team communication', keywords: ['chat', 'meetings', 'work', 'microsoft'] },
  { match: ['zoom', 'zoom.exe'], description: 'Video meetings', keywords: ['meetings', 'video', 'call'] },
  { match: ['wireshark', 'wireshark.exe'], description: 'Network analyzer', keywords: ['network', 'packets', 'debugging'] },
  { match: ['sqlservermsms', 'ssms.exe', 'sql server management studio'], description: 'Database manager', keywords: ['sql', 'database', 'microsoft'] },
  { match: ['dbeaver', 'dbeaver.exe'], description: 'Database manager', keywords: ['sql', 'database', 'development'] },
  { match: ['androidstudio', 'androidstudio.exe'], description: 'Android IDE', keywords: ['android', 'mobile', 'development', 'ide'] },
  { match: ['jetbrains toolbox', 'toolbox.exe'], description: 'IDE manager', keywords: ['jetbrains', 'ide', 'development'] },
  { match: ['epicgameslauncher', 'epicgameslauncher.exe', 'epic games launcher', 'epic games'], description: 'Game launcher', keywords: ['games', 'store', 'epic'] },
  { match: ['battle.net', 'battle.net.exe'], description: 'Game launcher', keywords: ['games', 'blizzard'] },
  { match: ['zen', 'zen browser', 'zen.exe'], description: 'Web browser', keywords: ['browser', 'web', 'internet', 'zen'] },
  { match: ['zcode', 'zcode.exe'], description: 'Code editor', keywords: ['code', 'editor', 'ide', 'development'] },
  { match: ['antigravity', 'antigravity ide', 'antigravity.exe', 'anti gravity'], description: 'AI code editor', keywords: ['ai', 'code', 'ide', 'google'] },
  { match: ['subtitle edit', 'subtitleedit.exe', 'subtitleedit', 'nikse.subtitleedit5'], description: 'Subtitle editor', keywords: ['subtitles', 'video', 'editor'] },
  { match: ['7-zip', '7z', '7zfm.exe', '7z.exe'], description: 'File archiver', keywords: ['zip', 'archive', 'compression'] },
  { match: ['winrar', 'winrar.exe'], description: 'File archiver', keywords: ['rar', 'archive', 'zip'] },
  { match: ['sticky notes', 'microsoft sticky notes', 'stickynotes'], description: 'Notes', keywords: ['notes', 'memo', 'microsoft'] },
  { match: ['3b görüntüleyici', '3d viewer', 'microsoft 3d viewer'], description: '3D viewer', keywords: ['3d', 'model', 'viewer', 'microsoft'] },
  { match: ['notepad', 'notepad.exe', 'not defteri'], description: 'Text editor', keywords: ['text', 'notes', 'editor'] },
  { match: ['word', 'winword.exe', 'microsoft word'], description: 'Document editor', keywords: ['docs', 'office', 'microsoft'] },
  { match: ['excel', 'excel.exe', 'microsoft excel'], description: 'Spreadsheet', keywords: ['sheets', 'data', 'office', 'microsoft'] },
  { match: ['powerpoint', 'powerpnt.exe', 'microsoft powerpoint'], description: 'Presentation', keywords: ['slides', 'office', 'microsoft'] },
  { match: ['paint', 'mspaint.exe', 'paint 3d'], description: 'Image editor', keywords: ['draw', 'image', 'photo'] },
  { match: ['taskmgr', 'taskmgr.exe', 'task manager', 'görev yöneticisi'], description: 'System monitor', keywords: ['system', 'processes', 'cpu'] },
  { match: ['settings', 'ayarlar', 'system settings'], description: 'System settings', keywords: ['preferences', 'config', 'windows'] },
  { match: ['cursor', 'cursor.exe'], description: 'Code editor', keywords: ['code', 'ai', 'editor'] },
  { match: ['windsurf', 'windsurf.exe'], description: 'Code editor', keywords: ['code', 'ai', 'editor'] },
  { match: ['sublime text', 'sublime_text.exe'], description: 'Text editor', keywords: ['code', 'text', 'editor'] },
  { match: ['opera', 'opera.exe', 'opera gx', 'opera gx browser'], description: 'Web browser', keywords: ['browser', 'web', 'internet', 'gaming'] },
  { match: ['xmedia recode', 'xmedia recode.exe', 'xmedia recode 64bit'], description: 'Media converter', keywords: ['video', 'audio', 'converter'] },
  { match: ['adobe media encoder', 'adobe media encoder.exe', 'adobe media encoder 2024'], description: 'Media encoder', keywords: ['video', 'export', 'adobe'] },
  { match: ['after effects', 'aftereffects.exe', 'adobe after effects', 'adobe after effects 2023', 'adobe after effects 2024', 'adobe after effects 2025'], description: 'Motion graphics & VFX', keywords: ['after effects', 'adobe', 'video', 'editing', 'motion graphics', 'vfx', 'compositing', 'animation'] },
  { match: ['illustrator', 'illustrator.exe', 'adobe illustrator'], description: 'Vector graphics editor', keywords: ['vector', 'graphics', 'adobe', 'illustration', 'design', 'drawing'] },
  { match: ['davinci resolve', 'resolve.exe', 'davinci'], description: 'Video editing & color', keywords: ['video', 'editing', 'color grading', 'blackmagic', 'resolve'] },
  { match: ['unreal engine', 'unrealeditor.exe', 'unreal'], description: 'Game engine & 3D', keywords: ['unreal', 'epic', 'game engine', '3d', 'development'] },
  { match: ['unity', 'unity.exe', 'unity hub'], description: 'Game engine', keywords: ['unity', 'game engine', '3d', 'development'] },
  { match: ['audacity', 'audacity.exe'], description: 'Audio editor', keywords: ['audio', 'sound', 'recording', 'music'] },
  { match: ['fl studio', 'fl64.exe', 'fl.exe'], description: 'Digital audio workstation', keywords: ['daw', 'music', 'beats', 'audio', 'production'] },
  { match: ['ableton', 'ableton live.exe', 'live.exe'], description: 'Digital audio workstation', keywords: ['daw', 'music', 'audio', 'production', 'live'] },
]

function normalize(value: string): string {
  return value.toLowerCase().trim()
}

/** Extract a comparable key from a target (exe filename or bare command). */
function targetKey(target: string): string {
  const cleaned = target.replace(/^file:\/\//, '').trim()
  const parts = cleaned.split(/[\\/]/)
  const last = parts[parts.length - 1] || cleaned
  return normalize(last)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Look up known-app metadata from the item name / target.
 * Fully local — no network, no AI. Returns null when unknown.
 * Pass 1: exact matchers (name or exe filename).
 * Pass 2: whole-word matchers (handles "Visual Studio Code" etc.).
 */
export function lookupKnownApp(name: string, target: string): KnownApp | null {
  const nameKey = normalize(name)
  const exeKey = targetKey(target)
  const isShellAppsFolder = target.toLowerCase().includes('shell:appsfolder')

  for (const app of KNOWN_APPS) {
    if (isShellAppsFolder && app.match.includes('explorer')) {
      if (nameKey !== 'file explorer' && nameKey !== 'explorer') continue
    }
    for (const matcher of app.match) {
      if (nameKey === matcher || exeKey === matcher) return app
    }
  }

  for (const app of KNOWN_APPS) {
    if (isShellAppsFolder && app.match.includes('explorer')) {
      if (nameKey !== 'file explorer' && nameKey !== 'explorer') continue
    }
    for (const matcher of app.match) {
      const pattern = new RegExp(`\\b${escapeRegExp(matcher)}\\b`)
      if (pattern.test(nameKey) || pattern.test(exeKey)) return app
    }
  }
  return null
}

/**
 * Get a concise 1-4 word description for any application.
 * 1. Known app database
 * 2. Smart local heuristics based on name/target keywords
 * 3. Generic fallback "Windows application"
 */
export function getSmartAppDescription(name: string, target: string): string {
  const known = lookupKnownApp(name, target)
  if (known?.description) return known.description

  const lower = `${name} ${target}`.toLowerCase()

  if (/\b(browser|web|internet)\b/i.test(lower)) return 'Web browser'
  if (/\b(code|editor|ide|dev|studio)\b/i.test(lower)) return 'Code editor'
  if (/\b(motion|compositing|effects|vfx)\b/i.test(lower)) return 'Motion graphics & VFX'
  if (/\b(player|media|video|audio|music)\b/i.test(lower)) return 'Media player'
  if (/\b(archive|zip|unzip|rar|tar|7z)\b/i.test(lower)) return 'File archiver'
  if (/\b(game|games|launcher|steam|epic|riot)\b/i.test(lower)) return 'Game launcher'
  if (/\b(viewer|g\u00f6r\u00fcnt\u00fcleyici)\b/i.test(lower)) return 'Viewer'
  if (/\b(chat|messenger|voice|meet|call|communication)\b/i.test(lower)) return 'Communication'
  if (/\b(note|notes|memo|defter)\b/i.test(lower)) return 'Notes & documents'
  if (/\b(photo|image|paint|draw|design|vector|illustrat)\b/i.test(lower)) return 'Creative design tool'
  if (/\b(terminal|shell|console|prompt|powershell)\b/i.test(lower)) return 'Command shell'
  if (/\b(cleaner|utility|driver|tool|benchmark)\b/i.test(lower)) return 'System utility'

  return 'Windows application'
}

/**
 * Extract clean, portable keywords for an application:
 * 1. Known app database keywords
 * 2. Meaningful tokens derived from app name and executable name
 */
export function getSmartAppKeywords(name: string, target: string): string[] {
  const known = lookupKnownApp(name, target)
  if (known?.keywords && known.keywords.length > 0) {
    return [...known.keywords]
  }

  const tokens = new Set<string>()
  const cleanExe = targetKey(target).replace(/\.exe$/i, '')
  const words = `${name} ${cleanExe}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !['and', 'for', 'the', 'app', 'exe'].includes(w))

  for (const w of words) {
    tokens.add(w)
  }

  return Array.from(tokens).slice(0, 8)
}
