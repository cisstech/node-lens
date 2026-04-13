import { AppInfo } from '@cisstech/node-lens-server';
import type { VersioningInfo } from '../types';
import { NestApplication, NestVersioning, VersioningType } from './nest-types';

/**
 * Extract versioning information from NestJS application
 * @param appInfo - The running application detected by Node Lens
 * @returns Versioning configuration or undefined
 */
export function extractVersioningInfo(appInfo: AppInfo): VersioningInfo | undefined {
  const nestApp = appInfo.nestApp;
  if (!nestApp) {
    return undefined
  }

  try {
    const { config } = nestApp as unknown as NestApplication
    const globalPrefix = config.getGlobalPrefix()
    const versioning = config.getVersioning?.()

    return {
      globalPrefix,
      versioning: versioning ? {
        enabled: true,
        defaultVersion: normalizeVersions(versioning.defaultVersion),
        ...mapVersioningType(versioning)
      } : {
        enabled: false
      }
    }
  } catch (error) {
    console.warn('[IntrospectionPlugin] Error extracting versioning info:', error)
    return undefined
  }
}

/**
 * Normalize version format to string or string array
 */
function normalizeVersions(version: string | string[] | undefined): string | string[] | undefined {
  if (!version) return undefined

  if (Array.isArray(version)) {
    return version.map(String)
  }

  return version.toString()
}

/**
 * Map NestJS versioning type to our format
 */
function mapVersioningType(versioning: NestVersioning) {
  switch (versioning.type) {
    case VersioningType.URI:
      return {
        type: 'URI' as const,
        uriPrefix: versioning.prefix === false ? '' : versioning.prefix || 'v'
      }
    case VersioningType.HEADER:
      return {
        type: 'HEADER' as const,
        headerName: versioning.header || ''
      }
    case VersioningType.MEDIA_TYPE:
      return {
        type: 'MEDIA_TYPE' as const,
        mediaTypeKey: versioning.key || ''
      }
    default:
      return {
        type: 'CUSTOM' as const
      }
  }
}
