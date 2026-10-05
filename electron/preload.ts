import { contextBridge, ipcRenderer } from 'electron'

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
    getScreenshotShortcutStatus: () => Promise<{ registered: boolean; accelerator: string }>
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
    getData: () => Promise<{ dataUrl?: string | null; buffer?: Uint8Array | null; cursor?: { x: number; y: number } | null }>
    onCaptureReady: (callback: (data: Uint8Array | string) => void) => () => void
    onReset?: (callback: () => void) => () => void
    copy: (dataUrl: string) => Promise<{ success: boolean }>
    save: (dataUrl: string, format?: string) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
    saveAuto: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    cancel: () => Promise<{ success: boolean }>
    complete: () => Promise<{ success: boolean }>
    imageReady: () => Promise<{ success: boolean }>
    onBegin: (callback: (info: { runId: number; t0: number; cursor?: { x: number; y: number } | null }) => void) => () => void
    onCaptureFailed: (callback: (info: { runId: number; reason: string }) => void) => () => void
    metric: (runId: number, stage: string, at: number, info?: Record<string, unknown>) => void
  }
  onOpenSettings: (callback: () => void) => () => void
  onOpenProject: (callback: (projectId: string) => void) => () => void
}

const api: ElectronAPI = {
  onWindowFocus: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('window:focus', listener)
    return () => {
      ipcRenderer.removeListener('window:focus', listener)
    }
  },
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  showWindow: () => ipcRenderer.invoke('window:show'),
  focusWindow: () => ipcRenderer.invoke('window:focus'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
  },
  app: {
    open: (target, args, workingDirectory, kind) =>
      ipcRenderer.invoke('app:open', target, args, workingDirectory, kind),
    openElevated: (target, args, workingDirectory) =>
      ipcRenderer.invoke('app:open-elevated', target, args, workingDirectory),
    revealPath: (path) => ipcRenderer.invoke('app:reveal', path),
    discover: () => ipcRenderer.invoke('app:discover'),
    fetchFavicon: (url) => ipcRenderer.invoke('app:fetch-favicon', url),
    extractIcon: (appId, name, target) => ipcRenderer.invoke('app:extract-icon', appId, name, target),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
    writeImage: (dataUrl) => ipcRenderer.invoke('clipboard:writeImage', dataUrl),
  },
  icon: {
    clearCache: () => ipcRenderer.invoke('icon:clear-cache'),
  },
  shortcuts: {
    sync: () => ipcRenderer.invoke('shortcuts:sync'),
    validate: (shortcut: string, targetId?: string) => ipcRenderer.invoke('shortcuts:validate', shortcut, targetId),
  },
  settings: {
    setGlobalShortcut: (input) => ipcRenderer.invoke('settings:set-global-shortcut', input),
    getGlobalShortcutStatus: () => ipcRenderer.invoke('settings:get-global-shortcut-status'),
    setSettingsShortcut: (input) => ipcRenderer.invoke('settings:set-settings-shortcut', input),
    getSettingsShortcutStatus: () => ipcRenderer.invoke('settings:get-settings-shortcut-status'),
    setScreenshotShortcut: (input) => ipcRenderer.invoke('settings:set-screenshot-shortcut', input),
    getScreenshotShortcutStatus: () => ipcRenderer.invoke('settings:get-screenshot-shortcut-status'),
    setLaunchAtStartup: (enabled) => ipcRenderer.invoke('settings:set-launch-at-login', enabled),
    getLaunchAtStartup: () => ipcRenderer.invoke('settings:get-launch-at-login'),
    setTray: (enabled) => ipcRenderer.invoke('settings:set-tray', enabled),
    chooseDirectory: () => ipcRenderer.invoke('settings:choose-directory'),
  },
  data: {
    exportJson: () => ipcRenderer.invoke('data:export'),
    importJson: () => ipcRenderer.invoke('data:import'),
  },
  screenshot: {
    start: (options?: { displayId?: number | string; point?: { x: number; y: number } }) =>
      ipcRenderer.invoke('screenshot:start', options),
    getData: () => ipcRenderer.invoke('screenshot:get-data'),
    onCaptureReady: (callback) => {
      const listener = (_event: unknown, data: Uint8Array | string) => callback(data)
      ipcRenderer.on('screenshot:capture-ready', listener)
      return () => {
        ipcRenderer.removeListener('screenshot:capture-ready', listener)
      }
    },
    onReset: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('screenshot:reset', listener)
      return () => {
        ipcRenderer.removeListener('screenshot:reset', listener)
      }
    },
    copy: (dataUrl) => ipcRenderer.invoke('screenshot:copy', dataUrl),
    save: (dataUrl, format) => ipcRenderer.invoke('screenshot:save', dataUrl, format),
    saveAuto: (dataUrl) => ipcRenderer.invoke('screenshot:save-auto', dataUrl),
    cancel: () => ipcRenderer.invoke('screenshot:cancel'),
    complete: () => ipcRenderer.invoke('screenshot:complete'),
    imageReady: () => ipcRenderer.invoke('screenshot:image-ready'),
    onBegin: (callback) => {
      const listener = (
        _event: unknown,
        info: { runId: number; t0: number; cursor?: { x: number; y: number } | null; captureCursor?: boolean }
      ) => callback(info)
      ipcRenderer.on('screenshot:begin', listener)
      return () => {
        ipcRenderer.removeListener('screenshot:begin', listener)
      }
    },
    onCaptureFailed: (callback) => {
      const listener = (_event: unknown, info: { runId: number; reason: string }) => callback(info)
      ipcRenderer.on('screenshot:capture-failed', listener)
      return () => {
        ipcRenderer.removeListener('screenshot:capture-failed', listener)
      }
    },
    metric: (runId, stage, at, info) => ipcRenderer.send('screenshot:metric', { runId, stage, at, info }),
  },
  onOpenSettings: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:open-settings', listener)
    return () => {
      ipcRenderer.removeListener('app:open-settings', listener)
    }
  },
  onOpenProject: (callback: (projectId: string) => void) => {
    const listener = (_event: unknown, projectId: string) => callback(projectId)
    ipcRenderer.on('app:open-project', listener)
    return () => {
      ipcRenderer.removeListener('app:open-project', listener)
    }
  },
}

contextBridge.exposeInMainWorld('electron', api)
