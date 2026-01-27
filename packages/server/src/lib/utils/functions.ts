/* eslint-disable @typescript-eslint/no-explicit-any */
export const getFunctionName = (fn: (...args: any[]) => any): string => {
  if (!fn) return 'anonymous'

  // Try to get constructor name for class methods
  if (fn.constructor && fn.constructor.name !== 'Function') {
    return fn.constructor.name
  }

  // Get function name
  if (fn.name) {
    return fn.name
  }

  // Try to extract from string representation
  const fnStr = fn.toString()
  const match = fnStr.match(/function\s+([^(]+)/)
  if (match) {
    return match[1]
  }

  // Check for arrow function or class method
  const arrowMatch = fnStr.match(/^\s*(?:async\s+)?(?:([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>|([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\()/)
  if (arrowMatch) {
    return arrowMatch[1] || arrowMatch[2]
  }

  return 'anonymous'
}
