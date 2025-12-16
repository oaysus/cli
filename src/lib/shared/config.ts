/**
 * Centralized Configuration Module
 *
 * Production defaults are baked in for end users.
 * Contributors can override via environment variables or .env file.
 *
 * Install: npm install -g @oaysus/cli
 */

import os from 'os';
import path from 'path';

// Production URLs (baked in for security)
const PROD_SSO_URL = 'https://auth.oaysus.com';
const PROD_ADMIN_URL = 'https://admin.oaysus.com';
const PROD_R2_URL = 'https://pub-71eb20e9b97849f18a95eaa92feb648a.r2.dev';

/**
 * Environment configuration
 * Environment variables override production defaults for development
 */
export const config = {
  // Authentication server URL
  SSO_BASE_URL: process.env.NEXT_PUBLIC_OAYSUS_SSO_URL || PROD_SSO_URL,

  // Admin dashboard URL (for magic link redirects)
  ADMIN_URL: process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL || PROD_ADMIN_URL,

  // R2 CDN URL for component hosting
  R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || PROD_R2_URL,

  // Deployment environment: 'prod' | 'dev' | 'local'
  API_STAGE: process.env.NEXT_PUBLIC_API_STAGE || (process.env.NODE_ENV === 'production' ? 'prod' : 'prod'),

  // Developer namespace for local testing (contributors only)
  DEVELOPER: process.env.DEVELOPER,

  // Debug mode (console logging, off by default)
  DEBUG: process.env.DEBUG === 'true',

  // Credentials storage path
  CREDENTIALS_PATH: path.join(os.homedir(), '.oaysus', 'credentials.json'),

  // Config directory
  CONFIG_DIR: path.join(os.homedir(), '.oaysus'),
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
