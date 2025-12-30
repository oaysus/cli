import { requireAuth, loadCredentials } from './auth.js';
import type { Credentials } from '../../types/index.js';

/**
 * Result of an auth check for a command
 */
export interface AuthCheckResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  credentials?: Credentials;
}

/**
 * Commands that require authentication
 */
const AUTH_REQUIRED_COMMANDS = ['push', 'publish', 'switch', 'delete'];

/**
 * Check if a command requires authentication and validate credentials
 *
 * @param command - The CLI command being executed
 * @returns AuthCheckResult with validation status and credentials if valid
 */
export async function checkAuthForCommand(command: string): Promise<AuthCheckResult> {
  // Early return for commands that don't require auth
  if (!AUTH_REQUIRED_COMMANDS.includes(command)) {
    return { valid: true };
  }

  try {
    const credentials = await requireAuth();
    return { valid: true, credentials };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication required';
    const isExpired = message.toLowerCase().includes('expired');

    return {
      valid: false,
      error: message,
      suggestion: isExpired
        ? 'Your session has expired. Run "oaysus login" to re-authenticate.'
        : 'Run "oaysus login" to authenticate.'
    };
  }
}

/**
 * Check if a command requires authentication
 *
 * @param command - The CLI command to check
 * @returns true if the command requires authentication
 */
export function requiresAuth(command: string): boolean {
  return AUTH_REQUIRED_COMMANDS.includes(command);
}

/**
 * Get list of commands that require authentication
 */
export function getAuthRequiredCommands(): string[] {
  return [...AUTH_REQUIRED_COMMANDS];
}
