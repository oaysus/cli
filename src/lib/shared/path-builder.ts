/**
 * R2 Path Builder
 * Constructs environment-aware R2 paths for component theme uploads
 */

import type { PackageJson } from '../../types/validation.js';
import type { Credentials } from '../../types/index.js';
import { getEnvironment, DEVELOPER } from './config.js';

// Re-export Environment type from config
export type { Environment } from './config.js';

/**
 * Metadata for upload paths and tracking
 */
export interface UploadMetadata {
  environment: 'local' | 'dev' | 'prod';
  developer?: string;
  websiteId: string;
  themeName: string;
  displayName: string;
  version: string;
  r2Path: string;
  importMap?: Record<string, any>;
  stylesheets?: Record<string, string>;
  dependencies?: Array<{ name: string; version: string }>;
}

/**
 * Build R2 base path for component theme upload
 *
 * Path structure (base path without filename):
 * - Local:  local/{developer}/{websiteId}/{themeName}/{version}
 * - Dev:    dev/{websiteId}/{themeName}/{version}
 * - Prod:   prod/{websiteId}/{themeName}/{version}
 *
 * Build files are appended to this base path:
 * - {basePath}/index.js
 * - {basePath}/index.css
 * - {basePath}/metadata.json
 */
export function buildR2Path(
  packageJson: PackageJson,
  credentials: Credentials
): string {
  const env = getEnvironment();
  const websiteId = credentials.websiteId;
  const themeName = packageJson.oaysus?.theme?.name || packageJson.name;
  const version = packageJson.version;

  // Local environment includes developer namespace
  if (env === 'local') {
    const developer = DEVELOPER || 'unknown';
    return `local/${developer}/${websiteId}/${themeName}/${version}`;
  }

  // Dev and prod have same structure (no developer)
  return `${env}/${websiteId}/${themeName}/${version}`;
}

/**
 * Build complete upload metadata
 */
export function buildUploadMetadata(
  packageJson: PackageJson,
  credentials: Credentials,
  options?: {
    importMap?: Record<string, any>;
    stylesheets?: Record<string, string>;
    dependencies?: Array<{ name: string; version: string }>;
  }
): UploadMetadata {
  const env = getEnvironment();
  const r2Path = buildR2Path(packageJson, credentials);
  const themeName = packageJson.oaysus?.theme?.name || packageJson.name;
  const displayName = packageJson.oaysus?.theme?.displayName || themeName;

  return {
    environment: env,
    developer: env === 'local' ? DEVELOPER : undefined,
    websiteId: credentials.websiteId,
    themeName,
    displayName,
    version: packageJson.version,
    r2Path,
    importMap: options?.importMap,
    stylesheets: options?.stylesheets,
    dependencies: options?.dependencies
  };
}

/**
 * Get base path for theme (without version)
 */
export function getThemeBasePath(
  packageJson: PackageJson,
  credentials: Credentials
): string {
  const env = getEnvironment();
  const websiteId = credentials.websiteId;
  const themeName = packageJson.oaysus?.theme?.name || packageJson.name;

  if (env === 'local') {
    const developer = DEVELOPER || 'unknown';
    return `local/${developer}/${websiteId}/${themeName}`;
  }

  return `${env}/${websiteId}/${themeName}`;
}
