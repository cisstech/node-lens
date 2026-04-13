/**
 * Pure utility functions for pattern matching
 */

import { AutoTraceOptions, NestProviderInfo } from "../types"

/**
 * Check if a name matches any of the provided glob patterns
 * @param name - The name to test
 * @param patterns - Array of glob patterns (supports * and ?)
 * @returns true if name matches any pattern
 */
export function matchesGlobPatterns(name: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern === '*') return true

    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    )
    return regex.test(name)
  })
}

/**
 * Check if a name should be included based on include/exclude patterns
 * @param name - The name to test
 * @param includePatterns - Patterns to include
 * @param excludePatterns - Patterns to exclude (takes precedence)
 * @returns true if name should be included
 */
export function shouldIncludeByPatterns(
  name: string,
  includePatterns: string[],
  excludePatterns: string[]
): boolean {
  // Check exclusions first (they take precedence)
  if (matchesGlobPatterns(name, excludePatterns)) {
    return false
  }

  // Check inclusions
  return matchesGlobPatterns(name, includePatterns)
}


export function shouldTraceProvider(providerName: string, providerType: NestProviderInfo['type'], options?: AutoTraceOptions): boolean {
  if (!options?.enabled) return false;
  if (!options.providerTypes?.includes(providerType)) return false;

  // Check exclusions first
  if (matchesGlobPatterns(providerName, options.excludeProviders || [])) {
    return false;
  }

  // Check inclusions
  return matchesGlobPatterns(providerName, options.includeProviders || []);
}

export function shouldTraceMethod(methodName: string, options?: AutoTraceOptions): boolean {
  if (!options?.enabled) return false;

  // Check exclusions first
  if (matchesGlobPatterns(methodName, options.excludeMethods || [])) {
    return false;
  }

  // Check inclusions
  return matchesGlobPatterns(methodName, options.includeMethods || []);
}
