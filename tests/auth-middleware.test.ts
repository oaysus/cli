import { jest } from '@jest/globals';
/**
 * Tests for auth-middleware.ts
 * Verifies authentication middleware utilities for CLI commands
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Import the functions we're testing
import {
  checkAuthForCommand,
  requiresAuth,
  getAuthRequiredCommands,
  type AuthCheckResult,
} from '../src/lib/shared/auth-middleware.js';

// Import auth utilities to set up test state
import {
  saveCredentials,
  clearCredentials,
  loadCredentials,
} from '../src/lib/shared/auth.js';

import { CREDENTIALS_PATH } from '../src/lib/shared/config.js';

import type { Credentials } from '../src/types/index.js';

// Helper to create valid credentials
function createValidCredentials(overrides: Partial<Credentials> = {}): Credentials {
  return {
    jwt: 'test-jwt-token',
    userId: 'user-123',
    email: 'test@example.com',
    websiteId: 'website-123',
    websiteName: 'Test Website',
    subdomain: 'test',
    customDomain: 'test.com',
    platforms: ['oaysus', 'hosting'],
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
    ...overrides,
  };
}

// Helper to create expired credentials
function createExpiredCredentials(overrides: Partial<Credentials> = {}): Credentials {
  return createValidCredentials({
    expiresAt: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
    ...overrides,
  });
}

describe('auth-middleware module', () => {
  describe('requiresAuth()', () => {
    it('should return true for "push" command', () => {
      expect(requiresAuth('push')).toBe(true);
    });

    it('should return true for "publish" command', () => {
      expect(requiresAuth('publish')).toBe(true);
    });

    it('should return true for "switch" command', () => {
      expect(requiresAuth('switch')).toBe(true);
    });

    it('should return true for "delete" command', () => {
      expect(requiresAuth('delete')).toBe(true);
    });

    it('should return false for "init" command', () => {
      expect(requiresAuth('init')).toBe(false);
    });

    it('should return false for "create" command', () => {
      expect(requiresAuth('create')).toBe(false);
    });

    it('should return false for "validate" command', () => {
      expect(requiresAuth('validate')).toBe(false);
    });

    it('should return false for "build" command', () => {
      expect(requiresAuth('build')).toBe(false);
    });

    it('should return false for "login" command', () => {
      expect(requiresAuth('login')).toBe(false);
    });

    it('should return false for "logout" command', () => {
      expect(requiresAuth('logout')).toBe(false);
    });

    it('should return false for "whoami" command', () => {
      expect(requiresAuth('whoami')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(requiresAuth('')).toBe(false);
    });

    it('should return false for unknown commands', () => {
      expect(requiresAuth('unknown')).toBe(false);
      expect(requiresAuth('random')).toBe(false);
      expect(requiresAuth('test')).toBe(false);
    });

    it('should be case-sensitive (return false for uppercase)', () => {
      expect(requiresAuth('PUSH')).toBe(false);
      expect(requiresAuth('Push')).toBe(false);
      expect(requiresAuth('PUBLISH')).toBe(false);
    });
  });

  describe('getAuthRequiredCommands()', () => {
    it('should return an array of strings', () => {
      const commands = getAuthRequiredCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.every(cmd => typeof cmd === 'string')).toBe(true);
    });

    it('should include push command', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).toContain('push');
    });

    it('should include publish command', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).toContain('publish');
    });

    it('should include switch command', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).toContain('switch');
    });

    it('should include delete command', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).toContain('delete');
    });

    it('should return exactly 4 commands', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).toHaveLength(4);
    });

    it('should return a copy (not the original array)', () => {
      const commands1 = getAuthRequiredCommands();
      const commands2 = getAuthRequiredCommands();

      // Should be equal but not the same reference
      expect(commands1).toEqual(commands2);
      expect(commands1).not.toBe(commands2);

      // Modifying one should not affect the other
      commands1.push('test');
      const commands3 = getAuthRequiredCommands();
      expect(commands3).not.toContain('test');
      expect(commands3).toHaveLength(4);
    });

    it('should not include login command', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).not.toContain('login');
    });

    it('should not include init command', () => {
      const commands = getAuthRequiredCommands();
      expect(commands).not.toContain('init');
    });
  });

  describe('checkAuthForCommand()', () => {
    afterEach(async () => {
      await clearCredentials();
    });

    describe('commands that do not require auth', () => {
      it('should return valid: true for "init" command', async () => {
        const result = await checkAuthForCommand('init');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.suggestion).toBeUndefined();
        expect(result.credentials).toBeUndefined();
      });

      it('should return valid: true for "create" command', async () => {
        const result = await checkAuthForCommand('create');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for "validate" command', async () => {
        const result = await checkAuthForCommand('validate');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for "build" command', async () => {
        const result = await checkAuthForCommand('build');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for "login" command', async () => {
        const result = await checkAuthForCommand('login');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for "logout" command', async () => {
        const result = await checkAuthForCommand('logout');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for "whoami" command', async () => {
        const result = await checkAuthForCommand('whoami');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for unknown command', async () => {
        const result = await checkAuthForCommand('unknown');
        expect(result.valid).toBe(true);
      });

      it('should return valid: true for empty string', async () => {
        const result = await checkAuthForCommand('');
        expect(result.valid).toBe(true);
      });

      it('should not require credentials for non-auth commands', async () => {
        // Clear credentials to ensure none exist
        await clearCredentials();

        const result = await checkAuthForCommand('init');
        expect(result.valid).toBe(true);
        // Should not include credentials for non-auth commands
        expect(result.credentials).toBeUndefined();
      });
    });

    describe('commands that require auth with valid credentials', () => {
      beforeEach(async () => {
        // Clear first to avoid interference from other parallel tests
        await clearCredentials();
        await saveCredentials(createValidCredentials());
      });

      it('should return valid: true for "push" with valid credentials', async () => {
        // Save again to ensure we have fresh credentials (avoids race condition with parallel tests)
        await saveCredentials(createValidCredentials());
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.suggestion).toBeUndefined();
        expect(result.credentials).toBeDefined();
      });

      it('should return valid: true for "publish" with valid credentials', async () => {
        const result = await checkAuthForCommand('publish');
        expect(result.valid).toBe(true);
        expect(result.credentials).toBeDefined();
      });

      it('should return valid: true for "switch" with valid credentials', async () => {
        const result = await checkAuthForCommand('switch');
        expect(result.valid).toBe(true);
        expect(result.credentials).toBeDefined();
      });

      it('should return valid: true for "delete" with valid credentials', async () => {
        const result = await checkAuthForCommand('delete');
        expect(result.valid).toBe(true);
        expect(result.credentials).toBeDefined();
      });

      it('should return credentials with all required fields', async () => {
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(true);
        expect(result.credentials).toBeDefined();
        expect(result.credentials?.jwt).toBe('test-jwt-token');
        expect(result.credentials?.userId).toBe('user-123');
        expect(result.credentials?.email).toBe('test@example.com');
        expect(result.credentials?.websiteId).toBe('website-123');
        expect(result.credentials?.websiteName).toBe('Test Website');
        expect(result.credentials?.subdomain).toBe('test');
        expect(result.credentials?.customDomain).toBe('test.com');
        expect(result.credentials?.platforms).toEqual(['oaysus', 'hosting']);
        expect(result.credentials?.expiresAt).toBeDefined();
      });
    });

    describe('commands that require auth without credentials', () => {
      beforeEach(async () => {
        await clearCredentials();
      });

      it('should return valid: false for "push" without credentials', async () => {
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.suggestion).toBeDefined();
        expect(result.credentials).toBeUndefined();
      });

      it('should return valid: false for "publish" without credentials', async () => {
        const result = await checkAuthForCommand('publish');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return valid: false for "switch" without credentials', async () => {
        const result = await checkAuthForCommand('switch');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return valid: false for "delete" without credentials', async () => {
        const result = await checkAuthForCommand('delete');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should include "Not authenticated" in error message', async () => {
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/not authenticated/i);
      });

      it('should suggest running "oaysus login"', async () => {
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        expect(result.suggestion).toContain('oaysus login');
      });

      it('should not include "expired" in suggestion for missing credentials', async () => {
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        // Should suggest login, but not mention expired
        expect(result.suggestion).not.toMatch(/expired/i);
      });
    });

    describe('commands that require auth with expired credentials', () => {
      beforeEach(async () => {
        // Clear and save expired credentials to avoid race conditions with parallel tests
        await clearCredentials();
        await saveCredentials(createExpiredCredentials());
      });

      it('should return valid: false for "push" with expired credentials', async () => {
        // Re-save expired credentials to ensure freshness
        await saveCredentials(createExpiredCredentials());
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.credentials).toBeUndefined();
      });

      it('should return valid: false for "publish" with expired credentials', async () => {
        await saveCredentials(createExpiredCredentials());
        const result = await checkAuthForCommand('publish');
        expect(result.valid).toBe(false);
      });

      it('should return valid: false for "switch" with expired credentials', async () => {
        await saveCredentials(createExpiredCredentials());
        const result = await checkAuthForCommand('switch');
        expect(result.valid).toBe(false);
      });

      it('should return valid: false for "delete" with expired credentials', async () => {
        await saveCredentials(createExpiredCredentials());
        const result = await checkAuthForCommand('delete');
        expect(result.valid).toBe(false);
      });

      it('should include "expired" in error message', async () => {
        await saveCredentials(createExpiredCredentials());
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/expired/i);
      });

      it('should mention "expired" in suggestion for expired credentials', async () => {
        await saveCredentials(createExpiredCredentials());
        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(false);
        expect(result.suggestion).toMatch(/expired/i);
        expect(result.suggestion).toContain('oaysus login');
        expect(result.suggestion).toContain('re-authenticate');
      });
    });

    describe('AuthCheckResult interface shape', () => {
      it('should have valid property of boolean type', async () => {
        const result = await checkAuthForCommand('init');
        expect(typeof result.valid).toBe('boolean');
      });

      it('should have optional error property', async () => {
        await clearCredentials();
        const failResult = await checkAuthForCommand('push');
        expect(typeof failResult.error).toBe('string');

        await saveCredentials(createValidCredentials());
        const successResult = await checkAuthForCommand('push');
        expect(successResult.error).toBeUndefined();
      });

      it('should have optional suggestion property', async () => {
        await clearCredentials();
        const failResult = await checkAuthForCommand('push');
        expect(typeof failResult.suggestion).toBe('string');

        await saveCredentials(createValidCredentials());
        const successResult = await checkAuthForCommand('push');
        expect(successResult.suggestion).toBeUndefined();
      });

      it('should have optional credentials property', async () => {
        await saveCredentials(createValidCredentials());
        const result = await checkAuthForCommand('push');
        expect(result.credentials).toBeDefined();
        expect(typeof result.credentials).toBe('object');
      });
    });

    describe('edge cases', () => {
      it('should handle credentials that expire exactly now', async () => {
        // Create credentials that expire exactly now (should be considered expired)
        const nowCredentials = createValidCredentials({
          expiresAt: new Date().toISOString(),
        });
        await saveCredentials(nowCredentials);

        const result = await checkAuthForCommand('push');
        // The requireAuth function checks if expiresAt <= now, so exactly now is expired
        expect(result.valid).toBe(false);
      });

      it('should handle credentials that expire in 1 second', async () => {
        // Create credentials that expire in 1 second (should still be valid)
        const soonCredentials = createValidCredentials({
          expiresAt: new Date(Date.now() + 1000).toISOString(),
        });
        await saveCredentials(soonCredentials);

        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(true);
      });

      it('should handle multiple sequential calls', async () => {
        await saveCredentials(createValidCredentials());

        const result1 = await checkAuthForCommand('push');
        const result2 = await checkAuthForCommand('publish');
        const result3 = await checkAuthForCommand('init');

        expect(result1.valid).toBe(true);
        expect(result2.valid).toBe(true);
        expect(result3.valid).toBe(true);
      });

      it('should handle commands with whitespace (considered as different commands)', async () => {
        // Commands with leading/trailing whitespace should be treated as unknown
        const result1 = await checkAuthForCommand(' push');
        const result2 = await checkAuthForCommand('push ');

        // These should not match 'push' exactly, so they don't require auth
        expect(result1.valid).toBe(true);
        expect(result2.valid).toBe(true);
      });

      it('should handle credentials with minimal fields', async () => {
        // Save credentials with only required fields
        const minimalCredentials: Credentials = {
          jwt: 'minimal-jwt',
          userId: 'user-min',
          email: 'min@test.com',
          websiteId: 'web-min',
          platforms: ['oaysus'],
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
        await saveCredentials(minimalCredentials);

        const result = await checkAuthForCommand('push');
        expect(result.valid).toBe(true);
        expect(result.credentials?.jwt).toBe('minimal-jwt');
        expect(result.credentials?.websiteName).toBeUndefined();
        expect(result.credentials?.subdomain).toBeUndefined();
        expect(result.credentials?.customDomain).toBeUndefined();
      });
    });

    describe('all auth required commands verification', () => {
      const authCommands = ['push', 'publish', 'switch', 'delete'];

      beforeEach(async () => {
        await clearCredentials();
      });

      it.each(authCommands)('should require auth for "%s" command', async (command) => {
        expect(requiresAuth(command)).toBe(true);

        // Without credentials, should fail
        const result = await checkAuthForCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.suggestion).toBeDefined();
      });

      it.each(authCommands)('should succeed with valid credentials for "%s"', async (command) => {
        // Clear and save fresh credentials to avoid race condition with parallel tests
        await clearCredentials();
        await saveCredentials(createValidCredentials());
        const result = await checkAuthForCommand(command);
        expect(result.valid).toBe(true);
        expect(result.credentials).toBeDefined();
      });
    });
  });

  describe('integration with auth module', () => {
    afterEach(async () => {
      await clearCredentials();
    });

    it('should use the same credentials as auth module', async () => {
      // Clear first to avoid interference from parallel tests
      await clearCredentials();

      const testCreds = createValidCredentials({
        jwt: 'integration-test-jwt',
        email: 'integration@test.com',
      });
      await saveCredentials(testCreds);

      const result = await checkAuthForCommand('push');
      expect(result.valid).toBe(true);
      expect(result.credentials?.jwt).toBe('integration-test-jwt');
      expect(result.credentials?.email).toBe('integration@test.com');

      // Verify loadCredentials returns the same data (save again to ensure freshness)
      await saveCredentials(testCreds);
      const loaded = await loadCredentials();
      expect(loaded?.jwt).toBe('integration-test-jwt');
      expect(loaded?.email).toBe('integration@test.com');
    });

    it('should reflect credential changes', async () => {
      // Initially no credentials
      const result1 = await checkAuthForCommand('push');
      expect(result1.valid).toBe(false);

      // Save credentials
      await saveCredentials(createValidCredentials());
      const result2 = await checkAuthForCommand('push');
      expect(result2.valid).toBe(true);

      // Clear credentials
      await clearCredentials();
      const result3 = await checkAuthForCommand('push');
      expect(result3.valid).toBe(false);
    });
  });
});

describe('auth-middleware error handling', () => {
  afterEach(async () => {
    await clearCredentials();
  });

  it('should handle corrupted credentials file gracefully', async () => {
    // Write invalid JSON to credentials file
    const credentialsDir = path.dirname(CREDENTIALS_PATH);
    await fs.mkdir(credentialsDir, { recursive: true });
    await fs.writeFile(CREDENTIALS_PATH, 'this is not valid json!!!');

    const result = await checkAuthForCommand('push');
    // Should fail because credentials cannot be loaded
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle error messages that include "expired" keyword', async () => {
    // Save credentials that are expired
    await saveCredentials(createExpiredCredentials());

    const result = await checkAuthForCommand('push');
    expect(result.valid).toBe(false);

    // The suggestion should specifically mention session expiration
    expect(result.suggestion).toMatch(/session.*expired|expired.*session/i);
  });

  it('should handle non-expired error messages appropriately', async () => {
    // Clear credentials to get "Not authenticated" error
    await clearCredentials();

    const result = await checkAuthForCommand('push');
    expect(result.valid).toBe(false);

    // The suggestion should be the generic login suggestion
    expect(result.suggestion).toBe('Run "oaysus login" to authenticate.');
  });
});

describe('auth-middleware consistency', () => {
  it('should return consistent commands list', () => {
    const commands1 = getAuthRequiredCommands();
    const commands2 = getAuthRequiredCommands();

    expect(commands1).toEqual(commands2);
    expect(commands1.sort()).toEqual(commands2.sort());
  });

  it('should match requiresAuth with getAuthRequiredCommands', () => {
    const commands = getAuthRequiredCommands();

    // Every command in the list should return true from requiresAuth
    commands.forEach(cmd => {
      expect(requiresAuth(cmd)).toBe(true);
    });

    // Common non-auth commands should not be in the list
    const nonAuthCommands = ['init', 'create', 'validate', 'build', 'login', 'logout', 'whoami'];
    nonAuthCommands.forEach(cmd => {
      expect(commands).not.toContain(cmd);
      expect(requiresAuth(cmd)).toBe(false);
    });
  });
});

/**
 * Tests for edge case: non-Error thrown from requireAuth
 * This requires mocking the auth module before importing auth-middleware
 * to cover the 'Authentication required' fallback branch
 *
 * Note: jest.unstable_mockModule requires resetting modules before each test
 * to ensure the mock is applied fresh. The first import in each test after
 * resetModules will get the mocked version.
 */
