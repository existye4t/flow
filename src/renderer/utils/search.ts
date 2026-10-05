import Fuse from 'fuse.js'
import { FlowItem, SearchResult } from '@shared/types'
import { useSettings } from '@renderer/store/settings-store'

const FUSE_KEYS = [
  { name: 'name', weight: 0.55 },
  { name: 'aliases', weight: 0.25 },
  { name: 'keywords', weight: 0.15 },
  { name: 'description', weight: 0.1 },
  { name: 'target', weight: 0.1 },
  { name: 'type', weight: 0.05 },
]

export function searchItems(items: FlowItem[], query: string): SearchResult[] {
  if (!query.trim()) {
    return items.map((item) => ({ ...item }))
  }

  const settings = useSettings.getState()
  const fuse = new Fuse(items, {
    keys: FUSE_KEYS,
    threshold: settings.fuzzySearch ? 0.35 : 0.12,
    includeScore: true,
    ignoreLocation: true,
  })

  const results = fuse.search(query)
  const mapped = results.map((result) => ({
    ...result.item,
    score: result.score ?? 1,
  }))

  return settings.maxResults > 0 ? mapped.slice(0, settings.maxResults) : mapped
}

export function formatTypeLabel(type: FlowItem['type']): string {
  const labels: Record<FlowItem['type'], string> = {
    application: 'Application',
    website: 'Website',
    file: 'File',
    folder: 'Folder',
    command: 'Command',
    action: 'Action',
  }
  return labels[type] || type
}
