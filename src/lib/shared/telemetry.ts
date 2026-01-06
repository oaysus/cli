/**
 * CLI Telemetry Module
 *
 * Tracks anonymous usage data to help improve the Oaysus CLI.
 * Users can opt out via:
 *   - Command: oaysus telemetry disable
 *   - Env var: OAYSUS_TELEMETRY_DISABLED=1
 *   - Config file: ~/.oaysus/config.json -> telemetryEnabled: false
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { CONFIG_DIR, SSO_BASE_URL, IS_LOCAL_DEV, debug as log, debugError as logError } from './config.js';
import { loadCredentials } from './auth.js';

// GA4 is handled server-side in FastAPI to keep credentials secure
// Events sent to our backend are automatically forwarded to GA4

// Telemetry config file path
const TELEMETRY_CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Event queue for batching
let eventQueue: TelemetryEvent[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_QUEUE_SIZE = 10; // Flush when queue reaches this size

/**
 * Telemetry event structure
 */
export interface TelemetryEvent {
  eventName: string;
  cliVersion: string;
  timestamp?: string;
  userId?: string;
  email?: string;
  websiteId?: string;
  nodeVersion?: string;
  osPlatform?: string;
  osArch?: string;
  command?: string;
  success?: string;
  durationMs?: number;
  errorType?: string;
  errorMessage?: string;
  properties?: Record<string, unknown>;
}

/**
 * Telemetry configuration stored in ~/.oaysus/config.json
 */
interface TelemetryConfig {
  telemetryEnabled: boolean;
  telemetryNoticeShown: boolean;
}

/**
 * Load telemetry configuration from disk
 */
async function loadTelemetryConfig(): Promise<TelemetryConfig> {
  try {
    const data = await fs.readFile(TELEMETRY_CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Default config: enabled with notice not shown
    return {
      telemetryEnabled: true,
      telemetryNoticeShown: false,
    };
  }
}

/**
 * Save telemetry configuration to disk
 */
async function saveTelemetryConfig(config: TelemetryConfig): Promise<void> {
  const configDir = path.dirname(TELEMETRY_CONFIG_PATH);

  // Create config directory if it doesn't exist
  await fs.mkdir(configDir, { recursive: true });

  // Write config
  await fs.writeFile(
    TELEMETRY_CONFIG_PATH,
    JSON.stringify(config, null, 2),
    { mode: 0o600 }
  );
}

/**
 * Check if telemetry is enabled
 * Priority: Env var > Config file > Default (enabled)
 */
export async function isTelemetryEnabled(): Promise<boolean> {
  // Check environment variable first (highest priority)
  if (process.env.OAYSUS_TELEMETRY_DISABLED === '1' ||
      process.env.OAYSUS_TELEMETRY_DISABLED === 'true') {
    return false;
  }

  // Check config file
  const config = await loadTelemetryConfig();
  return config.telemetryEnabled;
}

/**
 * Enable or disable telemetry
 */
export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  const config = await loadTelemetryConfig();
  config.telemetryEnabled = enabled;
  await saveTelemetryConfig(config);
}

/**
 * Check if the telemetry notice has been shown
 */
export async function hasSeenTelemetryNotice(): Promise<boolean> {
  const config = await loadTelemetryConfig();
  return config.telemetryNoticeShown;
}

/**
 * Mark the telemetry notice as shown
 */
export async function markTelemetryNoticeShown(): Promise<void> {
  const config = await loadTelemetryConfig();
  config.telemetryNoticeShown = true;
  await saveTelemetryConfig(config);
}

/**
 * Get telemetry status for display
 */
export async function getTelemetryStatus(): Promise<{
  enabled: boolean;
  noticeShown: boolean;
  envDisabled: boolean;
}> {
  const envDisabled = process.env.OAYSUS_TELEMETRY_DISABLED === '1' ||
                      process.env.OAYSUS_TELEMETRY_DISABLED === 'true';
  const config = await loadTelemetryConfig();

  return {
    enabled: !envDisabled && config.telemetryEnabled,
    noticeShown: config.telemetryNoticeShown,
    envDisabled,
  };
}

/**
 * Get current CLI version from package.json
 */
