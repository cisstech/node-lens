/**
 * Formatting utilities for database traces
 */

/**
 * Format milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(1)}ms` : `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format metadata value for display
 */
export function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value.toString()
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : '[]'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60 * 1000) {
    return `${Math.floor(diff / 1000)}s ago`
  }

  if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}m ago`
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}h ago`
  }

  return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`
}

/**
 * Format a number with appropriate units (K, M, B)
 */
export function formatCount(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`
  if (count < 1_000_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  return `${(count / 1_000_000_000).toFixed(1)}B`
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Calculate timeline position as percentage
 */
export function calculateTimelinePosition(
  itemStart: number,
  itemEnd: number,
  totalStart: number,
  totalEnd: number
): { left: number; width: number } {
  const totalDuration = totalEnd - totalStart
  if (totalDuration <= 0) return { left: 0, width: 0 }

  const left = Math.max(0, Math.min(100, ((itemStart - totalStart) / totalDuration) * 100))
  const right = Math.max(left, Math.min(100, ((itemEnd - totalStart) / totalDuration) * 100))
  const width = right - left

  return { left, width }
}
