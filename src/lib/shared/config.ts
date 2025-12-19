/**
 * Centralized Configuration Module
 *
 * Production defaults are baked in for end users.
 * Local development: Create .env.local in the CLI directory to override.
 *
 * Install: npm install -g @oaysus/cli
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Production URLs (baked in for security)
const PROD_SSO_URL = 'https://auth.oaysus.com';
const PROD_ADMIN_URL = 'https://admin.oaysus.com';
const PROD_R2_URL = 'https://pub-71eb20e9b97849f18a95eaa92feb648a.r2.dev';

/**
 * Get current file's directory (works in both ESM and CJS)
 */
function getCurrentDir(): string {
  // ESM: use import.meta.url
  // @ts-ignore - import.meta exists in ESM
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    // @ts-ignore
    return path.dirname(fileURLToPath(import.meta.url));
  }
  // CJS fallback
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return process.cwd();
}

/**
 * Find the CLI root directory (where package.json is)
 */
function findCliRoot(): string {
  let dir = getCurrentDir();

  // Walk up until we find package.json or hit root
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === '@oaysus/cli' || pkg.name === 'oaysus-cli') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

/**
 * Load .env.local if it exists
 * Returns true if .env.local was found and loaded
 * Skipped during test runs to ensure predictable test behavior
 */
function loadEnvLocal(): boolean {
  // Skip loading .env.local during tests
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
    return false;
  }

  const cliRoot = findCliRoot();
  const envLocalPath = path.join(cliRoot, '.env.local');

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
    return true;
  }

  return false;
}

// Load .env.local if present (this sets process.env values)
const _hasEnvLocal = loadEnvLocal();

/**
 * Environment configuration
 * Priority: .env.local > environment variables > production defaults
 */
export const config = {
  // Authentication server URL
  SSO_BASE_URL: process.env.NEXT_PUBLIC_OAYSUS_SSO_URL || PROD_SSO_URL,

  // Admin dashboard URL (for magic link redirects)
  ADMIN_URL: process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL || PROD_ADMIN_URL,

  // R2 CDN URL for component hosting
  R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || PROD_R2_URL,

  // Deployment environment: 'prod' | 'dev' | 'local'
  API_STAGE: process.env.NEXT_PUBLIC_API_STAGE || 'prod',

  // Developer namespace for local testing (contributors only)
  DEVELOPER: process.env.DEVELOPER,

  // Debug mode (console logging, off by default)
  DEBUG: process.env.DEBUG === 'true',

  // Credentials storage path
  CREDENTIALS_PATH: path.join(os.homedir(), '.oaysus', 'credentials.json'),

  // Config directory
  CONFIG_DIR: path.join(os.homedir(), '.oaysus'),

  // Flag indicating if .env.local was loaded
  IS_LOCAL_DEV: _hasEnvLocal,
} as const;

// Export individual values for convenience
export const {
  SSO_BASE_URL,
  ADMIN_URL,
  R2_PUBLIC_URL,
  API_STAGE,
  DEVELOPER,
  DEBUG,
  CREDENTIALS_PATH,
  CONFIG_DIR,
  IS_LOCAL_DEV,
} = config;

/**
 * Get current deployment environment
 */
export type Environment = 'local' | 'dev' | 'prod';

export function getEnvironment(): Environment {
  const stage = config.API_STAGE;

  if (stage === 'local') return 'local';
  if (stage === 'dev') return 'dev';
  if (stage === 'prod' || stage === 'production') return 'prod';

  // Default to prod for published CLI
  return 'prod';
}

/**
 * Debug logging helper
 */
export function debug(...args: unknown[]): void {
  if (config.DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Debug error logging helper
 */
export function debugError(...args: unknown[]): void {
  if (config.DEBUG) {
    console.error('[ERROR]', ...args);
  }
}
