import { jest } from '@jest/globals';
/**
 * Expanded tests for config.ts to achieve comprehensive code coverage
 *
 * Strategy:
 * 1. Test exported values and functions directly
 * 2. Use subprocess tests to exercise internal functions with different env vars
 *    (This bypasses Bun's module caching by starting fresh processes)
 * 3. Test debug/debugError with DEBUG=true via subprocess
 *
 * Coverage Notes:
 * - Standard test run (NODE_ENV=test): ~56% line coverage
 *   - loadEnvLocal() returns early, skipping internal function calls
 * - Production run (NODE_ENV=production): ~84% line coverage
 *   - Full initialization code paths are executed
 *   - Remaining uncovered lines are:
 *     - CJS fallback paths (lines 32-35): Only run in CommonJS, not ESM
 *     - Error handling (lines 52-53): Require corrupted package.json
 *     - Loop exhaustion (lines 60, 62): Require 10+ nested dirs without valid package.json
 *
 * To run with full initialization coverage:
 *   NODE_ENV=production bun test tests/config-expanded.test.ts --coverage
 */

import { spawn, spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import the module once - these values are determined at load time
import {
  config,
  SSO_BASE_URL,
  ADMIN_URL,
  R2_PUBLIC_URL,
  API_STAGE,
  DEVELOPER,
  DEBUG,
  CREDENTIALS_PATH,
  CONFIG_DIR,
  IS_LOCAL_DEV,
  getEnvironment,
  debug,
  debugError,
} from '../src/lib/shared/config.js';

const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Helper to run a script in a subprocess with custom environment
 * Uses `bun -e` to evaluate the script
 */
function runScript(script: string, env: Record<string, string> = {}): { stdout: string; stderr: string; exitCode: number } {
  // Remove indentation from multi-line scripts
  const cleanScript = script.trim().split('\n').map(line => line.trim()).join('\n');

  const result = spawnSync('bun', ['-e', cleanScript], {
    cwd: CLI_ROOT,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf-8',
  });

  return {
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
    exitCode: result.status || 0,
  };
}

/**
 * Parse JSON from script output (gets last line)
 */
function parseOutput(stdout: string): any {
  const lines = stdout.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  return JSON.parse(lastLine);
}

describe('config module - expanded tests', () => {
  describe('URL configuration', () => {
    it('should have valid SSO_BASE_URL', () => {
      expect(SSO_BASE_URL).toMatch(/^https?:\/\//);
      expect(
        SSO_BASE_URL.includes('auth.oaysus.com') ||
        SSO_BASE_URL.includes('localhost')
      ).toBe(true);
    });

    it('should have valid ADMIN_URL', () => {
      expect(ADMIN_URL).toMatch(/^https?:\/\//);
      expect(
        ADMIN_URL.includes('admin.oaysus.com') ||
        ADMIN_URL.includes('localhost')
      ).toBe(true);
    });

    it('should have valid R2_PUBLIC_URL', () => {
      expect(R2_PUBLIC_URL).toMatch(/^https?:\/\//);
    });
  });

  describe('API_STAGE', () => {
    it('should be a valid stage value', () => {
      expect(['local', 'dev', 'prod', 'production']).toContain(API_STAGE);
    });
  });

  describe('DEBUG flag', () => {
    it('should be a boolean', () => {
      expect(typeof DEBUG).toBe('boolean');
    });
  });

  describe('DEVELOPER', () => {
    it('should be string or undefined', () => {
      expect(DEVELOPER === undefined || typeof DEVELOPER === 'string').toBe(true);
    });
  });

  describe('getEnvironment()', () => {
    it('should return a valid environment value', () => {
      const env = getEnvironment();
      expect(['local', 'dev', 'prod']).toContain(env);
    });

    it('should return consistent results', () => {
      expect(getEnvironment()).toBe(getEnvironment());
    });
  });

  describe('CREDENTIALS_PATH', () => {
    it('should point to credentials.json in home directory', () => {
      expect(CREDENTIALS_PATH).toContain(os.homedir());
      expect(CREDENTIALS_PATH).toContain('credentials.json');
    });

    it('should be an absolute path', () => {
      expect(CREDENTIALS_PATH.startsWith('/')).toBe(true);
    });
  });

  describe('CONFIG_DIR', () => {
    it('should be in home directory', () => {
      expect(CONFIG_DIR).toContain(os.homedir());
    });

    it('should be an absolute path', () => {
      expect(CONFIG_DIR.startsWith('/')).toBe(true);
    });
  });

  describe('debug helpers - basic', () => {
    it('debug() should be a function', () => {
      expect(typeof debug).toBe('function');
    });

    it('debug() should not throw when called', () => {
      expect(() => debug('test message')).not.toThrow();
    });

    it('debug() should accept multiple arguments', () => {
      expect(() => debug('message', { data: 'test' }, 123)).not.toThrow();
    });

    it('debugError() should be a function', () => {
      expect(typeof debugError).toBe('function');
    });

    it('debugError() should not throw when called', () => {
      expect(() => debugError('test error')).not.toThrow();
    });

    it('debugError() should accept multiple arguments', () => {
      expect(() => debugError('error', new Error('test'), { detail: 'info' })).not.toThrow();
    });

    it('debug functions should be callable without arguments', () => {
      expect(() => debug()).not.toThrow();
      expect(() => debugError()).not.toThrow();
    });
  });

  describe('config object', () => {
    it('should have all expected properties', () => {
      expect(config.SSO_BASE_URL).toBeDefined();
      expect(config.ADMIN_URL).toBeDefined();
      expect(config.R2_PUBLIC_URL).toBeDefined();
      expect(config.API_STAGE).toBeDefined();
      expect(typeof config.DEBUG).toBe('boolean');
      expect(config.CREDENTIALS_PATH).toBeDefined();
      expect(config.CONFIG_DIR).toBeDefined();
      expect(typeof config.IS_LOCAL_DEV).toBe('boolean');
    });

    it('should have named exports matching config object', () => {
      expect(SSO_BASE_URL).toBe(config.SSO_BASE_URL);
      expect(ADMIN_URL).toBe(config.ADMIN_URL);
      expect(R2_PUBLIC_URL).toBe(config.R2_PUBLIC_URL);
      expect(API_STAGE).toBe(config.API_STAGE);
      expect(DEBUG).toBe(config.DEBUG);
      expect(DEVELOPER).toBe(config.DEVELOPER);
      expect(CREDENTIALS_PATH).toBe(config.CREDENTIALS_PATH);
      expect(CONFIG_DIR).toBe(config.CONFIG_DIR);
      expect(IS_LOCAL_DEV).toBe(config.IS_LOCAL_DEV);
    });
  });

  describe('IS_LOCAL_DEV', () => {
    it('should be a boolean', () => {
      expect(typeof IS_LOCAL_DEV).toBe('boolean');
    });

    it('should be false in test environment (NODE_ENV=test)', () => {
      // loadEnvLocal returns false when NODE_ENV=test
      // This test only applies when NODE_ENV is 'test'
      if (process.env.NODE_ENV === 'test') {
        expect(IS_LOCAL_DEV).toBe(false);
      } else {
        // When not in test mode, IS_LOCAL_DEV depends on whether .env.local exists
        expect(typeof IS_LOCAL_DEV).toBe('boolean');
      }
    });
  });
});

/**
 * Subprocess tests to cover internal functions and different env configurations
 * These run in fresh processes to bypass module caching
 */
describe('config.ts subprocess tests', () => {
  describe('getCurrentDir() internal function', () => {
    it('should work in ESM context (import.meta.url)', () => {
      const script = `
        import { config } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ success: true, hasConfigDir: !!config.CONFIG_DIR }));
      `;
      const result = runScript(script, { NODE_ENV: 'test' });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.success).toBe(true);
      expect(output.hasConfigDir).toBe(true);
    });
  });

  describe('findCliRoot() internal function', () => {
    it('should find CLI root directory with package.json', () => {
      const script = `
        import { CONFIG_DIR } from './src/lib/shared/config.js';
        // CONFIG_DIR should be constructed from findCliRoot result
        const hasOaysus = CONFIG_DIR.includes('.oaysus');
        console.log(JSON.stringify({ hasOaysus, configDir: CONFIG_DIR }));
      `;
      const result = runScript(script, { NODE_ENV: 'test' });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.hasOaysus).toBe(true);
    });
  });

  describe('loadEnvLocal() internal function', () => {
    it('should return false in test environment (NODE_ENV=test)', () => {
      const script = `
        import { IS_LOCAL_DEV } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ isLocalDev: IS_LOCAL_DEV }));
      `;
      const result = runScript(script, { NODE_ENV: 'test' });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.isLocalDev).toBe(false);
    });

    it('should return false when JEST_WORKER_ID is set', () => {
      const script = `
        import { IS_LOCAL_DEV } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ isLocalDev: IS_LOCAL_DEV }));
      `;
      const result = runScript(script, { JEST_WORKER_ID: '1' });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.isLocalDev).toBe(false);
    });

    it('should attempt to load .env.local when not in test mode', () => {
      // When NODE_ENV is not 'test', loadEnvLocal tries to find .env.local
      // It will return false if .env.local doesn't exist
      const script = `
        import { IS_LOCAL_DEV, CONFIG_DIR } from './src/lib/shared/config.js';
        // In production mode without .env.local, should use .oaysus (not .oaysus-local)
        const usesOaysusDir = CONFIG_DIR.includes('.oaysus') && !CONFIG_DIR.includes('.oaysus-local');
        console.log(JSON.stringify({ isLocalDev: IS_LOCAL_DEV, usesOaysusDir, configDir: CONFIG_DIR }));
      `;
      // Clear NODE_ENV and JEST_WORKER_ID to simulate production run
      const result = runScript(script, {
        NODE_ENV: '',
        JEST_WORKER_ID: '',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      // Without .env.local file, IS_LOCAL_DEV should be false
      expect(output.isLocalDev).toBe(false);
      expect(output.usesOaysusDir).toBe(true);
    });
  });

  describe('getEnvironment() with different API_STAGE values', () => {
    it('should return "local" when API_STAGE is "local"', () => {
      const script = `
        import { getEnvironment } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ env: getEnvironment() }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_STAGE: 'local',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.env).toBe('local');
    });

    it('should return "dev" when API_STAGE is "dev"', () => {
      const script = `
        import { getEnvironment } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ env: getEnvironment() }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_STAGE: 'dev',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.env).toBe('dev');
    });

    it('should return "prod" when API_STAGE is "prod"', () => {
      const script = `
        import { getEnvironment } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ env: getEnvironment() }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_STAGE: 'prod',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.env).toBe('prod');
    });

    it('should return "prod" when API_STAGE is "production"', () => {
      const script = `
        import { getEnvironment } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ env: getEnvironment() }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_STAGE: 'production',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.env).toBe('prod');
    });

    it('should default to "prod" for unknown API_STAGE values', () => {
      const script = `
        import { getEnvironment } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ env: getEnvironment() }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_STAGE: 'staging',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.env).toBe('prod');
    });

    it('should default to "prod" when API_STAGE is empty', () => {
      const script = `
        import { getEnvironment } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ env: getEnvironment() }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_STAGE: '',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.env).toBe('prod');
    });
  });

  describe('debug() with DEBUG=true', () => {
    it('should call console.log when DEBUG is true', () => {
      const script = `
        import { debug } from './src/lib/shared/config.js';

        let logCalled = false;
        let logArgs = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logCalled = true;
          logArgs = args;
        };

        debug('test message', 123, { foo: 'bar' });

        console.log = originalLog;
        console.log(JSON.stringify({
          logCalled,
          hasDebugPrefix: logArgs[0] === '[DEBUG]',
          hasTestMessage: logArgs.includes('test message'),
          hasNumber: logArgs.includes(123),
        }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        DEBUG: 'true',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.logCalled).toBe(true);
      expect(output.hasDebugPrefix).toBe(true);
      expect(output.hasTestMessage).toBe(true);
      expect(output.hasNumber).toBe(true);
    });

    it('should NOT call console.log when DEBUG is false', () => {
      const script = `
        import { debug } from './src/lib/shared/config.js';

        let logCalled = false;
        const originalLog = console.log;
        console.log = (...args) => {
          logCalled = true;
        };

        debug('test message');

        console.log = originalLog;
        console.log(JSON.stringify({ logCalled }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        DEBUG: 'false',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.logCalled).toBe(false);
    });

    it('should NOT call console.log when DEBUG is unset', () => {
      const script = `
        import { debug } from './src/lib/shared/config.js';

        let logCalled = false;
        const originalLog = console.log;
        console.log = (...args) => {
          logCalled = true;
        };

        debug('test message');

        console.log = originalLog;
        console.log(JSON.stringify({ logCalled }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        DEBUG: '',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.logCalled).toBe(false);
    });
  });

  describe('debugError() with DEBUG=true', () => {
    it('should call console.error when DEBUG is true', () => {
      const script = `
        import { debugError } from './src/lib/shared/config.js';

        let errorCalled = false;
        let errorArgs = [];
        const originalError = console.error;
        console.error = (...args) => {
          errorCalled = true;
          errorArgs = args;
        };

        debugError('error message', 'details');

        console.error = originalError;
        console.log(JSON.stringify({
          errorCalled,
          hasErrorPrefix: errorArgs[0] === '[ERROR]',
          hasErrorMessage: errorArgs.includes('error message'),
          hasDetails: errorArgs.includes('details'),
        }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        DEBUG: 'true',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.errorCalled).toBe(true);
      expect(output.hasErrorPrefix).toBe(true);
      expect(output.hasErrorMessage).toBe(true);
      expect(output.hasDetails).toBe(true);
    });

    it('should NOT call console.error when DEBUG is false', () => {
      const script = `
        import { debugError } from './src/lib/shared/config.js';

        let errorCalled = false;
        const originalError = console.error;
        console.error = (...args) => {
          errorCalled = true;
        };

        debugError('error message');

        console.error = originalError;
        console.log(JSON.stringify({ errorCalled }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        DEBUG: 'false',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.errorCalled).toBe(false);
    });
  });

  describe('environment variable overrides', () => {
    it('should use NEXT_PUBLIC_OAYSUS_SSO_URL when set', () => {
      const customUrl = 'https://custom-sso.example.com';
      const script = `
        import { SSO_BASE_URL } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ url: SSO_BASE_URL }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_OAYSUS_SSO_URL: customUrl,
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.url).toBe(customUrl);
    });

    it('should use NEXT_PUBLIC_OAYSUS_ADMIN_URL when set', () => {
      const customUrl = 'https://custom-admin.example.com';
      const script = `
        import { ADMIN_URL } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ url: ADMIN_URL }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_OAYSUS_ADMIN_URL: customUrl,
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.url).toBe(customUrl);
    });

    it('should use NEXT_PUBLIC_R2_PUBLIC_URL when set', () => {
      const customUrl = 'https://custom-r2.example.com';
      const script = `
        import { R2_PUBLIC_URL } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ url: R2_PUBLIC_URL }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_R2_PUBLIC_URL: customUrl,
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.url).toBe(customUrl);
    });

    it('should use DEVELOPER when set', () => {
      const script = `
        import { DEVELOPER } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ developer: DEVELOPER }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        DEVELOPER: 'test-developer',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.developer).toBe('test-developer');
    });

    it('should fall back to production SSO_BASE_URL when env not set', () => {
      const script = `
        import { SSO_BASE_URL } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ url: SSO_BASE_URL }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_OAYSUS_SSO_URL: '',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.url).toBe('https://auth.oaysus.com');
    });

    it('should fall back to production ADMIN_URL when env not set', () => {
      const script = `
        import { ADMIN_URL } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ url: ADMIN_URL }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_OAYSUS_ADMIN_URL: '',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.url).toBe('https://admin.oaysus.com');
    });

    it('should fall back to production R2_PUBLIC_URL when env not set', () => {
      const script = `
        import { R2_PUBLIC_URL } from './src/lib/shared/config.js';
        console.log(JSON.stringify({ url: R2_PUBLIC_URL }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
        NEXT_PUBLIC_R2_PUBLIC_URL: '',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.url).toBe('https://pub-71eb20e9b97849f18a95eaa92feb648a.r2.dev');
    });
  });

  describe('CONFIG_DIR behavior', () => {
    it('should use .oaysus when IS_LOCAL_DEV is false', () => {
      const script = `
        import { CONFIG_DIR, IS_LOCAL_DEV } from './src/lib/shared/config.js';
        console.log(JSON.stringify({
          configDir: CONFIG_DIR,
          isLocalDev: IS_LOCAL_DEV,
          usesOaysus: CONFIG_DIR.includes('.oaysus') && !CONFIG_DIR.includes('.oaysus-local'),
        }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.isLocalDev).toBe(false);
      expect(output.usesOaysus).toBe(true);
    });
  });

  describe('CREDENTIALS_PATH behavior', () => {
    it('should be inside CONFIG_DIR', () => {
      const script = `
        import { CREDENTIALS_PATH, CONFIG_DIR } from './src/lib/shared/config.js';
        console.log(JSON.stringify({
          credentialsPath: CREDENTIALS_PATH,
          configDir: CONFIG_DIR,
          isInside: CREDENTIALS_PATH.startsWith(CONFIG_DIR),
        }));
      `;
      const result = runScript(script, {
        NODE_ENV: 'test',
      });
      expect(result.exitCode).toBe(0);
      const output = parseOutput(result.stdout);
      expect(output.isInside).toBe(true);
      expect(output.credentialsPath).toContain('credentials.json');
    });
  });
});

/**
 * Additional edge case tests
 */
describe('config.ts edge cases', () => {
  describe('debug with various argument types', () => {
    it('should handle null arguments', () => {
      expect(() => debug(null)).not.toThrow();
      expect(() => debugError(null)).not.toThrow();
    });

    it('should handle undefined arguments', () => {
      expect(() => debug(undefined)).not.toThrow();
      expect(() => debugError(undefined)).not.toThrow();
    });

    it('should handle Error objects', () => {
      expect(() => debug(new Error('test'))).not.toThrow();
      expect(() => debugError(new Error('test'))).not.toThrow();
    });

    it('should handle arrays', () => {
      expect(() => debug([1, 2, 3])).not.toThrow();
      expect(() => debugError([1, 2, 3])).not.toThrow();
    });

    it('should handle nested objects', () => {
      expect(() => debug({ a: { b: { c: 1 } } })).not.toThrow();
      expect(() => debugError({ a: { b: { c: 1 } } })).not.toThrow();
    });

    it('should handle functions', () => {
      expect(() => debug(() => {})).not.toThrow();
      expect(() => debugError(() => {})).not.toThrow();
    });

    it('should handle Symbol', () => {
      expect(() => debug(Symbol('test'))).not.toThrow();
      expect(() => debugError(Symbol('test'))).not.toThrow();
    });

    it('should handle BigInt', () => {
      expect(() => debug(BigInt(123))).not.toThrow();
      expect(() => debugError(BigInt(123))).not.toThrow();
    });
  });

  describe('Environment type export', () => {
    it('should export Environment type (verified by getEnvironment return)', () => {
      type Environment = ReturnType<typeof getEnvironment>;
      const env: Environment = getEnvironment();
      expect(['local', 'dev', 'prod']).toContain(env);
    });
  });
});

/**
 * Tests that temporarily modify config.DEBUG to exercise debug logging paths
 * This covers line 163 (console.log in debug) and line 171 (console.error in debugError)
 */
describe('debug functions with DEBUG enabled', () => {
  let originalDebug: boolean;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Save original DEBUG value
    originalDebug = config.DEBUG;
    // Temporarily enable DEBUG by modifying the config object
    // Note: This works because config is a const object, but its properties can still be modified
    (config as any).DEBUG = true;

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original DEBUG value
    (config as any).DEBUG = originalDebug;
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('debug() should call console.log with [DEBUG] prefix when DEBUG is enabled', () => {
    debug('test message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', 'test message');
  });

  it('debug() should pass all arguments to console.log', () => {
    const obj = { key: 'value' };
    const num = 42;
    debug('message', obj, num);
    expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', 'message', obj, num);
  });

  it('debug() should handle no arguments', () => {
    debug();
    expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]');
  });

  it('debugError() should call console.error with [ERROR] prefix when DEBUG is enabled', () => {
    debugError('error message');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'error message');
  });

  it('debugError() should pass all arguments to console.error', () => {
    const err = new Error('test error');
    const context = { detail: 'info' };
    debugError('Error:', err, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'Error:', err, context);
  });

  it('debugError() should handle no arguments', () => {
    debugError();
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]');
  });

  it('debug() should handle complex objects', () => {
    const complexObj = {
      nested: { deep: { value: 123 } },
      array: [1, 2, 3],
      fn: () => 'test',
    };
    debug('Complex:', complexObj);
    expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG]', 'Complex:', complexObj);
  });

  it('debugError() should handle multiple error types', () => {
    const typeError = new TypeError('type error');
    const rangeError = new RangeError('range error');
    debugError('Errors:', typeError, rangeError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'Errors:', typeError, rangeError);
  });
});

/**
 * Test debug functions with DEBUG disabled to ensure they DON'T log
 */
describe('debug functions with DEBUG disabled', () => {
  let originalDebug: boolean;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Save original DEBUG value
    originalDebug = config.DEBUG;
    // Explicitly disable DEBUG
    (config as any).DEBUG = false;

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original DEBUG value
    (config as any).DEBUG = originalDebug;
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('debug() should NOT call console.log when DEBUG is disabled', () => {
    debug('should not log');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('debugError() should NOT call console.error when DEBUG is disabled', () => {
    debugError('should not log');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

/**
 * Test getEnvironment() with different API_STAGE values
 * by temporarily modifying config.API_STAGE
 */
describe('getEnvironment() with all API_STAGE values', () => {
  let originalApiStage: string;

  beforeEach(() => {
    originalApiStage = config.API_STAGE;
  });

  afterEach(() => {
    (config as any).API_STAGE = originalApiStage;
  });

  it('should return "local" when API_STAGE is "local"', () => {
    (config as any).API_STAGE = 'local';
    expect(getEnvironment()).toBe('local');
  });

  it('should return "dev" when API_STAGE is "dev"', () => {
    (config as any).API_STAGE = 'dev';
    expect(getEnvironment()).toBe('dev');
  });

  it('should return "prod" when API_STAGE is "prod"', () => {
    (config as any).API_STAGE = 'prod';
    expect(getEnvironment()).toBe('prod');
  });

  it('should return "prod" when API_STAGE is "production"', () => {
    (config as any).API_STAGE = 'production';
    expect(getEnvironment()).toBe('prod');
  });

  it('should default to "prod" when API_STAGE is unknown', () => {
    (config as any).API_STAGE = 'staging';
    expect(getEnvironment()).toBe('prod');
  });

  it('should default to "prod" when API_STAGE is empty', () => {
    (config as any).API_STAGE = '';
    expect(getEnvironment()).toBe('prod');
  });
});
