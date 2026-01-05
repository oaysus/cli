/**
 * Tests for config.ts
 * Verifies configuration defaults and helper functions
 */

// Jest globals are auto-imported
import os from 'os';
import path from 'path';

// Import directly without mocking - test the actual module
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

describe('config module', () => {
  describe('exported config object', () => {
    it('should export a config object with all required properties', () => {
      expect(config).toBeDefined();
      expect(typeof config.SSO_BASE_URL).toBe('string');
      expect(typeof config.ADMIN_URL).toBe('string');
      expect(typeof config.R2_PUBLIC_URL).toBe('string');
      expect(typeof config.API_STAGE).toBe('string');
      expect(typeof config.DEBUG).toBe('boolean');
      expect(typeof config.CREDENTIALS_PATH).toBe('string');
      expect(typeof config.CONFIG_DIR).toBe('string');
      expect(typeof config.IS_LOCAL_DEV).toBe('boolean');
    });

    it('should export individual named exports matching config object', () => {
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

  describe('URL defaults', () => {
    it('should have correct SSO_BASE_URL', () => {
      expect(SSO_BASE_URL).toMatch(/^https?:\/\//);
      // Should be either local or production URL
      expect(
        SSO_BASE_URL.includes('auth.oaysus.com') ||
        SSO_BASE_URL.includes('localhost')
      ).toBe(true);
    });

    it('should have correct ADMIN_URL', () => {
      expect(ADMIN_URL).toMatch(/^https?:\/\//);
      // Should be either local or production URL
      expect(
        ADMIN_URL.includes('admin.oaysus.com') ||
        ADMIN_URL.includes('localhost')
      ).toBe(true);
    });

    it('should have correct R2_PUBLIC_URL', () => {
      expect(R2_PUBLIC_URL).toMatch(/^https?:\/\//);
    });

    it('should have API_STAGE as a valid value', () => {
      expect(['local', 'dev', 'prod', 'production']).toContain(API_STAGE);
    });

    it('should have DEBUG as a boolean', () => {
      expect(typeof DEBUG).toBe('boolean');
    });
  });

  describe('CREDENTIALS_PATH', () => {
    it('should be an absolute path', () => {
      expect(CREDENTIALS_PATH.startsWith('/')).toBe(true);
    });

    it('should be a string', () => {
      expect(typeof CREDENTIALS_PATH).toBe('string');
    });

    it('should end with credentials.json', () => {
      expect(CREDENTIALS_PATH).toContain('credentials.json');
    });
  });

  describe('CONFIG_DIR', () => {
    it('should be an absolute path', () => {
      expect(CONFIG_DIR.startsWith('/')).toBe(true);
    });

    it('should be a string', () => {
      expect(typeof CONFIG_DIR).toBe('string');
    });
  });

  describe('getEnvironment()', () => {
    it('should return a valid environment type', () => {
      const env = getEnvironment();
      expect(['local', 'dev', 'prod']).toContain(env);
    });

    it('should return consistent results on multiple calls', () => {
      const env1 = getEnvironment();
      const env2 = getEnvironment();
      expect(env1).toBe(env2);
    });
  });

  describe('debug helpers', () => {
    describe('debug()', () => {
      it('should be a function', () => {
        expect(typeof debug).toBe('function');
      });

      it('should not throw when called', () => {
        expect(() => debug('test message')).not.toThrow();
      });

      it('should handle multiple arguments', () => {
        expect(() => debug('message', { key: 'value' }, 123)).not.toThrow();
      });

      it('should handle no arguments', () => {
        expect(() => debug()).not.toThrow();
      });
    });

    describe('debugError()', () => {
      it('should be a function', () => {
        expect(typeof debugError).toBe('function');
      });

      it('should not throw when called', () => {
        expect(() => debugError('test error')).not.toThrow();
      });

      it('should handle multiple arguments', () => {
        expect(() => debugError('error', new Error('test'), { detail: 'info' })).not.toThrow();
      });

      it('should handle no arguments', () => {
        expect(() => debugError()).not.toThrow();
      });
    });
  });

  describe('IS_LOCAL_DEV flag', () => {
    it('should be a boolean', () => {
      expect(typeof IS_LOCAL_DEV).toBe('boolean');
    });
  });

  describe('config object structure', () => {
    it('should have all expected keys', () => {
      const expectedKeys = [
        'SSO_BASE_URL',
        'ADMIN_URL',
        'R2_PUBLIC_URL',
        'API_STAGE',
        'DEVELOPER',
        'DEBUG',
        'CREDENTIALS_PATH',
        'CONFIG_DIR',
        'IS_LOCAL_DEV',
      ];
      const configKeys = Object.keys(config);
      for (const key of expectedKeys) {
        expect(configKeys).toContain(key);
      }
    });
  });
});
