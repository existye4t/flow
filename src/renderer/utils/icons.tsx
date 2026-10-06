import React from 'react'
import { FlowItem, IconSource, FlowItemType } from '@shared/types'
import { toMonochrome, getMonochromeCached, MONO_VERSION } from './monochrome'
import { getItemTargetCategory, ItemTargetCategory } from './itemCategory'

export { getItemTargetCategory }
export type { ItemTargetCategory }

export function getTypeGlyph(type: FlowItemType): string {
  switch (type) {
    case 'application':
      return 'app'
    case 'website':
      return 'globe'
    case 'file':
      return 'file'
    case 'folder':
      return 'folder'
    case 'command':
      return 'terminal'
    case 'action':
      return 'bolt'
    default:
      return 'file'
  }
}

export function getFileExtensionGlyph(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const extensionMap: Record<string, string> = {
    exe: 'exe',
    msi: 'exe',
    pdf: 'pdf',
    txt: 'txt',
    md: 'txt',
    doc: 'doc',
    docx: 'doc',
    xls: 'xls',
    xlsx: 'xls',
    csv: 'xls',
    ppt: 'ppt',
    pptx: 'ppt',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    svg: 'image',
    ico: 'image',
    zip: 'archive',
    rar: 'archive',
    '7z': 'archive',
    tar: 'archive',
    gz: 'archive',
    json: 'code',
    js: 'code',
    ts: 'code',
    tsx: 'code',
    jsx: 'code',
    html: 'code',
    css: 'code',
    scss: 'code',
    py: 'code',
    mp3: 'audio',
    wav: 'audio',
    flac: 'audio',
    ogg: 'audio',
    mp4: 'video',
    mkv: 'video',
    mov: 'video',
    avi: 'video',
    webm: 'video',
  }
  return extensionMap[ext] || 'file'
}

export function resolveIconSource(icon: IconSource | undefined): string | null {
  if (!icon) return null
  switch (icon.type) {
    case 'cached':
      return icon.dataUrl
    case 'url':
      return icon.href
    case 'glyph':
      return null
  }
}

export function createCachedIcon(dataUrl: string, mono = false, monoV?: number): IconSource {
  return { type: 'cached', dataUrl, mono: mono || undefined, monoV }
}

export function createUrlIcon(href: string): IconSource {
  return { type: 'url', href }
}

export function createGlyphIcon(name: string): IconSource {
  return { type: 'glyph', name }
}

export function getFallbackIcon(item: FlowItem): IconSource {
  if (item.type === 'file') {
    return createGlyphIcon(getFileExtensionGlyph(item.target))
  }
  return createGlyphIcon(getTypeGlyph(item.type))
}

const KNOWN_APP_ICONS: Record<string, string> = {
  'code': 'vscode',
  'code.exe': 'vscode',
  'visual studio code': 'vscode',
  'chrome': 'chrome',
  'chrome.exe': 'chrome',
  'google chrome': 'chrome',
  'zen': 'globe',
  'zen browser': 'globe',
  'zcode': 'code',
  'antigravity': 'code',
  'antigravity ide': 'code',
  'subtitle edit': 'code',
  'sticky notes': 'pencil',
  '3b görüntüleyici': 'camera',
  '3d viewer': 'camera',
  '7-zip': 'archive',
  'winrar': 'archive',
  'discord': 'discord',
  'discord.exe': 'discord',
  'github': 'github',
  'github desktop': 'github',
  'spotify': 'spotify',
  'spotify.exe': 'spotify',
  'steam': 'steam',
  'steam.exe': 'steam',
  'notion': 'notion',
  'figma': 'figma',
  'slack': 'slack',
  'slack.exe': 'slack',
  'explorer': 'folder',
  'powershell': 'terminal',
  'cmd': 'terminal',
  'terminal': 'terminal',
  'windows terminal': 'terminal',
}

