export const joinUrlSegments = (...segments: string[]): string => {
  return segments.map((segment, index) => {
    if (index === 0) {
      // First segment: remove trailing slash
      return segment.replace(/\/+$/, '')
    } else if (index === segments.length - 1) {
      // Last segment: remove leading slash
      return segment.replace(/^\/+/, '')
    } else {
      // Middle segments: remove both leading and trailing slashes
      return segment.replace(/^\/+|\/+$/g, '')
    }
  }).filter(Boolean).join('/')
}
