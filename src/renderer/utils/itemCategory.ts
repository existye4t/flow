export type ItemTargetCategory = 'app' | 'website' | 'folder'

/**
 * Detects the target category (app / website / folder) of an item
 * based on its fields (type, kind, target).
 *
 * Requirements:
 * - Target starts with http:// or https:// -> Web
 * - Target is a directory path or type is folder -> Klasör
 * - Target is .exe, application path, command, or type is application -> Uygulama
 */
export function getItemTargetCategory(item: {
  type?: string
  kind?: string
  target?: string
}): ItemTargetCategory {
  const target = (item.target || '').trim()
  const lowerTarget = target.toLowerCase()
  const rawType = (item.type || item.kind || '').toLowerCase().trim()

  // 1. Web URLs
  if (
    lowerTarget.startsWith('http://') ||
    lowerTarget.startsWith('https://') ||
    lowerTarget.startsWith('www.')
  ) {
    return 'website'
  }

  // 2. Explicit types
  if (rawType === 'website') {
    return 'website'
  }
  if (rawType === 'folder') {
    return 'folder'
  }

  // 3. Folder target paths
  if (
    lowerTarget.endsWith('\\') ||
    lowerTarget.endsWith('/') ||
    /^[a-zA-Z]:[\\/]?$/.test(lowerTarget) ||
    lowerTarget.startsWith('shell:personal') ||
    lowerTarget.startsWith('shell:my computer')
  ) {
    return 'folder'
  }

  // 4. Explicit application/command types
  if (rawType === 'application' || rawType === 'command' || rawType === 'action') {
    return 'app'
  }

  // 5. Application executables and Windows app targets
  if (
    lowerTarget.endsWith('.exe') ||
    lowerTarget.endsWith('.lnk') ||
    lowerTarget.endsWith('.bat') ||
    lowerTarget.endsWith('.cmd') ||
    lowerTarget.endsWith('.msi') ||
    lowerTarget.endsWith('.ps1') ||
    lowerTarget.startsWith('shell:appsfolder')
  ) {
    return 'app'
  }

  // 6. If rawType is file, check if target has no file extension and contains slashes (likely a directory path)
  if (
    rawType === 'file' &&
    !lowerTarget.includes('.') &&
    (lowerTarget.includes('\\') || lowerTarget.includes('/'))
  ) {
    return 'folder'
  }

  // Default to application
  return 'app'
}