export function getKnownAppGlyph(name: string, target: string): string | null {
  const normName = name.toLowerCase().trim()
  const normTarget = target.toLowerCase().trim()

  // shell:AppsFolder targets are application invocations, NEVER explorer folder
  if (normTarget.includes('shell:appsfolder')) {
    for (const [k, glyph] of Object.entries(KNOWN_APP_ICONS)) {
      if (k === 'explorer') continue
      if (normName.includes(k) || normTarget.includes(k)) return glyph
    }
    return null
  }

  const key = `${normName}|${normTarget}`
  for (const [k, glyph] of Object.entries(KNOWN_APP_ICONS)) {
    if (k === 'explorer') {
      // Only match explorer if the name is explicitly explorer or the target is strictly file explorer
      if (
        normName === 'explorer' ||
        normName === 'file explorer' ||
        normTarget === 'explorer.exe' ||
        normTarget === 'explorer'
      ) {
        return glyph
      }
      continue
    }
    if (key.includes(k)) return glyph
  }
  return null
}

interface GlyphProps {
  size?: number
  className?: string
}

const s = (props: GlyphProps) => ({
  width: props.size ?? 20,
  height: props.size ?? 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: props.className,
})

const glyphComponents: Record<string, React.FC<GlyphProps>> = {
  flow: (props) => (
    <svg {...s(props)} viewBox="0 0 16 16">
      <path
        d="M4 3v6.5a4 4 0 0 0 4 4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  app: (props) => (
    <svg {...s(props)}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  ),
  globe: (props) => (
    <svg {...s(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.3 3.2 5.2 3.2 8.5s-1 6.2-3.2 8.5c-2.2-2.3-3.2-5.2-3.2-8.5s1-6.2 3.2-8.5z" />
    </svg>
  ),
  file: (props) => (
    <svg {...s(props)}>
      <path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M13 3v5h5.5" />
    </svg>
  ),
  folder: (props) => (
    <svg {...s(props)}>
      <path d="M20 19A1.5 1.5 0 0 0 21.5 17.5v-8A1.5 1.5 0 0 0 20 8h-7.6a1.5 1.5 0 0 1-1.27-.72l-1.02-1.53A1.5 1.5 0 0 0 8.84 5H4A1.5 1.5 0 0 0 2.5 6.5v11A1.5 1.5 0 0 0 4 19h16z" />
    </svg>
  ),
  terminal: (props) => (
    <svg {...s(props)}>
      <polyline points="5 16.5 10.5 11 5 5.5" />
      <line x1="12.5" y1="18.5" x2="19" y2="18.5" />
    </svg>
  ),
  bolt: (props) => (
    <svg {...s(props)}>
      <path d="M13.5 2.5 5 13.5h5.5l-1 8L18 10.5h-5.5l1-8z" />
    </svg>
  ),
  exe: (props) => (
    <svg {...s(props)}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  ),
  keyboard: (props) => (
    <svg {...s(props)}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
    </svg>
  ),
  pdf: (props) => (
    <svg {...s(props)}>
      <path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M13 3v5h5.5" />
      <path d="M8.5 12.5h2a1.25 1.25 0 0 1 0 2.5H9.5v2.5" />
      <path d="M13 18v-5.5h1.4a1.35 1.35 0 0 1 0 2.7H13M17.5 18v-5.5" />
    </svg>
  ),
  txt: (props) => (
    <svg {...s(props)}>
      <path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M13 3v5h5.5" />
      <line x1="8.5" y1="12.5" x2="15.5" y2="12.5" />
      <line x1="8.5" y1="15.5" x2="15.5" y2="15.5" />
      <line x1="8.5" y1="18.5" x2="12" y2="18.5" />
    </svg>
  ),
  doc: (props) => (
    <svg {...s(props)}>
      <path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M13 3v5h5.5" />
      <polyline points="9 13 11 15.5 15 11" />
    </svg>
  ),
  xls: (props) => (
    <svg {...s(props)}>
      <path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M13 3v5h5.5" />
      <line x1="8.5" y1="12" x2="8.5" y2="19" />
      <line x1="12" y1="14" x2="12" y2="19" />
      <line x1="15.5" y1="11" x2="15.5" y2="19" />
    </svg>
  ),
  ppt: (props) => (
    <svg {...s(props)}>
      <path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M13 3v5h5.5" />
      <rect x="8.5" y="12" width="7" height="5" rx="0.5" />
    </svg>
  ),
  image: (props) => (
    <svg {...s(props)}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <circle cx="9.5" cy="9.5" r="1.5" />
      <path d="M20 15.5 15.5 11 6 20.5" />
    </svg>
  ),
  archive: (props) => (
    <svg {...s(props)}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M4.5 8v11a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  ),
  code: (props) => (
    <svg {...s(props)}>
      <polyline points="9 8 4 12 9 16" />
      <polyline points="15 8 20 12 15 16" />
    </svg>
  ),
  audio: (props) => (
    <svg {...s(props)}>
      <path d="M9 17V6l10-2v11" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </svg>
  ),
  video: (props) => (
    <svg {...s(props)}>
      <rect x="2.5" y="6" width="13.5" height="12" rx="1.5" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </svg>
  ),
  vscode: (props) => (
    <svg {...s(props)} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M17.5 2.1c-.4-.2-.8-.1-1.1.2L9.6 8.5 5.5 5.4c-.4-.3-1-.3-1.4 0l-2.4 1.8c-.4.3-.5.8-.3 1.2l3.4 5.6-3.4 5.6c-.2.4-.1.9.3 1.2l2.4 1.8c.4.3 1 .3 1.4 0l4.1-3.1 6.8 6.2c.3.3.7.4 1.1.2.4-.2.7-.6.7-1V3.1c0-.4-.3-.8-.7-1zm-1.8 5.7v8.4l-5-4.2 5-4.2z" />
    </svg>
  ),
  chrome: (props) => (
    <svg {...s(props)} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.75" strokeWidth="1.6" />
      <line x1="12" y1="3" x2="12" y2="8.25" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="19.8" y1="16.5" x2="15.25" y2="13.9" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4.2" y1="16.5" x2="8.75" y2="13.9" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  discord: (props) => (
    <svg {...s(props)} fill="currentColor" stroke="none">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  ),
  github: (props) => (
    <svg {...s(props)} fill="currentColor" stroke="none">
      <path d="M12 3.5a8.5 8.5 0 0 0-2.7 16.6c.4.1.6-.2.6-.4v-1.5c-2.3.5-2.8-1.1-2.8-1.1-.4-1-.95-1.26-.95-1.26-.78-.55.06-.54.06-.54.86.06 1.31.88 1.31.88.77 1.32 2 0.94 2.5 0.72.08-.56.3-.94.55-1.16-1.99-.23-4.08-1-4.08-4.44 0-.98.35-1.78.92-2.41-.1-.23-.4-1.15.09-2.4 0 0 .75-.24 2.47.92a8.6 8.6 0 0 1 4.5 0c1.72-1.16 2.47-.92 2.47-.92.49 1.25.19 2.17.1 2.4.57.63.92 1.43.92 2.41 0 3.45-2.1 4.2-4.09 4.43.31.27.59.8.59 1.6v2.37c0 .22.19.5.6.4A8.5 8.5 0 0 0 12 3.5z" />
    </svg>
  ),
  spotify: (props) => (
    <svg {...s(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 9.5c2.8-0.7 5.9-0.4 8 1" />
      <path d="M8.7 12.3c2.2-0.5 4.5-0.3 6.4 0.8" />
      <path d="M9 15c1.8-0.4 3.5-0.2 5 0.6" />
    </svg>
  ),
  steam: (props) => (
    <svg {...s(props)}>
      <circle cx="16.5" cy="7.5" r="2.5" />
      <circle cx="8.5" cy="15.5" r="3.5" />
      <path d="M11.8 13.4l5-4.7" />
      <path d="M13.2 17.6l4.4.8 3.9-11.4-4.4-0.8" />
    </svg>
  ),
  notion: (props) => (
    <svg {...s(props)}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M8.5 16.5v-8l7 8v-8" />
    </svg>
  ),
  figma: (props) => (
    <svg {...s(props)}>
      <circle cx="15.5" cy="12" r="2.75" />
      <path d="M5.5 4.25A2.75 2.75 0 0 1 8.25 1.5h4A2.75 2.75 0 1 1 12.25 7h-4A2.75 2.75 0 0 1 5.5 4.25z" />
      <path d="M5.5 9.25A2.75 2.75 0 0 1 8.25 6.5h4A2.75 2.75 0 1 1 12.25 12h-4a2.75 2.75 0 0 1-2.75-2.75z" />
      <path d="M8.25 14.5a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z" />
    </svg>
  ),
  slack: (props) => (
    <svg {...s(props)}>
      <path d="M8 3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0v4H4.5a1.5 1.5 0 1 1 0-3H8z" />
      <path d="M20.5 8a1.5 1.5 0 1 1 0 3h-4V6.5a1.5 1.5 0 1 1 3 0V8z" />
      <path d="M16 20.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0v-4h4.5a1.5 1.5 0 1 1 0 3H16z" />
      <path d="M3.5 16a1.5 1.5 0 1 1 0-3h4v4.5a1.5 1.5 0 1 1-3 0V16z" />
    </svg>
  ),
  gear: (props) => (
    <svg {...s(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  camera: (props) => (
    <svg {...s(props)}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5l1.7-2.5h5.6L16.5 6H20a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="3.75" />
    </svg>
  ),
  star: (props) => (
    <svg {...s(props)}>
      <path d="m12 3.5 2.7 5.48 6.05.88-4.38 4.27 1.03 6.03L12 17.25l-5.4 2.91 1.03-6.03L3.25 9.86l6.05-.88z" />
    </svg>
  ),
  pencil: (props) => (
    <svg {...s(props)}>
      <path d="M14.5 4.5l5 5L8 21H3v-5L14.5 4.5z" />
    </svg>
  ),
  copy: (props) => (
    <svg {...s(props)}>
      <rect x="9" y="9" width="12.5" height="12.5" rx="2" />
      <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
    </svg>
  ),
  folderOpen: (props) => (
    <svg {...s(props)}>
      <path d="M3.5 6A1.5 1.5 0 0 1 5 4.5h4.2a1.5 1.5 0 0 1 1.2.6l1.1 1.5H19a1.5 1.5 0 0 1 1.5 1.5v1.4" />
      <path d="M2.7 18.9 5.5 12h16.1l-2.6 6.2a1.5 1.5 0 0 1-1.4 1H4.1a1.4 1.4 0 0 1-1.4-1.7z" />
      <path d="M4.3 10.5A1.5 1.5 0 0 1 5.8 9H21a1 1 0 0 1 .95 1.32l-2.2 5.9" />
    </svg>
  ),
  shield: (props) => (
    <svg {...s(props)}>
      <path d="M12 3l7 2.4V11c0 4.4-2.9 7.9-7 9.5-4.1-1.6-7-5.1-7-9.5V5.4z" />
      <path d="m9.3 11.7 1.9 1.9 3.5-3.9" />
    </svg>
  ),
  trash: (props) => (
    <svg {...s(props)}>
      <path d="M4 6.5h16M9.5 6.5V4.75A1.25 1.25 0 0 1 10.75 3.5h2.5a1.25 1.25 0 0 1 1.25 1.25V6.5M6.5 6.5l1 13A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5l1-13" />
    </svg>
  ),
  external: (props) => (
    <svg {...s(props)}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  ),
  check: (props) => (
    <svg {...s(props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  download: (props) => (
    <svg {...s(props)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  x: (props) => (
    <svg {...s(props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  arrowLeft: (props) => (
    <svg {...s(props)}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
}

export function IconGlyph({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  const G = glyphComponents[name] || glyphComponents.file
  return <G size={size} className={`text-flow-secondary ${className}`} />
}

/* ------------------ Item Type Target Icons (Tour 17) ------------------ */

export function AppTypeIcon({ size = 13.5, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Uygulama"
    >
      <title>Uygulama</title>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
    </svg>
  )
}

export function WebsiteTypeIcon({ size = 13.5, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Web sitesi"
    >
      <title>Web sitesi</title>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.3 3.2 5.2 3.2 8.5s-1 6.2-3.2 8.5c-2.2-2.3-3.2-5.2-3.2-8.5s1-6.2 3.2-8.5z" />
    </svg>
  )
}

export function FolderTypeIcon({ size = 13.5, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Klasör"
    >
      <title>Klasör</title>
      <path d="M20 19A1.5 1.5 0 0 0 21.5 17.5v-8A1.5 1.5 0 0 0 20 8h-7.6a1.5 1.5 0 0 1-1.27-.72l-1.02-1.53A1.5 1.5 0 0 0 8.84 5H4A1.5 1.5 0 0 0 2.5 6.5v11A1.5 1.5 0 0 0 4 19h16z" />
    </svg>
  )
}

export function ItemTypeIcon({
  item,
  size = 13.5,
  className = '',
}: {
  item: { type?: string; kind?: string; target?: string }
  size?: number
  className?: string
}) {
  const category = getItemTargetCategory(item)
  const combinedClass = `flex-shrink-0 text-flow-muted ${className}`.trim()
  switch (category) {
    case 'website':
      return <WebsiteTypeIcon size={size} className={combinedClass} />
    case 'folder':
      return <FolderTypeIcon size={size} className={combinedClass} />
    case 'app':
    default:
      return <AppTypeIcon size={size} className={combinedClass} />
  }
}

export function IconRenderer({
  icon,
  item,
  size = 28,
  className = '',
}: {
  icon?: IconSource
  item: FlowItem
  size?: number
  className?: string
}) {
  const resolvedSrc = resolveIconSource(icon)
  const isGeneric = Boolean(
    resolvedSrc &&
      (resolvedSrc.length < 200 ||
        resolvedSrc.includes('AAAB4UlEQVRYhe2WSy8DURTH') ||
        resolvedSrc.includes('AAAB5UlEQVRYhe') ||
        resolvedSrc.includes('AAAByUlEQVRYhe1WQUoDQRCs2UTwEBS8R') ||
        resolvedSrc.includes('Ah9JREFUWEftV8lOAkEQ'))
  )
  const known = getKnownAppGlyph(item.name, item.target)
  const fallback = getFallbackIcon(item)
  const fallbackName = known || (fallback.type === 'glyph' ? fallback.name : 'file')
  // Final (current pipeline) monochrome icon
  const isCurrentMono =
    icon?.type === 'cached' && icon.mono === true && (icon.monoV ?? 1) >= MONO_VERSION
  // Legacy (v1) monochrome icon: show it while the v2 upgrade resolves,
  // so no glyph flashes in between
  const isLegacyMono = icon?.type === 'cached' && icon.mono === true && !isCurrentMono

  const [monoSrc, setMonoSrc] = React.useState<string | null>(() => {
    if (!resolvedSrc || isGeneric) return null
    if (isCurrentMono || isLegacyMono) return resolvedSrc
    return getMonochromeCached(resolvedSrc)
  })
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    setFailed(false)
    if (!resolvedSrc || isGeneric) {
      setMonoSrc(null)
      return
    }
    if (isCurrentMono) {
      setMonoSrc(resolvedSrc)
      return
    }
    if (isLegacyMono) {
      // safety net (e.g. iconManual items): re-process the stored v1 image
      // with the v2 pipeline while previewing the old one
      let alive = true
      toMonochrome(resolvedSrc).then((out) => {
        if (alive && out) setMonoSrc(out)
      })
      return () => {
        alive = false
      }
    }
    const hit = getMonochromeCached(resolvedSrc)
    if (hit) {
      setMonoSrc(hit)
      return
    }
    let alive = true
    setMonoSrc(null)
    toMonochrome(resolvedSrc).then((out) => {
      if (!alive) return
      if (out) setMonoSrc(out)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [resolvedSrc, isCurrentMono, isLegacyMono, isGeneric])

  const showImage = Boolean(monoSrc) && !failed && !isGeneric

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {showImage && (
        <img
          src={monoSrc!}
          alt=""
          width={size}
          height={size}
          className="rounded-[4px] flow-icon"
          onError={() => setFailed(true)}
          style={{ objectFit: 'contain' }}
        />
      )}
      {!showImage && <IconGlyph name={fallbackName} size={size} />}
    </div>
  )
}

const EXTRACTION_ALIASES: Record<string, string> = {
  'vs code': 'Visual Studio Code',
  'vscode': 'Visual Studio Code',
  'github': 'GitHub Desktop',
  'explorer': 'File Explorer',
}

async function extractOriginalIcon(item: FlowItem): Promise<string | null> {
  if (!window.electron) return null
  try {
    if (item.type === 'application') {
      if (item.target.includes('shell:AppsFolder')) {
        const appId = item.target.split('shell:AppsFolder\\')[1]
        if (appId) {
          const res = await window.electron.app.extractIcon(appId, item.name, item.target)
          if (res.success && res.dataUrl) return res.dataUrl
        }
      } else if (item.target.includes('/') || item.target.includes('\\')) {
        const res = await window.electron.app.extractIcon(item.target, item.name, item.target)
        if (res.success && res.dataUrl) return res.dataUrl
      } else {
        const alias = EXTRACTION_ALIASES[item.name.toLowerCase()]
        const res = await window.electron.app.extractIcon(alias || item.name, item.name, item.target)
        if (res.success && res.dataUrl) return res.dataUrl
      }
    }
    if (item.type === 'website') {
      const res = await window.electron.app.fetchFavicon(item.target)
      if (res.success && res.dataUrl) return res.dataUrl
    }
  } catch {
    // silent fallback
  }
  return null
}

const toMonoIcon = async (dataUrl: string): Promise<IconSource | undefined> => {
  const mono = await toMonochrome(dataUrl)
  return mono ? createCachedIcon(mono, true, MONO_VERSION) : undefined
}

/**
 * Resolve icon for any FlowItem, fetching real icons where possible.
 * - application: tries Windows extraction via IPC (Start Menu shortcut / shell:AppsFolder)
 * - website: fetches favicon via IPC
 * Every fetched raster is converted to monochrome (MONO_VERSION) before it
 * is returned, so colored logos are never surfaced. Legacy stored icons
 * (v1 monochrome or colored) are upgraded: the ORIGINAL is re-extracted
 * first (restores logo identity), otherwise the stored raster is
 * re-processed. Returns undefined when no usable monochrome source could
 * be produced (caller falls back to glyph).
 */
export async function resolveFlowItemIcon(item: FlowItem): Promise<IconSource | undefined> {
  if (!window.electron) return item.icon

  // User explicitly chose this icon (or the glyph) — never auto-override
  if (item.iconManual) return item.icon

  if (item.icon && item.icon.type === 'cached') {
    // Check if the cached icon was the corrupt generic Windows shortcut icon
    const isCorruptGeneric =
      Boolean(
        item.icon.dataUrl &&
        item.icon.dataUrl.includes('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB4UlEQVRYhe2WSy8DURTH')
      )
    if (isCorruptGeneric) {
      const original = await extractOriginalIcon(item)
      if (original) return await toMonoIcon(original)
      return undefined
    }

    const current = item.icon.mono === true && (item.icon.monoV ?? 1) >= MONO_VERSION
    if (current) return item.icon
    // Legacy stored icon: restore the original raster where possible,
    // otherwise re-process what we have through the current pipeline
    const original = await extractOriginalIcon(item)
    if (original) return await toMonoIcon(original)
    return await toMonoIcon(item.icon.dataUrl)
  }

  if (item.icon && item.icon.type !== 'glyph') return item.icon

  const original = await extractOriginalIcon(item)
  if (original) return await toMonoIcon(original)

  return item.icon
}