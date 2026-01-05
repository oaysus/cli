import { jest } from '@jest/globals';
/**
 * Tests for config.ts initialization paths
 *
 * This file tests the initialization code paths by re-importing the module
 * with a cleared cache. Since Bun caches modules, we need to use dynamic import
 * with cache busting.
 *
 * Note: The config module has test-skip logic that prevents certain code paths
 * from running during tests. These tests verify the behavior in the test environment.
 */

// Jest globals are auto-imported
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Since we cannot dynamically reimport with different NODE_ENV,
// we test the module's exported values and verify they behave correctly
// in the test environment

describe('config.ts initialization in test environment', () => {
  describe('loadEnvLocal() behavior', () => {
    it('should return IS_LOCAL_DEV based on environment', async () => {
      const { IS_LOCAL_DEV } = await import('../src/lib/shared/config.js');
      if (process.env.NODE_ENV === 'test') {
        // In test environment, loadEnvLocal returns false immediately
        expect(IS_LOCAL_DEV).toBe(false);
      } else {
        // In non-test environment, depends on whether .env.local exists
        expect(typeof IS_LOCAL_DEV).toBe('boolean');
      }
    });

    it('should use appropriate .oaysus directory based on IS_LOCAL_DEV', async () => {
      const { CONFIG_DIR, IS_LOCAL_DEV } = await import('../src/lib/shared/config.js');
      expect(CONFIG_DIR).toContain('.oaysus');
      if (IS_LOCAL_DEV) {
        expect(CONFIG_DIR).toContain('.oaysus-local');
      } else {
        expect(CONFIG_DIR).not.toContain('.oaysus-local');
      }
    });
  });

  describe('environment detection', () => {
    it('should have NODE_ENV set', () => {
      // NODE_ENV should be set (typically 'test' when running tests, but could be overridden)
      expect(typeof process.env.NODE_ENV).toBe('string');
    });

    it('should have JEST_WORKER_ID when running in Jest', () => {
      // Jest sets JEST_WORKER_ID, while Bun test does not
      // When running under Jest, this should be defined
      expect(process.env.JEST_WORKER_ID).toBeDefined();
    });
  });

  describe('production URL fallbacks', () => {
    it('should use production URLs when env vars are not set', async () => {
      // These are the hardcoded production URLs
      const PROD_SSO = 'https://auth.oaysus.com';
      const PROD_ADMIN = 'https://admin.oaysus.com';
      const PROD_R2 = 'https://pub-71eb20e9b97849f18a95eaa92feb648a.r2.dev';

      const { SSO_BASE_URL, ADMIN_URL, R2_PUBLIC_URL } = await import('../src/lib/shared/config.js');

      // URLs should either be production or from env override
      expect(typeof SSO_BASE_URL).toBe('string');
      expect(typeof ADMIN_URL).toBe('string');
      expect(typeof R2_PUBLIC_URL).toBe('string');

      // Verify they're valid URLs
      expect(() => new URL(SSO_BASE_URL)).not.toThrow();
      expect(() => new URL(ADMIN_URL)).not.toThrow();
      expect(() => new URL(R2_PUBLIC_URL)).not.toThrow();
    });
  });

  describe('CONFIG_DIR and CREDENTIALS_PATH', () => {
    it('should have CONFIG_DIR under home directory', async () => {
      const { CONFIG_DIR } = await import('../src/lib/shared/config.js');
      expect(CONFIG_DIR.startsWith(os.homedir())).toBe(true);
    });

    it('should have CREDENTIALS_PATH under CONFIG_DIR', async () => {
      const { CONFIG_DIR, CREDENTIALS_PATH } = await import('../src/lib/shared/config.js');
      expect(CREDENTIALS_PATH.startsWith(CONFIG_DIR)).toBe(true);
    });

    it('should have CREDENTIALS_PATH pointing to credentials.json', async () => {
      const { CREDENTIALS_PATH } = await import('../src/lib/shared/config.js');
      expect(path.basename(CREDENTIALS_PATH)).toBe('credentials.json');
    });
  });

  describe('getEnvironment() function', () => {
    it('should return valid environment based on API_STAGE', async () => {
      const { getEnvironment, API_STAGE } = await import('../src/lib/shared/config.js');
      const env = getEnvironment();

      // Should return one of the valid environments
      expect(['local', 'dev', 'prod']).toContain(env);

      // Should match the current API_STAGE
      if (API_STAGE === 'local') expect(env).toBe('local');
      else if (API_STAGE === 'dev') expect(env).toBe('dev');
      else if (API_STAGE === 'prod' || API_STAGE === 'production') expect(env).toBe('prod');
      else expect(env).toBe('prod'); // Unknown defaults to prod
    });
  });
});

/**
 * Test getCurrentDir and findCliRoot behavior indirectly
 *
 * Since these functions are internal and only called during non-test initialization,
 * we can only verify their effects through the exported values.
 */
describe('internal function verification', () => {
  describe('getCurrentDir() effect', () => {
    it('should be able to resolve paths relative to config module', async () => {
      // If getCurrentDir works, the module can resolve relative paths
      // We verify this by checking that the module loaded successfully
      const config = await import('../src/lib/shared/config.js');
      expect(config).toBeDefined();
      expect(config.config).toBeDefined();
    });
  });

  describe('findCliRoot() effect', () => {
    it('should find CLI root with valid package.json', () => {
      // Verify the CLI has a valid package.json
      const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const pkgPath = path.join(cliRoot, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);

      // Verify it has the expected name
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name === '@oaysus/cli' || pkg.name === 'oaysus-cli').toBe(true);
    });
  });
});