async function getCliVersion(): Promise<string> {
  try {
    // Try to find package.json relative to this file
    const possiblePaths = [
      path.join(import.meta.dirname || __dirname || process.cwd(), '../../package.json'),
      path.join(import.meta.dirname || __dirname || process.cwd(), '../../../package.json'),
      path.join(process.cwd(), 'package.json'),
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const data = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(data);
        if (pkg.name === '@oaysus/cli' || pkg.name === 'oaysus-cli') {
          return pkg.version || '0.0.0';
        }
      } catch {
        continue;
      }
    }

    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Track a telemetry event (queued for batching)
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  // Check if telemetry is enabled
  const enabled = await isTelemetryEnabled();
  if (!enabled) {
    return;
  }

  try {
    // Get user context if logged in
    const credentials = await loadCredentials();
    const cliVersion = await getCliVersion();

    const event: TelemetryEvent = {
      eventName,
      cliVersion,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      osPlatform: os.platform(),
      osArch: os.arch(),
      properties,
    };

    // Add user context if available
    if (credentials) {
      event.userId = credentials.userId;
      event.email = credentials.email;
      event.websiteId = credentials.websiteId;
    }

    // Add to queue
    eventQueue.push(event);

    // Flush if queue is full
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      await flushEvents();
    } else if (!flushTimeout) {
      // Set up delayed flush
      flushTimeout = setTimeout(() => {
        flushEvents().catch(() => {
          // Silently ignore flush errors
        });
      }, FLUSH_INTERVAL_MS);
    }
  } catch (error) {
    // Silently ignore telemetry errors - never interrupt user flow
    log('[TELEMETRY] Error tracking event:', error);
  }
}

/**
 * Track a CLI command execution
 */
export async function trackCommand(
  command: string,
  options?: {
    success?: boolean;
    durationMs?: number;
    errorType?: string;
    errorMessage?: string;
    properties?: Record<string, unknown>;
  }
): Promise<void> {
  const enabled = await isTelemetryEnabled();
  if (!enabled) {
    return;
  }

  try {
    const credentials = await loadCredentials();
    const cliVersion = await getCliVersion();

    const event: TelemetryEvent = {
      eventName: 'cli_command',
      cliVersion,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      osPlatform: os.platform(),
      osArch: os.arch(),
      command,
      success: options?.success !== undefined ? String(options.success) : undefined,
      durationMs: options?.durationMs,
      errorType: options?.errorType,
      errorMessage: options?.errorMessage,
      properties: options?.properties,
    };

    // Add user context if available
    if (credentials) {
      event.userId = credentials.userId;
      event.email = credentials.email;
      event.websiteId = credentials.websiteId;
    }

    // Add to queue
    eventQueue.push(event);

    // Flush if queue is full
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      await flushEvents();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        flushEvents().catch(() => {});
      }, FLUSH_INTERVAL_MS);
    }
  } catch (error) {
    log('[TELEMETRY] Error tracking command:', error);
  }
}

/**
 * Flush all queued events to the backend
 * GA4 forwarding is handled server-side to keep credentials secure
 */
export async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) {
    return;
  }

  // Clear timeout
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Get events to send and clear queue
  const eventsToSend = [...eventQueue];
  eventQueue = [];

  // Send to FastAPI backend (which forwards to GA4 server-side)
  await sendToBackend(eventsToSend);
}

/**
 * Send events to FastAPI backend
 */
async function sendToBackend(events: TelemetryEvent[]): Promise<void> {
  try {
    const baseUrl = SSO_BASE_URL.replace('/sso', '').replace('auth.', 'api.');

    // For local dev, use localhost
    const apiUrl = IS_LOCAL_DEV
      ? 'http://localhost:3003/oaysus/cli-telemetry/events'
      : `${baseUrl}/oaysus/cli-telemetry/events`;

    log('[TELEMETRY] Sending to backend:', apiUrl);

    await axios.post(apiUrl, { events }, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    log('[TELEMETRY] Successfully sent to backend');
  } catch (error) {
    // Log but don't throw - telemetry should never interrupt user flow
    logError('[TELEMETRY] Failed to send to backend:', error);
  }
}

/**
 * Initialize telemetry on CLI startup
 * Shows first-run notice if needed
 */
export async function initTelemetry(): Promise<{
  enabled: boolean;
  showNotice: boolean;
}> {
  const status = await getTelemetryStatus();

  // If env var disabled, telemetry is off
  if (status.envDisabled) {
    return { enabled: false, showNotice: false };
  }

  // Check if we need to show the first-run notice
  const showNotice = status.enabled && !status.noticeShown;

  if (showNotice) {
    await markTelemetryNoticeShown();
  }

  return {
    enabled: status.enabled,
    showNotice,
  };
}

/**
 * Graceful shutdown - flush any remaining events
 */
export async function shutdownTelemetry(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length > 0) {
    await flushEvents();
  }
}

// Handle process exit - try to flush events
process.on('exit', () => {
  // Note: async operations don't work in exit handler
  // Events will be lost if not flushed before exit
});

// Handle SIGINT (Ctrl+C) - flush events before exit
process.on('SIGINT', async () => {
  await shutdownTelemetry();
  process.exit(0);
});
