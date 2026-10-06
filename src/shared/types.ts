export type FlowItemType = 'application' | 'website' | 'file' | 'folder' | 'command' | 'action'

export type IconSource =
  | { type: 'cached'; dataUrl: string; mono?: boolean; monoV?: number }
  | { type: 'url'; href: string }
  | { type: 'glyph'; name: string }

export interface Project {
  id: string
  name: string
  icon?: string
  shortcut?: string
  itemIds: string[]
  createdAt: number
  updatedAt: number
}

export interface FlowItem {
  id: string
  name: string
  type: FlowItemType
  /** undefined = never set (auto metadata may backfill); '' = user cleared it */
  description?: string
  icon?: IconSource
  /** Set when the user explicitly chose a glyph — auto icon resolution must not override. */
  iconManual?: boolean
  /** Search aliases (quicklink-style alternate names). */
  aliases?: string[]
  keywords?: string[]
  target: string
  arguments?: string[]
  workingDirectory?: string
  shortcut?: string
  favorite: boolean
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  // General
  launchAtStartup: boolean
  startMinimized: boolean
  closeToTray: boolean
  globalShortcut: string
  // Appearance
  ambientEnabled: boolean
  ambientIntensity: 'low' | 'medium' | 'high'
  animationsEnabled: boolean
  reduceMotion: boolean
  theme: 'dark' | 'oled'
  // Search
  fuzzySearch: boolean
  maxResults: number
  // Keyboard
  settingsShortcut: string
  actionShortcut: string
  showShortcutHints: boolean
  // Screenshot
  screenshotEnabled: boolean
  screenshotShortcut: string
  screenshotBehavior: 'review' | 'instant'
  screenshotAutoSave: boolean
  screenshotDirectory: string
  screenshotFormat: 'png' | 'jpg'
  screenshotCopy: boolean
  screenshotOpenEditor: boolean
  screenshotCaptureCursor: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  launchAtStartup: false,
  startMinimized: false,
  closeToTray: true,
  globalShortcut: 'ctrl+space',
  ambientEnabled: true,
  ambientIntensity: 'low',
  animationsEnabled: true,
  reduceMotion: false,
  theme: 'dark',
  fuzzySearch: true,
  maxResults: 0,
  settingsShortcut: 'ctrl+,',
  actionShortcut: 'ctrl+k',
  showShortcutHints: true,
  screenshotEnabled: true,
  screenshotShortcut: 'Print Screen',
  screenshotBehavior: 'review',
  screenshotAutoSave: true,
  screenshotDirectory: '',
  screenshotFormat: 'png',
  screenshotCopy: true,
  screenshotOpenEditor: false,
  screenshotCaptureCursor: false,
}

export interface FlowStore {
  items: FlowItem[]
  recentIds: string[]
  favorites: string[]
  projects?: Project[]
  settings: {
    launchAtStartup: boolean
    globalShortcut: string
    showRecent: boolean
    showFavorites: boolean
  }
}

export interface SearchResult extends FlowItem {
  score?: number
}

export interface ElectronAPI {
  onWindowFocus: (callback: () => void) => () => void
  hideWindow: () => Promise<void>
  showWindow: () => Promise<void>
  focusWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  store: {
    get: (key?: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  app: {
    open: (
      target: string,
      args?: string[],
      workingDirectory?: string,
      kind?: string
    ) => Promise<{ success: boolean; error?: string }>
    openElevated: (
      target: string,
      args?: string[],
      workingDirectory?: string
    ) => Promise<{ success: boolean; error?: string }>
    revealPath: (path: string) => Promise<{ success: boolean }>
    discover: () => Promise<
      {
        name: string
        appId: string
        target?: string
        workingDirectory?: string
        icon?: string
        description?: string
        iconDataUrl?: string
      }[]
    >
    fetchFavicon: (url: string) => Promise<{ success: boolean; dataUrl?: string }>
    extractIcon: (appId: string, name?: string, target?: string) => Promise<{ success: boolean; dataUrl?: string }>
  }
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<void>
    writeImage: (dataUrl: string) => Promise<{ success: boolean }>
  }
  icon: {
    clearCache: () => Promise<{ success: boolean }>
  }
  shortcuts: {
    sync: () => Promise<{ success: boolean }>
    validate: (shortcut: string, targetId?: string) => Promise<{ success: boolean; error?: string; accelerator?: string }>
  }
  settings: {
    setGlobalShortcut: (input: string) => Promise<{ success: boolean; error?: string }>
    getGlobalShortcutStatus: () => Promise<{ registered: boolean; accelerator: string; configured: string; error?: string | null }>
    setSettingsShortcut: (input: string) => Promise<{ success: boolean; error?: string }>
    getSettingsShortcutStatus: () => Promise<{ registered: boolean; accelerator: string; configured: string; error?: string | null }>
    setScreenshotShortcut: (input: string) => Promise<{ success: boolean; error?: string }>
    getScreenshotShortcutStatus: () => Promise<{ registered: boolean; accelerator: string; enabled?: boolean }>
    setScreenshotEnabled?: (enabled: boolean) => Promise<{ success: boolean }>
    setLaunchAtStartup: (enabled: boolean) => Promise<{ success: boolean }>
    getLaunchAtStartup: () => Promise<boolean>
    setTray: (enabled: boolean) => Promise<{ success: boolean }>
    chooseDirectory: () => Promise<string | null>
  }
  data: {
    exportJson: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
    importJson: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  }
  screenshot: {
    start: (options?: { displayId?: number | string; point?: { x: number; y: number } }) => Promise<{ success: boolean }>
    getData: () => Promise<{ dataUrl?: string | null; buffer?: Uint8Array | null; cursor?: { x: number; y: number } | null; captureCursor?: boolean }>
    onCaptureReady: (callback: (data: Uint8Array | string) => void) => () => void
    onReset?: (callback: () => void) => () => void
    copy: (dataUrl: string) => Promise<{ success: boolean }>
    save: (
      dataUrl: string,
      format?: string
    ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
    saveAuto: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    cancel: () => Promise<{ success: boolean }>
    complete: () => Promise<{ success: boolean }>
    imageReady?: () => Promise<{ success: boolean }>
    onBegin?: (callback: (info: { runId: number; t0: number; cursor?: { x: number; y: number } | null; captureCursor?: boolean }) => void) => () => void
    onCaptureFailed?: (callback: (info: { runId: number; reason: string }) => void) => () => void
    metric?: (runId: number, stage: string, at: number, info?: Record<string, unknown>) => void
  }
  onOpenSettings: (callback: () => void) => () => void
  onOpenProject?: (callback: (projectId: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
