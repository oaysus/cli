/**
 * R2 Path Builder
 * Constructs environment-aware R2 paths for component theme uploads
 */

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import type { PackageJson } from '../../types/validation.js';
import type { Credentials } from '../../types/index.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from monorepo env file
const envPath = path.join(__dirname, '../../../config/env/.env.personal.oaysus');
dotenv.config({ path: envPath });

export type Environment = 'local' | 'dev' | 'prod';

/**
 * Metadata for upload paths and tracking
 */
export interface UploadMetadata {
  environment: Environment;
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
 * Get current deployment environment
 */
export function getEnvironment(): Environment {
  const stage = process.env.NEXT_PUBLIC_API_STAGE;

  if (stage === 'local') return 'local';
  if (stage === 'dev') return 'dev';
  if (stage === 'prod' || stage === 'production') return 'prod';

  // Fallback based on NODE_ENV
  return process.env.NODE_ENV === 'production' ? 'prod' : 'local';
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
    const developer = process.env.DEVELOPER || 'unknown';
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
    developer: env === 'local' ? process.env.DEVELOPER : undefined,
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
    const developer = process.env.DEVELOPER || 'unknown';
    return `local/${developer}/${websiteId}/${themeName}`;
  }

  return `${env}/${websiteId}/${themeName}`;
}
