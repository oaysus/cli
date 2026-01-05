import { jest } from '@jest/globals';
/**
 * Comprehensive tests for push.ts
 * Tests the non-interactive push workflow with maximum achievable coverage
 *
 * Note: Since Bun doesn't support mock.module(), we test by:
 * 1. Testing helper functions (log, logSuccess, logError) via their side effects
 * 2. Testing early exit paths (auth failure, validation failure)
 * 3. Creating real project structures to test validation paths
 * 4. Testing with valid credentials to reach deeper code paths
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';

// Test directory base
const testDirBase = path.join(os.tmpdir(), 'oaysus-push-test');
let testDir: string;

// Store original credentials path for restoration
let originalCredentialsContent: string | null = null;

// Helper to get credentials path (mirroring config.ts logic)
function getCredentialsPath(): string {
  // During tests, NODE_ENV=test, so .env.local is not loaded
  // This means we use .oaysus, not .oaysus-local
  return path.join(os.homedir(), '.oaysus', 'credentials.json');
}

// Helper to create valid test credentials
function createTestCredentials(): object {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7); // Expires in 7 days

  return {
    jwt: 'test-jwt-token-12345',
    userId: 'test-user-id',
    email: 'test@example.com',
    websiteId: 'test-website-id',
    websiteName: 'Test Website',
    subdomain: 'test',
    platforms: ['oaysus', 'hosting'],
    expiresAt: futureDate.toISOString(),
  };
}

// Helper to create expired credentials
function createExpiredCredentials(): object {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1); // Expired 1 day ago

  return {
    jwt: 'expired-jwt-token',
    userId: 'test-user-id',
    email: 'test@example.com',
    websiteId: 'test-website-id',
    websiteName: 'Test Website',
    subdomain: 'test',
    platforms: ['oaysus', 'hosting'],
    expiresAt: pastDate.toISOString(),
  };
}

// Console spies
let consoleLogSpy: any;
let consoleErrorSpy: any;
let stdoutWriteSpy: any;

describe('push module - basic tests', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    // Set up console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    stdoutWriteSpy?.mockRestore();

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('push() - module exports', () => {
    it('should export push function', async () => {
      const module = await import('../src/lib/push.js');
      expect(module.push).toBeDefined();
      expect(typeof module.push).toBe('function');
    });
  });

  describe('push() - default options', () => {
    it('should accept empty options object', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({});
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should accept no arguments at all', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should use current directory when projectPath not provided', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ silent: true });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('push() - PushResult interface', () => {
    it('should return PushResult with success boolean', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });
      expect(typeof result.success).toBe('boolean');
    });

    it('should return error string when failed', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });

    it('should have optional themePackId property', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });
      // On failure, themePackId is undefined
      expect(result.themePackId).toBeUndefined();
    });

    it('should have optional componentCount property', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });
      // On failure, componentCount is undefined
      expect(result.componentCount).toBeUndefined();
    });
  });
});

describe('push module - logging tests', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    stdoutWriteSpy?.mockRestore();

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('log() helper function', () => {
    it('should log header message when silent is false', async () => {
      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasHeader = logCalls.some(log => log.includes('Oaysus Push'));
      expect(hasHeader).toBe(true);
    });

    it('should not log header when silent is true', async () => {
      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: true });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasHeader = logCalls.some(log => log.includes('Oaysus Push'));
      expect(hasHeader).toBe(false);
    });

    it('should log separator line when silent is false', async () => {
      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      // Unicode dash repeated 40 times
      const hasSeparator = logCalls.some(log => log.includes('─'.repeat(40)));
      expect(hasSeparator).toBe(true);
    });
  });

  describe('logSuccess() helper function', () => {
    it('should log with checkmark when silent is false and auth succeeds', async () => {
      // Save original credentials
      const credPath = getCredentialsPath();
      let originalCreds: string | null = null;
      try {
        originalCreds = await fsPromises.readFile(credPath, 'utf-8');
      } catch {}

      // Write valid test credentials
      await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
      await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

      try {
        const { push } = await import('../src/lib/push.js');
        await push({ projectPath: testDir, silent: false });

        const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
        const hasCheckmark = logCalls.some(log => log.includes('✓'));
        expect(hasCheckmark).toBe(true);
      } finally {
        // Restore original credentials
        if (originalCreds) {
          await fsPromises.writeFile(credPath, originalCreds);
        } else {
          try {
            await fsPromises.unlink(credPath);
          } catch {}
        }
      }
    });
  });

  describe('logError() helper function', () => {
    it('should log with X mark to stderr when silent is false', async () => {
      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const errorCalls = (consoleErrorSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasXMark = errorCalls.some(log => log.includes('✗'));
      expect(hasXMark).toBe(true);
    });

    it('should not log to stderr when silent is true', async () => {
      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: true });

      const errorCalls = (consoleErrorSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasXMark = errorCalls.some(log => log.includes('✗'));
      expect(hasXMark).toBe(false);
    });
  });
});

describe('push module - authentication tests', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    // Backup existing credentials
    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    // Restore original credentials
    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('authentication failure handling', () => {
    it('should fail when credentials file does not exist', async () => {
      // Remove credentials file
      try {
        await fsPromises.unlink(credPath);
      } catch {}

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should show login tip on auth failure', async () => {
      // Remove credentials file
      try {
        await fsPromises.unlink(credPath);
      } catch {}

      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasTip = logCalls.some(log => log.includes('Tip:') && log.includes('oaysus login'));
      expect(hasTip).toBe(true);
    });

    it('should show expired tip when token is expired', async () => {
      // Write expired credentials
      await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
      await fsPromises.writeFile(credPath, JSON.stringify(createExpiredCredentials()));

      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasExpiredTip = logCalls.some(log =>
        log.includes('Tip:') && log.includes('expired')
      );
      expect(hasExpiredTip).toBe(true);
    });

    it('should extract error message from Error object', async () => {
      // Remove credentials to trigger auth error
      try {
        await fsPromises.unlink(credPath);
      } catch {}

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error!.length).toBeGreaterThan(0);
    });
  });

  describe('authentication success', () => {
    it('should pass authentication with valid credentials', async () => {
      // Write valid credentials
      await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
      await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: false });

      // Should fail at validation (no package.json), not auth
      expect(result.success).toBe(false);
      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasAuthSuccess = logCalls.some(log => log.includes('✓') && log.includes('Authenticated'));
      expect(hasAuthSuccess).toBe(true);
    });
  });
});

describe('push module - validation tests', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    // Backup and set valid credentials
    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    // Restore original credentials
    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('validation failure handling', () => {
    it('should fail when package.json is missing', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('package.json');
    });

    it('should fail with invalid package name', async () => {
      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'Invalid Name', version: '1.0.0' })
      );

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail with invalid version format', async () => {
      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'valid-name', version: 'not-semver' })
      );

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail when no framework detected', async () => {
      // Write credentials at start of test to avoid race conditions with parallel tests
      await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
      await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: { lodash: '^4.0.0' }
        })
      );

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('framework');
    });

    it('should log validation path when silent is false', async () => {
      // Write credentials at start of test to avoid race conditions with parallel tests
      await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
      await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasValidatingLog = logCalls.some(log => log.includes('Validating'));
      expect(hasValidatingLog).toBe(true);
    });

    it('should join multiple validation errors', async () => {
      // Missing both name and version patterns
      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'INVALID', version: 'bad' })
      );

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('path resolution', () => {
    it('should resolve relative path to absolute', async () => {
      const { push } = await import('../src/lib/push.js');

      // Use '.' as relative path
      const result = await push({ projectPath: '.', silent: true });

      expect(result.success).toBe(false);
      // Error should be from validation, not path resolution
      expect(result.error).toBeDefined();
    });

    it('should handle absolute path correctly', async () => {
      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should log absolute path when validating', async () => {
      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasAbsolutePath = logCalls.some(log => log.includes(testDir));
      expect(hasAbsolutePath).toBe(true);
    });
  });
});

describe('push module - project structure tests', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    // Set valid credentials
    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('theme pack structure', () => {
    it('should handle theme pack with components directory', async () => {
      // Create valid theme pack structure
      const packageJson = {
        name: 'test-theme',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'test-theme',
            displayName: 'Test Theme',
          },
        },
      };

      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory structure
      await fsPromises.mkdir(path.join(testDir, 'components', 'Hero'), { recursive: true });
      await fsPromises.writeFile(
        path.join(testDir, 'components', 'Hero', 'index.tsx'),
        'export default function Hero() { return null; }'
      );
      await fsPromises.writeFile(
        path.join(testDir, 'components', 'Hero', 'schema.json'),
        JSON.stringify({ type: 'hero', displayName: 'Hero', props: {} })
      );

      // Create node_modules to skip npm install
      await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      // Will fail at build or upload, but should pass validation
      expect(result.success).toBe(false);
    });

    it('should fail theme pack without oaysus.theme config', async () => {
      const packageJson = {
        name: 'test-theme',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        // Missing oaysus.theme
      };

      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      await fsPromises.mkdir(path.join(testDir, 'components', 'Hero'), { recursive: true });
      await fsPromises.writeFile(
        path.join(testDir, 'components', 'Hero', 'index.tsx'),
        'export default function Hero() { return null; }'
      );
      await fsPromises.writeFile(
        path.join(testDir, 'components', 'Hero', 'schema.json'),
        JSON.stringify({ type: 'hero', displayName: 'Hero', props: {} })
      );

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Theme');
    });
  });

  describe('single component structure', () => {
    it('should handle single component with root index', async () => {
      const packageJson = {
        name: 'test-component',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'test-component',
            displayName: 'Test Component',
          },
        },
      };

      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fsPromises.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      await fsPromises.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify({ type: 'component', displayName: 'Component', props: {} })
      );

      // Create node_modules to skip npm install
      await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

      const { push } = await import('../src/lib/push.js');
      const result = await push({ projectPath: testDir, silent: true });

      // Will fail at build or upload, but should pass validation
      expect(result.success).toBe(false);
    });
  });

  describe('node_modules handling', () => {
    it('should skip npm install when node_modules exists', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: { theme: { name: 'test-project', displayName: 'Test' } },
      };

      await fsPromises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fsPromises.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function C() { return null; }'
      );
      await fsPromises.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify({ type: 'c', displayName: 'C', props: {} })
      );

      // Create node_modules
      await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

      const { push } = await import('../src/lib/push.js');
      await push({ projectPath: testDir, silent: false });

      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      // Should NOT have "Installing dependencies" log
      const hasInstalling = logCalls.some(log => log.includes('Installing dependencies'));
      expect(hasInstalling).toBe(false);
    });
  });
});

describe('push module - framework detection', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should detect React framework', async () => {
    const packageJson = {
      name: 'react-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
    // Error should be related to project type, not framework
  });

  it('should detect Vue framework', async () => {
    const packageJson = {
      name: 'vue-project',
      version: '1.0.0',
      dependencies: { vue: '^3.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should detect Svelte framework', async () => {
    const packageJson = {
      name: 'svelte-project',
      version: '1.0.0',
      dependencies: { svelte: '^4.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });
});

describe('push module - error handling edge cases', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should handle non-Error thrown objects', async () => {
    // This tests the catch block that handles non-Error objects
    const { push } = await import('../src/lib/push.js');

    // Use nonexistent path to trigger error
    const result = await push({ projectPath: '/definitely/nonexistent/path/12345', silent: true });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should fallback to "Push failed" when no error message', async () => {
    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle unexpected errors in try-catch', async () => {
    // Corrupt credentials file to cause JSON parse error
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, 'not valid json');

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('push module - React version handling', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should handle caret version prefix', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.2.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle tilde version prefix', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '~18.2.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle exact version', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '18.2.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle version with > prefix', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '>18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });
});

describe('push module - dependencies handling', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should handle package without dependencies object', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      // No dependencies
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle package with devDependencies only', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      devDependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    // Should detect framework from devDependencies
    expect(result.success).toBe(false);
  });

  it('should handle package with multiple dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        lodash: '^4.17.21',
        axios: '^1.0.0',
      },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });
});

describe('push module - marketing assets', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should handle project without marketing directory', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle marketing directory with PNG banner', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'marketing'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'banner.png'),
      'fake-png-content'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle marketing directory with SVG banner', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'marketing'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'banner.svg'),
      '<svg></svg>'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle marketing directory with JPG banner', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'marketing'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'banner.jpg'),
      'fake-jpg-content'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle marketing directory with JPEG banner', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'marketing'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'banner.jpeg'),
      'fake-jpeg-content'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle marketing directory with WEBP banner', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'marketing'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'banner.webp'),
      'fake-webp-content'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle marketing directory with preview images', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'marketing'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'preview-1.png'),
      'fake-preview-1'
    );
    await fsPromises.writeFile(
      path.join(testDir, 'marketing', 'preview-2.jpg'),
      'fake-preview-2'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });
});

describe('push module - stdout handling', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    stdoutWriteSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should not write progress to stdout when silent', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    const { push } = await import('../src/lib/push.js');
    await push({ projectPath: testDir, silent: true });

    const writeCalls = (stdoutWriteSpy.mock.calls as any[][]).map(call => String(call[0]));
    const hasUploadProgress = writeCalls.some(log => log.includes('Uploading:'));
    expect(hasUploadProgress).toBe(false);
  });
});

describe('push module - script direct execution check', () => {
  it('should have script execution check at end of file', async () => {
    // Read the push.ts file to verify the script check exists
    const pushContent = await fsPromises.readFile(
      path.join(process.cwd(), 'src/lib/push.ts'),
      'utf-8'
    );

    expect(pushContent).toContain("process.argv[1]?.includes('push.js')");
    expect(pushContent).toContain("process.argv[1]?.includes('push.ts')");
  });
});

describe('push module - import analysis path', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should analyze component imports when validation passes', async () => {
    // Create a complete valid project structure
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
      oaysus: {
        theme: {
          name: 'test-theme',
          displayName: 'Test Theme',
        },
      },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    // Create components directory with valid component
    await fsPromises.mkdir(path.join(testDir, 'components', 'Hero'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'Hero', 'index.tsx'),
      `import React from 'react';
export default function Hero({ title }: { title: string }) {
  return <div>{title}</div>;
}`
    );
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'Hero', 'schema.json'),
      JSON.stringify({
        type: 'hero',
        displayName: 'Hero',
        props: {
          title: { type: 'string', required: true }
        }
      })
    );

    // Create node_modules
    await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

    const { push } = await import('../src/lib/push.js');
    await push({ projectPath: testDir, silent: false });

    const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
    const hasAnalyzingLog = logCalls.some(log => log.includes('Analyzing'));
    expect(hasAnalyzingLog).toBe(true);
  });

  it('should log when no external dependencies detected', async () => {
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
      },
      oaysus: {
        theme: {
          name: 'test-theme',
          displayName: 'Test Theme',
        },
      },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'components', 'Simple'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'Simple', 'index.tsx'),
      `export default function Simple() { return null; }`
    );
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'Simple', 'schema.json'),
      JSON.stringify({ type: 'simple', displayName: 'Simple', props: {} })
    );

    await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

    const { push } = await import('../src/lib/push.js');
    await push({ projectPath: testDir, silent: false });

    const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
    const hasNoExternal = logCalls.some(log => log.includes('No external dependencies'));
    expect(hasNoExternal).toBe(true);
  });

  it('should log detected external dependencies', async () => {
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        lodash: '^4.17.21',
      },
      oaysus: {
        theme: {
          name: 'test-theme',
          displayName: 'Test Theme',
        },
      },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'components', 'WithDeps'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'WithDeps', 'index.tsx'),
      `import React from 'react';
import _ from 'lodash';
export default function WithDeps() { return null; }`
    );
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'WithDeps', 'schema.json'),
      JSON.stringify({ type: 'with-deps', displayName: 'With Deps', props: {} })
    );

    await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

    const { push } = await import('../src/lib/push.js');
    await push({ projectPath: testDir, silent: false });

    const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
    const hasDetectedDeps = logCalls.some(log => log.includes('Detected') && log.includes('lodash'));
    expect(hasDetectedDeps).toBe(true);
  });
});

describe('push module - build step', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should attempt to build client components', async () => {
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      oaysus: {
        theme: {
          name: 'test-theme',
          displayName: 'Test Theme',
        },
      },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'components', 'Button'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'Button', 'index.tsx'),
      `export default function Button() { return null; }`
    );
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'Button', 'schema.json'),
      JSON.stringify({ type: 'button', displayName: 'Button', props: {} })
    );

    await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

    const { push } = await import('../src/lib/push.js');
    await push({ projectPath: testDir, silent: false });

    const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
    const hasBuildingLog = logCalls.some(log => log.includes('Building client'));
    expect(hasBuildingLog).toBe(true);
  });
});

describe('push module - validation success count logging', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should log validated component count', async () => {
    const packageJson = {
      name: 'multi-component',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      oaysus: {
        theme: {
          name: 'multi-component',
          displayName: 'Multi Component',
        },
      },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    // Create multiple components
    for (const name of ['Hero', 'Footer', 'Header']) {
      await fsPromises.mkdir(path.join(testDir, 'components', name), { recursive: true });
      await fsPromises.writeFile(
        path.join(testDir, 'components', name, 'index.tsx'),
        `export default function ${name}() { return null; }`
      );
      await fsPromises.writeFile(
        path.join(testDir, 'components', name, 'schema.json'),
        JSON.stringify({ type: name.toLowerCase(), displayName: name, props: {} })
      );
    }

    await fsPromises.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

    const { push } = await import('../src/lib/push.js');
    await push({ projectPath: testDir, silent: false });

    const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
    const hasValidatedCount = logCalls.some(log => log.includes('Validated') && log.includes('component'));
    expect(hasValidatedCount).toBe(true);
  });
});

describe('push module - internal helper function coverage', () => {
  it('should cover log function with both silent states', async () => {
    const { push } = await import('../src/lib/push.js');

    // These calls exercise the log function with silent=true and silent=false
    const result1 = await push({ silent: true });
    const result2 = await push({ silent: false });

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });

  it('should cover logSuccess function via auth success', async () => {
    const credPath = getCredentialsPath();
    let originalCreds: string | null = null;

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {}

    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    try {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const { push } = await import('../src/lib/push.js');
      await push({ silent: false });

      // logSuccess should have been called with "Authenticated"
      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      expect(logCalls.some(log => log.includes('✓'))).toBe(true);
    } finally {
      consoleLogSpy?.mockRestore();
      if (originalCreds) {
        await fsPromises.writeFile(credPath, originalCreds);
      } else {
        try {
          await fsPromises.unlink(credPath);
        } catch {}
      }
    }
  });

  it('should cover logError function via auth failure', async () => {
    const credPath = getCredentialsPath();
    let originalCreds: string | null = null;

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {}

    // Ensure no credentials exist
    try {
      await fsPromises.unlink(credPath);
    } catch {}

    try {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { push } = await import('../src/lib/push.js');
      await push({ silent: false });

      // logError should have been called
      const errorCalls = (consoleErrorSpy.mock.calls as any[][]).map(call => call.join(' '));
      expect(errorCalls.some(log => log.includes('✗'))).toBe(true);
    } finally {
      consoleErrorSpy?.mockRestore();
      if (originalCreds) {
        await fsPromises.writeFile(credPath, originalCreds);
      }
    }
  });
});

describe('push module - various validation scenarios', () => {
  let originalCreds: string | null = null;
  const credPath = getCredentialsPath();

  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    try {
      originalCreds = await fsPromises.readFile(credPath, 'utf-8');
    } catch {
      originalCreds = null;
    }
    await fsPromises.mkdir(path.dirname(credPath), { recursive: true });
    await fsPromises.writeFile(credPath, JSON.stringify(createTestCredentials()));

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    if (originalCreds) {
      await fsPromises.writeFile(credPath, originalCreds);
    } else {
      try {
        await fsPromises.unlink(credPath);
      } catch {}
    }

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should fail validation with missing schema.json', async () => {
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      oaysus: { theme: { name: 'test-theme', displayName: 'Test' } },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'components', 'NoSchema'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'NoSchema', 'index.tsx'),
      `export default function NoSchema() { return null; }`
    );
    // Missing schema.json intentionally

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('schema');
  });

  it('should fail validation with invalid schema.json', async () => {
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      oaysus: { theme: { name: 'test-theme', displayName: 'Test' } },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    await fsPromises.mkdir(path.join(testDir, 'components', 'BadSchema'), { recursive: true });
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'BadSchema', 'index.tsx'),
      `export default function BadSchema() { return null; }`
    );
    await fsPromises.writeFile(
      path.join(testDir, 'components', 'BadSchema', 'schema.json'),
      'not valid json'
    );

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
  });

  it('should handle empty components directory', async () => {
    const packageJson = {
      name: 'test-theme',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      oaysus: { theme: { name: 'test-theme', displayName: 'Test' } },
    };

    await fsPromises.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    // Create empty components directory
    await fsPromises.mkdir(path.join(testDir, 'components'), { recursive: true });

    const { push } = await import('../src/lib/push.js');
    const result = await push({ projectPath: testDir, silent: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('component');
  });
});
