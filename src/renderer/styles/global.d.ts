export {}

declare global {
  namespace React {
    interface CSSProperties {
      WebkitAppRegion?: 'no-drag' | 'drag'
    }
  }
}
