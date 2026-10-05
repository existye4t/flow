import { useEffect } from 'react'
import { useFlowStore } from '@renderer/store/flow-store'
import { useSettings } from '@renderer/store/settings-store'
import { FlowItem } from '@shared/types'
import { DEFAULT_ITEMS } from '@renderer/data/default-items'
import { lookupKnownApp } from '@renderer/data/known-apps'
import { resolveFlowItemIcon, createCachedIcon } from '@renderer/utils/icons'

/** One-time migration: the default Screenshot action now runs the built-in capture overlay. */
function migrateItem(item: FlowItem): FlowItem {
  const haystack = `${item.target} ${(item.arguments || []).join(' ')}`
  if (item.id === 'default-6' && haystack.includes('SendWait')) {
    return {
      ...item,
      name: 'Take Screenshot',
      description: 'Capture a region of the screen',
      keywords: ['screenshot', 'capture', 'snip', 'screen'],
      target: 'flow:screenshot',
      arguments: [],
    }
  }
  return item
}

/**
 * Backfill smart metadata for items that never had a description.
 * Only `undefined` descriptions are touched — an empty string means the
 * user deliberately cleared it and must never be overwritten.
 */
function backfillMetadata(item: FlowItem): FlowItem {
  if (item.description !== undefined) return item
  const known = lookupKnownApp(item.name, item.target)
  if (!known) return item
  return { ...item, description: known.description }
}

export function useDataLoader() {
  const setItems = useFlowStore((s) => s.setItems)
  const setRecentIds = useFlowStore((s) => s.setRecentIds)
  const setFavorites = useFlowStore((s) => s.setFavorites)
  const setProjects = useFlowStore((s) => s.setProjects)
  const markLoaded = useFlowStore((s) => s.markLoaded)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!window.electron) return

      try {
        void useSettings.getState().load()

        const data = await window.electron.store.get()
        if (cancelled) return

        const root = data as Record<string, unknown> | undefined
        const storeData =
          (root?.['flow-data'] as
            | { items?: FlowItem[]; recentIds?: string[]; favorites?: string[]; projects?: any[]; iconCache?: Record<string, string> }
            | undefined) ||
          (root as
            | { items?: FlowItem[]; recentIds?: string[]; favorites?: string[]; projects?: any[]; iconCache?: Record<string, string> }
            | undefined)
        const storedItems = storeData?.items || []
        const iconCache = (root?.['iconCache'] as Record<string, string> | undefined) || storeData?.iconCache

        // Restore projects
        const storedProjects = Array.isArray(storeData?.projects) ? storeData.projects : []
        setProjects(storedProjects)

        let baseItems: FlowItem[]
        if (storedItems.length === 0) {
          baseItems = DEFAULT_ITEMS
          const defaultFavorites = DEFAULT_ITEMS
            .filter((item) => item.favorite)
            .map((item) => item.id)
          setFavorites(defaultFavorites)
        } else {
          const recentIds = storeData?.recentIds || []
          const favorites = storeData?.favorites || []
          // favorites[] is the source of truth — normalize stale item flags
          baseItems = storedItems.map((item) =>
            item.favorite === favorites.includes(item.id)
              ? item
              : { ...item, favorite: favorites.includes(item.id) }
          )
          setRecentIds(recentIds)
          setFavorites(favorites)
        }

        // Migration + local metadata backfill (never overwrites user edits)
        baseItems = baseItems.map((item) => backfillMetadata(migrateItem(item)))

        // Restore cached icons first (instant paint), then fetch missing ones
        const restored = baseItems.map((item) => {
          const cachedUrl = iconCache?.[item.id]
          return cachedUrl ? { ...item, icon: createCachedIcon(cachedUrl, true) } : item
        })
        setItems(restored)
        markLoaded()

        // Resolve real icons in background (Windows app icons / favicons)
        // in small batches (max 2 concurrent) to prevent IPC or GPU storms.
        const newCache: Record<string, string> = { ...(iconCache || {}) }
        let cacheDirty = false
        const resolved: Array<{ id: string; icon: any }> = []
        const BATCH_SIZE = 2

        for (let i = 0; i < restored.length; i += BATCH_SIZE) {
          if (cancelled) break
          const chunk = restored.slice(i, i + BATCH_SIZE)
          const chunkResults = await Promise.all(
            chunk.map(async (item) => {
              const icon = await resolveFlowItemIcon(item)
              if (icon && icon.type === 'cached' && newCache[item.id] !== icon.dataUrl) {
                newCache[item.id] = icon.dataUrl
                cacheDirty = true
              }
              return { id: item.id, icon }
            })
          )
          resolved.push(...chunkResults)
        }
        if (cacheDirty && !cancelled) window.electron.store.set('iconCache', newCache)
        if (!cancelled) {
          // Merge resolved icons into the CURRENT store items — never overwrite
          // the snapshot from load time (the user may have edited/toggled/deleted
          // items while the slow icon extraction was still running).
          const iconById = new Map(resolved.map((r) => [r.id, r.icon]))
          const current = useFlowStore.getState().items
          const merged = current.map((item) => {
            const icon = iconById.get(item.id)
            return icon ? { ...item, icon } : item
          })
          setItems(merged)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        setItems(DEFAULT_ITEMS)
        markLoaded()
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [setItems, setRecentIds, setFavorites, markLoaded])
}
