import { create } from 'zustand'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

interface SettingsState extends AppSettings {
  isSettingsLoaded: boolean
  load: () => Promise<void>
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  reset: () => void
}

function persist(settings: AppSettings) {
  if (!window.electron) return
  void window.electron.store.set('settings', settings)
}

function pick(state: SettingsState): AppSettings {
  const { isSettingsLoaded: _loaded, load: _load, set: _set, reset: _reset, ...settings } = state
  void _loaded
  void _load
  void _set
  void _reset
  return settings as AppSettings
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isSettingsLoaded: false,

  load: async () => {
    if (!window.electron) {
      set({ isSettingsLoaded: true })
      return
    }
    try {
      const stored = (await window.electron.store.get('settings')) as Partial<AppSettings> | undefined
      if (stored) {
        set({ ...DEFAULT_SETTINGS, ...stored, isSettingsLoaded: true })
      } else {
        set({ isSettingsLoaded: true })
      }
    } catch {
      set({ isSettingsLoaded: true })
    }
  },

  set: (key, value) => {
    const patch = { [key]: value } as unknown as Partial<SettingsState>
    set(patch)
    persist(pick(get()))
  },

  reset: () => {
    set({ ...DEFAULT_SETTINGS })
    persist(pick(get()))
  },
}))
