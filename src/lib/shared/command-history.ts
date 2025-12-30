import fs from 'fs/promises';
import path from 'path';
import { CONFIG_DIR } from './config.js';

const HISTORY_PATH = path.join(CONFIG_DIR, 'history.json');
const MAX_HISTORY_SIZE = 10;

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  success: boolean;
}

export interface CommandHistory {
  commands: CommandHistoryEntry[];
}

/**
 * Load command history from local file
 */
export async function loadCommandHistory(): Promise<CommandHistory> {
  try {
    const data = await fs.readFile(HISTORY_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { commands: [] };
  }
}

/**
 * Save command to history
 */
export async function saveCommandToHistory(
  command: string,
  success: boolean = true
): Promise<void> {
  const history = await loadCommandHistory();

  // Add new command to beginning
  history.commands.unshift({
    command,
    timestamp: Date.now(),
    success,
  });

  // Keep only last MAX_HISTORY_SIZE commands
  history.commands = history.commands.slice(0, MAX_HISTORY_SIZE);

  // Ensure directory exists
  const historyDir = path.dirname(HISTORY_PATH);
  await fs.mkdir(historyDir, { recursive: true });

  // Write history
  await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
}

/**
 * Get the last executed command
 */
export async function getLastCommand(): Promise<CommandHistoryEntry | null> {
  const history = await loadCommandHistory();
  return history.commands[0] || null;
}

/**
 * Clear command history
 */
export async function clearCommandHistory(): Promise<void> {
  try {
    await fs.unlink(HISTORY_PATH);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Format relative time (e.g., "3 mins ago", "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}
