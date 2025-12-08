/**
 * Tests for config.ts
 * Verifies configuration defaults and environment variable overrides
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Store original env
const originalEnv = { ...process.env };

describe('config module', () => {
  beforeEach(() => {
    // Reset modules to reload config with fresh env
    jest.resetModules();
    // Clear all OAYSUS-related env vars
    delete process.env.NEXT_PUBLIC_OAYSUS_SSO_URL;
    delete process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL;
    delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_API_STAGE;
    delete process.env.DEVELOPER;
    delete process.env.DEBUG;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('production defaults', () => {
    it('should have correct SSO_BASE_URL default', async () => {
      const { SSO_BASE_URL } = await import('../src/lib/shared/config.js');
      expect(SSO_BASE_URL).toBe('https://auth.oaysus.com');
    });

    it('should have correct ADMIN_URL default', async () => {
      const { ADMIN_URL } = await import('../src/lib/shared/config.js');
      expect(ADMIN_URL).toBe('https://admin.oaysus.com');
    });

    it('should have correct R2_PUBLIC_URL default', async () => {
      const { R2_PUBLIC_URL } = await import('../src/lib/shared/config.js');
      expect(R2_PUBLIC_URL).toBe('https://pub-71eb20e9b97849f18a95eaa92feb648a.r2.dev');
    });

    it('should have correct API_STAGE default (prod)', async () => {
      const { API_STAGE } = await import('../src/lib/shared/config.js');
      expect(API_STAGE).toBe('prod');
    });

    it('should have DEBUG disabled by default', async () => {
      const { DEBUG } = await import('../src/lib/shared/config.js');
      expect(DEBUG).toBe(false);
    });

    it('should have DEVELOPER undefined by default', async () => {
      const { DEVELOPER } = await import('../src/lib/shared/config.js');
      expect(DEVELOPER).toBeUndefined();
    });
  });

  describe('environment variable overrides', () => {
    it('should override SSO_BASE_URL from env', async () => {
      process.env.NEXT_PUBLIC_OAYSUS_SSO_URL = 'http://localhost:3000';
      const { SSO_BASE_URL } = await import('../src/lib/shared/config.js');
      expect(SSO_BASE_URL).toBe('http://localhost:3000');
    });

    it('should override ADMIN_URL from env', async () => {
      process.env.NEXT_PUBLIC_OAYSUS_ADMIN_URL = 'http://localhost:3001';
      const { ADMIN_URL } = await import('../src/lib/shared/config.js');
      expect(ADMIN_URL).toBe('http://localhost:3001');
    });

    it('should override R2_PUBLIC_URL from env', async () => {
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'http://localhost:9000';
      const { R2_PUBLIC_URL } = await import('../src/lib/shared/config.js');
      expect(R2_PUBLIC_URL).toBe('http://localhost:9000');
    });

    it('should override API_STAGE from env', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'local';
      const { API_STAGE } = await import('../src/lib/shared/config.js');
      expect(API_STAGE).toBe('local');
    });

    it('should set DEVELOPER from env', async () => {
      process.env.DEVELOPER = 'test-user';
      const { DEVELOPER } = await import('../src/lib/shared/config.js');
      expect(DEVELOPER).toBe('test-user');
    });

    it('should enable DEBUG when env is "true"', async () => {
      process.env.DEBUG = 'true';
      const { DEBUG } = await import('../src/lib/shared/config.js');
      expect(DEBUG).toBe(true);
    });

    it('should keep DEBUG disabled for non-true values', async () => {
      process.env.DEBUG = 'false';
      const { DEBUG } = await import('../src/lib/shared/config.js');
      expect(DEBUG).toBe(false);
    });
  });

  describe('getEnvironment()', () => {
    it('should return "local" when API_STAGE is local', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'local';
      const { getEnvironment } = await import('../src/lib/shared/config.js');
      expect(getEnvironment()).toBe('local');
    });

    it('should return "dev" when API_STAGE is dev', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'dev';
      const { getEnvironment } = await import('../src/lib/shared/config.js');
      expect(getEnvironment()).toBe('dev');
    });

    it('should return "prod" when API_STAGE is prod', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      const { getEnvironment } = await import('../src/lib/shared/config.js');
      expect(getEnvironment()).toBe('prod');
    });

    it('should return "prod" when API_STAGE is production', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'production';
      const { getEnvironment } = await import('../src/lib/shared/config.js');
      expect(getEnvironment()).toBe('prod');
    });

    it('should default to "prod" when no stage set', async () => {
      const { getEnvironment } = await import('../src/lib/shared/config.js');
      expect(getEnvironment()).toBe('prod');
    });
  });

  describe('CREDENTIALS_PATH', () => {
    it('should point to ~/.oaysus/credentials.json', async () => {
      const { CREDENTIALS_PATH } = await import('../src/lib/shared/config.js');
      const os = await import('os');
      expect(CREDENTIALS_PATH).toContain(os.homedir());
      expect(CREDENTIALS_PATH).toContain('.oaysus');
      expect(CREDENTIALS_PATH).toContain('credentials.json');
    });
  });

  describe('debug helpers', () => {
    it('should not log when DEBUG is false', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const { debug } = await import('../src/lib/shared/config.js');
      debug('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log errors when DEBUG is false', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { debugError } = await import('../src/lib/shared/config.js');
      debugError('test error');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
