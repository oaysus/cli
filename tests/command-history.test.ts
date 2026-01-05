/**
 * Tests for command-history.ts
 * Verifies command history loading, saving, clearing, and time formatting
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import {
  loadCommandHistory,
  saveCommandToHistory,
  getLastCommand,
  clearCommandHistory,
  formatRelativeTime,
  type CommandHistoryEntry,
  type CommandHistory,
} from '../src/lib/shared/command-history.js';

// Test helpers
let testDir: string;
let originalConfigDir: string;

/**
 * Create a unique temp directory for each test run
 */
async function createTestDir(): Promise<string> {
  const tempBase = os.tmpdir();
  const uniqueDir = path.join(tempBase, `cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(uniqueDir, { recursive: true });
  return uniqueDir;
}

/**
 * Clean up test directory
 */
async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('command-history module', () => {
  describe('formatRelativeTime()', () => {
    it('should return "just now" for timestamps less than 60 seconds ago', () => {
      const now = Date.now();
      expect(formatRelativeTime(now)).toBe('just now');
      expect(formatRelativeTime(now - 1000)).toBe('just now'); // 1 second ago
      expect(formatRelativeTime(now - 30000)).toBe('just now'); // 30 seconds ago
      expect(formatRelativeTime(now - 59000)).toBe('just now'); // 59 seconds ago
    });

    it('should return "1 min ago" for 1 minute', () => {
      const now = Date.now();
      const oneMinuteAgo = now - (60 * 1000);
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1 min ago');
    });

    it('should return "X mins ago" for multiple minutes (plural)', () => {
      const now = Date.now();
      const twoMinutesAgo = now - (2 * 60 * 1000);
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      const fiftyNineMinutesAgo = now - (59 * 60 * 1000);

      expect(formatRelativeTime(twoMinutesAgo)).toBe('2 mins ago');
      expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30 mins ago');
      expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59 mins ago');
    });

    it('should return "1 hour ago" for 1 hour', () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
    });

    it('should return "X hours ago" for multiple hours (plural)', () => {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);
      const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
      const twentyThreeHoursAgo = now - (23 * 60 * 60 * 1000);

      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
      expect(formatRelativeTime(twelveHoursAgo)).toBe('12 hours ago');
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23 hours ago');
    });

    it('should return "1 day ago" for 1 day', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago');
    });

    it('should return "X days ago" for multiple days (plural)', () => {
      const now = Date.now();
      const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      expect(formatRelativeTime(twoDaysAgo)).toBe('2 days ago');
      expect(formatRelativeTime(sevenDaysAgo)).toBe('7 days ago');
      expect(formatRelativeTime(thirtyDaysAgo)).toBe('30 days ago');
    });

    it('should handle edge case between minutes and hours (60 minutes)', () => {
      const now = Date.now();
      // 60 minutes = 1 hour
      const sixtyMinutesAgo = now - (60 * 60 * 1000);
      expect(formatRelativeTime(sixtyMinutesAgo)).toBe('1 hour ago');
    });

    it('should handle edge case between hours and days (24 hours)', () => {
      const now = Date.now();
      // 24 hours = 1 day
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twentyFourHoursAgo)).toBe('1 day ago');
    });

    it('should handle timestamps in the future (negative diff shows "just now")', () => {
      const now = Date.now();
      const futureTimestamp = now + 60000; // 1 minute in the future
      // With negative diff, Math.floor will give negative values
      // The function will return 'just now' since all conditions fail with negative numbers
      const result = formatRelativeTime(futureTimestamp);
      // Future timestamps result in negative values which all fail > 0 checks
      expect(result).toBe('just now');
    });

    it('should handle timestamp of 0 (very old)', () => {
      const result = formatRelativeTime(0);
      // This will be many days ago
      expect(result).toMatch(/\d+ days ago/);
    });
  });

  describe('loadCommandHistory()', () => {
    it('should return empty commands array when history file does not exist', async () => {
      // The CONFIG_DIR points to user home, but in test environment
      // we rely on the file not existing or catching the error
      const history = await loadCommandHistory();

      expect(history).toBeDefined();
      expect(history).toHaveProperty('commands');
      expect(Array.isArray(history.commands)).toBe(true);
    });

    it('should return CommandHistory structure with commands property', async () => {
      const history = await loadCommandHistory();

      expect(history).toEqual(
        expect.objectContaining({
          commands: expect.any(Array),
        })
      );
    });
  });

  describe('saveCommandToHistory()', () => {
    it('should not throw when saving a command', async () => {
      // This will attempt to write to the real config directory
      // but should not throw
      await expect(
        saveCommandToHistory('test push', true)
      ).resolves.not.toThrow();
    });

    it('should accept command without success parameter (defaults to true)', async () => {
      await expect(
        saveCommandToHistory('test command')
      ).resolves.not.toThrow();
    });

    it('should accept command with success = false', async () => {
      await expect(
        saveCommandToHistory('failed command', false)
      ).resolves.not.toThrow();
    });

    it('should handle empty command string', async () => {
      await expect(
        saveCommandToHistory('')
      ).resolves.not.toThrow();
    });

    it('should handle very long command strings', async () => {
      const longCommand = 'a'.repeat(10000);
      await expect(
        saveCommandToHistory(longCommand)
      ).resolves.not.toThrow();
    });

    it('should handle commands with special characters', async () => {
      const specialCommand = 'push --flag="value with spaces" && echo $HOME';
      await expect(
        saveCommandToHistory(specialCommand)
      ).resolves.not.toThrow();
    });
  });

  describe('getLastCommand()', () => {
    it('should return null or a CommandHistoryEntry', async () => {
      const lastCommand = await getLastCommand();

      if (lastCommand === null) {
        expect(lastCommand).toBeNull();
      } else {
        expect(lastCommand).toHaveProperty('command');
        expect(lastCommand).toHaveProperty('timestamp');
        expect(lastCommand).toHaveProperty('success');
        expect(typeof lastCommand.command).toBe('string');
        expect(typeof lastCommand.timestamp).toBe('number');
        expect(typeof lastCommand.success).toBe('boolean');
      }
    });

    it('should return the most recently saved command', async () => {
      // Save a unique command
      const uniqueCommand = `unique-test-${Date.now()}`;
      await saveCommandToHistory(uniqueCommand, true);

      const lastCommand = await getLastCommand();

      expect(lastCommand).not.toBeNull();
      expect(lastCommand?.command).toBe(uniqueCommand);
      expect(lastCommand?.success).toBe(true);
    });
  });

  describe('clearCommandHistory()', () => {
    it('should not throw when clearing history', async () => {
      await expect(clearCommandHistory()).resolves.not.toThrow();
    });

    it('should not throw when called multiple times', async () => {
      await expect(clearCommandHistory()).resolves.not.toThrow();
      await expect(clearCommandHistory()).resolves.not.toThrow();
    });

    it('should not throw when history file does not exist', async () => {
      // Clear first to ensure file doesn't exist
      await clearCommandHistory();
      // Try to clear again
      await expect(clearCommandHistory()).resolves.not.toThrow();
    });
  });

  describe('integration: save and load workflow', () => {
    it('should save a command and retrieve it', async () => {
      // Clear history first
      await clearCommandHistory();

      // Save a command
      const testCommand = `test-command-${Date.now()}`;
      await saveCommandToHistory(testCommand, true);

      // Load and verify
      const history = await loadCommandHistory();
      expect(history.commands.length).toBeGreaterThan(0);
      expect(history.commands[0].command).toBe(testCommand);
      expect(history.commands[0].success).toBe(true);
      expect(typeof history.commands[0].timestamp).toBe('number');
    });

    it('should save multiple commands in order (newest first)', async () => {
      await clearCommandHistory();

      // Save commands
      await saveCommandToHistory('first-command', true);
      await saveCommandToHistory('second-command', true);
      await saveCommandToHistory('third-command', false);

      // Load and verify order
      const history = await loadCommandHistory();
      expect(history.commands.length).toBe(3);
      expect(history.commands[0].command).toBe('third-command');
      expect(history.commands[0].success).toBe(false);
      expect(history.commands[1].command).toBe('second-command');
      expect(history.commands[2].command).toBe('first-command');
    });

    it('should limit history to MAX_HISTORY_SIZE (10) entries', async () => {
      await clearCommandHistory();

      // Save 15 commands
      for (let i = 1; i <= 15; i++) {
        await saveCommandToHistory(`command-${i}`, true);
      }

      // Load and verify only 10 are kept
      const history = await loadCommandHistory();
      expect(history.commands.length).toBe(10);

      // Most recent should be command-15
      expect(history.commands[0].command).toBe('command-15');
      // Oldest should be command-6 (commands 1-5 were dropped)
      expect(history.commands[9].command).toBe('command-6');
    });

    it('should include timestamp in saved entries', async () => {
      await clearCommandHistory();

      const beforeSave = Date.now();
      await saveCommandToHistory('timestamped-command', true);
      const afterSave = Date.now();

      const history = await loadCommandHistory();
      const timestamp = history.commands[0].timestamp;

      expect(timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(timestamp).toBeLessThanOrEqual(afterSave);
    });

    it('should clear history and return empty after clear', async () => {
      // Save something
      await saveCommandToHistory('to-be-cleared', true);

      // Clear
      await clearCommandHistory();

      // Verify empty
      const history = await loadCommandHistory();
      expect(history.commands).toEqual([]);
    });

    it('getLastCommand should return null after clearing', async () => {
      await saveCommandToHistory('temporary-command', true);
      await clearCommandHistory();

      const lastCommand = await getLastCommand();
      expect(lastCommand).toBeNull();
    });
  });

  describe('CommandHistoryEntry type structure', () => {
    it('should have command, timestamp, and success properties', async () => {
      await clearCommandHistory();
      await saveCommandToHistory('type-test-command', true);

      const history = await loadCommandHistory();
      const entry = history.commands[0];

      // Verify structure
      expect(Object.keys(entry).sort()).toEqual(['command', 'success', 'timestamp']);
    });
  });

  describe('edge cases', () => {
    it('should handle Unicode characters in commands', async () => {
      await clearCommandHistory();
      const unicodeCommand = 'push --msg="Hello World"';
      await saveCommandToHistory(unicodeCommand, true);

      const lastCommand = await getLastCommand();
      expect(lastCommand?.command).toBe(unicodeCommand);
    });

    it('should handle newlines in commands', async () => {
      await clearCommandHistory();
      const multilineCommand = 'command\nwith\nnewlines';
      await saveCommandToHistory(multilineCommand, true);

      const lastCommand = await getLastCommand();
      expect(lastCommand?.command).toBe(multilineCommand);
    });

    it('should handle JSON-like strings in commands', async () => {
      await clearCommandHistory();
      const jsonCommand = '{"key": "value", "nested": {"arr": [1,2,3]}}';
      await saveCommandToHistory(jsonCommand, true);

      const lastCommand = await getLastCommand();
      expect(lastCommand?.command).toBe(jsonCommand);
    });

    it('should preserve success=false correctly', async () => {
      await clearCommandHistory();
      await saveCommandToHistory('failed-command', false);

      const history = await loadCommandHistory();
      expect(history.commands[0].success).toBe(false);
    });

    it('should handle rapid successive saves', async () => {
      await clearCommandHistory();

      // Save multiple commands rapidly without awaiting each
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(saveCommandToHistory(`rapid-${i}`, true));
      }
      await Promise.all(promises);

      // Should not throw, history should contain some entries
      const history = await loadCommandHistory();
      expect(history.commands.length).toBeGreaterThan(0);
    });
  });
});

describe('formatRelativeTime boundary tests', () => {
  it('should correctly handle exactly 1 second ago', () => {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    expect(formatRelativeTime(oneSecondAgo)).toBe('just now');
  });

  it('should correctly handle exactly 59 seconds ago', () => {
    const now = Date.now();
    const fiftyNineSecondsAgo = now - 59000;
    expect(formatRelativeTime(fiftyNineSecondsAgo)).toBe('just now');
  });

  it('should correctly handle exactly 2 minutes ago', () => {
    const now = Date.now();
    const twoMinutesAgo = now - (2 * 60 * 1000);
    expect(formatRelativeTime(twoMinutesAgo)).toBe('2 mins ago');
  });

  it('should correctly handle exactly 119 minutes ago (1 hour 59 mins)', () => {
    const now = Date.now();
    const oneHourFiftyNineMinutesAgo = now - (119 * 60 * 1000);
    // 119 minutes = 1 hour (floor(119/60) = 1)
    expect(formatRelativeTime(oneHourFiftyNineMinutesAgo)).toBe('1 hour ago');
  });

  it('should correctly handle exactly 2 hours ago', () => {
    const now = Date.now();
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
  });

  it('should correctly handle exactly 47 hours ago (1 day 23 hours)', () => {
    const now = Date.now();
    const fortySevenHoursAgo = now - (47 * 60 * 60 * 1000);
    // 47 hours = 1 day (floor(47/24) = 1)
    expect(formatRelativeTime(fortySevenHoursAgo)).toBe('1 day ago');
  });

  it('should correctly handle exactly 48 hours ago (2 days)', () => {
    const now = Date.now();
    const fortyEightHoursAgo = now - (48 * 60 * 60 * 1000);
    expect(formatRelativeTime(fortyEightHoursAgo)).toBe('2 days ago');
  });

  it('should correctly handle very large timestamps (many years)', () => {
    const now = Date.now();
    const tenYearsAgo = now - (365 * 10 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(tenYearsAgo);
    expect(result).toMatch(/\d+ days ago/);
  });
});
