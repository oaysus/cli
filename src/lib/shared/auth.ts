import axios from 'axios';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import type { Credentials, DeviceCodeResponse, DeviceStatusResponse } from '../../types/index.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from monorepo env file
// Use absolute path from monorepo root
// From dist/lib/shared/ we need to go up 4 levels to reach mono/ root
const monoRepoRoot = path.resolve(__dirname, '../../../../');
const envPath = path.join(monoRepoRoot, 'config/env/.env.personal.oaysus');

// Try to load env file, but don't fail if it doesn't exist (for production)
try {
  if (fsSync.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch (error) {
  // Silently ignore env loading errors in production
}

// Debug logging toggle - set to false to hide debug output
const DEBUG = false;

const SSO_BASE_URL = process.env.NEXT_PUBLIC_OAYSUS_SSO_URL || 'https://auth.oaysus.com';
const CREDENTIALS_PATH = path.join(os.homedir(), '.oaysus', 'credentials.json');

function log(...args: any[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

function logError(...args: any[]) {
  if (DEBUG) {
    console.error(...args);
  }
}

/**
 * Request magic link for email authentication with device code
 */
export async function requestMagicLink(email: string, deviceCode: string): Promise<void> {
  const url = `${SSO_BASE_URL}/sso/customer/auth/magic-link`;
  const dashboardUrl = process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL || 'http://local-admin.oaysus.com';
  const redirectUrl = `${dashboardUrl}/device?code=${deviceCode}`;

  log('[DEBUG] Requesting magic link');
  log('[DEBUG] API URL:', url);
  log('[DEBUG] Email:', email);
  log('[DEBUG] Redirect URL:', redirectUrl);

  try {
    const response = await axios.post(url, {
      email,
      redirectUrl
    });

    log('[DEBUG] Magic link response:', response.data);

    // Magic link is sent via email (not returned in response for security)
    if (response.data.success) {
      return;
    }

    throw new Error(response.data.message || 'Failed to send magic link');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError('[ERROR] Magic link request failed');
      logError('[ERROR] Status:', error.response?.status);
      logError('[ERROR] Response:', error.response?.data);
      throw new Error(error.response?.data?.message || 'Failed to send magic link');
    }
    throw error;
  }
}

/**
 * Generate random device code for polling
 */
export function generateDeviceCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate human-readable user code (ABCD-1234 format)
 */
export function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part1}-${part2}`;
}

/**
 * Initialize device authorization request
 */
export async function initializeDevice(): Promise<DeviceCodeResponse> {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();

  const url = `${SSO_BASE_URL}/sso/cli/device/init`;

  log('[DEBUG] Initializing device authorization');
  log('[DEBUG] API URL:', url);
  log('[DEBUG] Device Code:', deviceCode);
  log('[DEBUG] User Code:', userCode);

  try {
    const response = await axios.post(url, {
      deviceCode,
      userCode,
      clientInfo: {
        version: '0.1.0',
        os: os.platform(),
        hostname: os.hostname()
      }
    });

    log('[DEBUG] Response status:', response.status);
    log('[DEBUG] Response data:', response.data);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError('[ERROR] Request failed');
      logError('[ERROR] URL:', url);
      logError('[ERROR] Status:', error.response?.status);
      logError('[ERROR] Response:', error.response?.data);
      logError('[ERROR] Message:', error.message);
    }
    throw error;
  }
}

/**
 * Select website for device authorization
 */
export async function selectWebsite(deviceCode: string, websiteId: string): Promise<void> {
  const url = `${SSO_BASE_URL}/sso/cli/device/select-website`;

  log('[DEBUG] Selecting website');
  log('[DEBUG] API URL:', url);
  log('[DEBUG] Device Code:', deviceCode);
  log('[DEBUG] Website ID:', websiteId);

  try {
    const response = await axios.post(url, {
      deviceCode,
      websiteId
    });

    log('[DEBUG] Select website response:', response.data);

    if (response.data.success) {
      return;
    }

    throw new Error(response.data.message || 'Failed to select website');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logError('[ERROR] Select website failed');
      logError('[ERROR] Status:', error.response?.status);
      logError('[ERROR] Response:', error.response?.data);
      throw new Error(error.response?.data?.error || 'Failed to select website');
    }
    throw error;
  }
}

/**
 * Poll for device authorization status
 * Returns DeviceStatusResponse which may include needsWebsiteSelection flag
 */
export async function pollForAuth(
  deviceCode: string,
  options: { interval: number; timeout: number }
): Promise<Credentials | DeviceStatusResponse> {
  const startTime = Date.now();

  while (true) {
    // Check timeout
    if (Date.now() - startTime > options.timeout) {
      throw new Error('Authentication timeout - please try again');
    }

    try {
      const response = await axios.get<DeviceStatusResponse>(
        `${SSO_BASE_URL}/sso/cli/device/status`,
        { params: { deviceCode } }
      );

      const data = response.data;

      // Device approved but needs website selection
      if (data.status === 'approved' && data.needsWebsiteSelection && data.websites) {
        log('[DEBUG] Device approved - needs website selection');
        log('[DEBUG] Available websites:', data.websites);
        return data; // Return response with websites list
      }

      // Device approved with JWT - authentication complete
      if (data.status === 'approved' && data.jwt) {
        log('[DEBUG] Device approved - JWT received');
        // Calculate expiry
        const expiresAt = new Date(Date.now() + (data.expiresIn || 604800) * 1000).toISOString();

        return {
          jwt: data.jwt,
          userId: data.userId!,
          email: data.email!,
          websiteId: data.websiteId!,
          websiteName: data.websiteName,
          subdomain: data.subdomain,
          platforms: data.platforms || ['oaysus', 'hosting'],
          expiresAt
        };
      }

      if (data.status === 'denied') {
        throw new Error('Authorization denied by user');
      }

      if (data.status === 'expired') {
        throw new Error('Authorization code expired');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, options.interval));

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error('Authorization request not found or expired');
      }
      if (error instanceof Error && error.message.includes('denied')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('expired')) {
        throw error;
      }
      // Continue polling on other errors
      await new Promise(resolve => setTimeout(resolve, options.interval));
    }
  }
}

/**
 * Save credentials to local file
 */
export async function saveCredentials(credentials: Credentials): Promise<void> {
  const credentialsDir = path.dirname(CREDENTIALS_PATH);

  // Create .oaysus directory if it doesn't exist
  await fs.mkdir(credentialsDir, { recursive: true });

  // Write credentials
  await fs.writeFile(
    CREDENTIALS_PATH,
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 }  // Owner read/write only
  );
}

/**
 * Load credentials from local file
 */
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const data = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Clear credentials file
 */
export async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(CREDENTIALS_PATH);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

/**
 * Check if user is authenticated with valid token
 */
export async function isAuthenticated(): Promise<boolean> {
  const credentials = await loadCredentials();

  if (!credentials) {
    return false;
  }

  // Check if token expired
  const expiresAt = new Date(credentials.expiresAt);
  const now = new Date();

  return expiresAt > now;
}

/**
 * Get credentials or throw error if not authenticated
 */
export async function requireAuth(): Promise<Credentials> {
  const credentials = await loadCredentials();

  if (!credentials) {
    throw new Error('Not authenticated. Run: oaysus login');
  }

  // Check expiry
  const expiresAt = new Date(credentials.expiresAt);
  const now = new Date();

  if (expiresAt <= now) {
    throw new Error('Token expired. Run: oaysus login');
  }

  return credentials;
}