describe('auth-middleware with mocked auth (non-Error branch)', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure fresh mocks
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should handle number thrown from requireAuth', async () => {
    jest.unstable_mockModule('../src/lib/shared/auth.js', () => ({
      requireAuth: jest.fn<() => Promise<never>>().mockRejectedValue(42 as never),
      loadCredentials: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    }));

    const { checkAuthForCommand: mockedCheckAuth } = await import(
      '../src/lib/shared/auth-middleware.js'
    );

    const result = await mockedCheckAuth('publish');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Authentication required');
    expect(result.suggestion).toBe('Run "oaysus login" to authenticate.');
  });

  it('should handle null thrown from requireAuth', async () => {
    jest.unstable_mockModule('../src/lib/shared/auth.js', () => ({
      requireAuth: jest.fn<() => Promise<never>>().mockRejectedValue(null as never),
      loadCredentials: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    }));

    const { checkAuthForCommand: mockedCheckAuth } = await import(
      '../src/lib/shared/auth-middleware.js'
    );

    const result = await mockedCheckAuth('switch');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Authentication required');
    expect(result.suggestion).toBe('Run "oaysus login" to authenticate.');
  });

  it('should handle undefined thrown from requireAuth', async () => {
    jest.unstable_mockModule('../src/lib/shared/auth.js', () => ({
      requireAuth: jest.fn<() => Promise<never>>().mockRejectedValue(undefined as never),
      loadCredentials: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    }));

    const { checkAuthForCommand: mockedCheckAuth } = await import(
      '../src/lib/shared/auth-middleware.js'
    );

    const result = await mockedCheckAuth('delete');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Authentication required');
    expect(result.suggestion).toBe('Run "oaysus login" to authenticate.');
  });

  it('should handle object (non-Error) thrown from requireAuth', async () => {
    jest.unstable_mockModule('../src/lib/shared/auth.js', () => ({
      requireAuth: jest.fn<() => Promise<never>>().mockRejectedValue({ code: 'ERR_AUTH', message: 'custom' } as never),
      loadCredentials: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    }));

    const { checkAuthForCommand: mockedCheckAuth } = await import(
      '../src/lib/shared/auth-middleware.js'
    );

    const result = await mockedCheckAuth('push');

    expect(result.valid).toBe(false);
    // Plain object is not instanceof Error, so fallback message is used
    expect(result.error).toBe('Authentication required');
    expect(result.suggestion).toBe('Run "oaysus login" to authenticate.');
  });

  it('should properly handle Error with expired message when mocked', async () => {
    jest.unstable_mockModule('../src/lib/shared/auth.js', () => ({
      requireAuth: jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Token expired') as never),
      loadCredentials: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    }));

    const { checkAuthForCommand: mockedCheckAuth } = await import(
      '../src/lib/shared/auth-middleware.js'
    );

    const result = await mockedCheckAuth('push');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
    expect(result.suggestion).toBe('Your session has expired. Run "oaysus login" to re-authenticate.');
  });

  it('should properly handle Error without expired message when mocked', async () => {
    jest.unstable_mockModule('../src/lib/shared/auth.js', () => ({
      requireAuth: jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Not authenticated') as never),
      loadCredentials: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    }));

    const { checkAuthForCommand: mockedCheckAuth } = await import(
      '../src/lib/shared/auth-middleware.js'
    );

    const result = await mockedCheckAuth('push');

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Not authenticated');
    expect(result.suggestion).toBe('Run "oaysus login" to authenticate.');
  });
});
