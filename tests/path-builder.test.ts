/**
 * Tests for path-builder.ts
 * Verifies R2 path construction for different environments
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { PackageJson } from '../src/types/validation.js';
import type { Credentials } from '../src/types/index.js';

// Store original env
const originalEnv = { ...process.env };

// Mock credentials
const mockCredentials: Credentials = {
  jwt: 'mock-jwt-token',
  userId: 'user-123',
  email: 'test@example.com',
  websiteId: 'website-456',
  websiteName: 'Test Website',
  platforms: ['oaysus'],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};

// Mock package.json
const mockPackageJson: PackageJson = {
  name: 'test-theme',
  version: '1.0.0',
  oaysus: {
    theme: {
      name: 'my-theme',
      displayName: 'My Theme',
    },
  },
};

describe('path-builder module', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_STAGE;
    delete process.env.DEVELOPER;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('buildR2Path()', () => {
    it('should build production path correctly', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      const { buildR2Path } = await import('../src/lib/shared/path-builder.js');
      const path = buildR2Path(mockPackageJson, mockCredentials);
      expect(path).toBe('prod/website-456/my-theme/1.0.0');
    });

    it('should build dev path correctly', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'dev';
      const { buildR2Path } = await import('../src/lib/shared/path-builder.js');
      const path = buildR2Path(mockPackageJson, mockCredentials);
      expect(path).toBe('dev/website-456/my-theme/1.0.0');
    });

    it('should build local path with developer namespace', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'local';
      process.env.DEVELOPER = 'john-doe';
      const { buildR2Path } = await import('../src/lib/shared/path-builder.js');
      const path = buildR2Path(mockPackageJson, mockCredentials);
      expect(path).toBe('local/john-doe/website-456/my-theme/1.0.0');
    });

    it('should use "unknown" developer when not set in local mode', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'local';
      const { buildR2Path } = await import('../src/lib/shared/path-builder.js');
      const path = buildR2Path(mockPackageJson, mockCredentials);
      expect(path).toBe('local/unknown/website-456/my-theme/1.0.0');
    });

    it('should use package name when oaysus.theme.name not set', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      const pkgWithoutThemeName: PackageJson = {
        name: 'fallback-name',
        version: '2.0.0',
      };
      const { buildR2Path } = await import('../src/lib/shared/path-builder.js');
      const path = buildR2Path(pkgWithoutThemeName, mockCredentials);
      expect(path).toBe('prod/website-456/fallback-name/2.0.0');
    });
  });

  describe('buildUploadMetadata()', () => {
    it('should build complete metadata for production', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      const { buildUploadMetadata } = await import('../src/lib/shared/path-builder.js');
      const metadata = buildUploadMetadata(mockPackageJson, mockCredentials);

      expect(metadata).toEqual({
        environment: 'prod',
        developer: undefined,
        websiteId: 'website-456',
        themeName: 'my-theme',
        displayName: 'My Theme',
        version: '1.0.0',
        r2Path: 'prod/website-456/my-theme/1.0.0',
        importMap: undefined,
        stylesheets: undefined,
        dependencies: undefined,
      });
    });

    it('should include developer in local environment', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'local';
      process.env.DEVELOPER = 'test-dev';
      const { buildUploadMetadata } = await import('../src/lib/shared/path-builder.js');
      const metadata = buildUploadMetadata(mockPackageJson, mockCredentials);

      expect(metadata.environment).toBe('local');
      expect(metadata.developer).toBe('test-dev');
    });

    it('should include optional parameters when provided', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      const { buildUploadMetadata } = await import('../src/lib/shared/path-builder.js');
      const metadata = buildUploadMetadata(mockPackageJson, mockCredentials, {
        importMap: { react: 'https://esm.sh/react@18' },
        stylesheets: { main: '/styles/main.css' },
        dependencies: [{ name: 'react', version: '18.2.0' }],
      });

      expect(metadata.importMap).toEqual({ react: 'https://esm.sh/react@18' });
      expect(metadata.stylesheets).toEqual({ main: '/styles/main.css' });
      expect(metadata.dependencies).toEqual([{ name: 'react', version: '18.2.0' }]);
    });

    it('should use theme name as displayName when displayName not set', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      // Test runtime behavior when displayName is missing at runtime
      // Use 'as any' to bypass TypeScript check for this edge case test
      const pkgWithoutDisplayName = {
        name: 'simple-theme',
        version: '1.0.0',
        oaysus: {
          theme: {
            name: 'simple-theme',
            // displayName intentionally omitted to test fallback
          },
        },
      } as PackageJson;
      const { buildUploadMetadata } = await import('../src/lib/shared/path-builder.js');
      const metadata = buildUploadMetadata(pkgWithoutDisplayName, mockCredentials);

      expect(metadata.displayName).toBe('simple-theme');
    });
  });

  describe('getThemeBasePath()', () => {
    it('should return base path without version for production', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'prod';
      const { getThemeBasePath } = await import('../src/lib/shared/path-builder.js');
      const path = getThemeBasePath(mockPackageJson, mockCredentials);
      expect(path).toBe('prod/website-456/my-theme');
    });

    it('should include developer namespace in local mode', async () => {
      process.env.NEXT_PUBLIC_API_STAGE = 'local';
      process.env.DEVELOPER = 'alice';
      const { getThemeBasePath } = await import('../src/lib/shared/path-builder.js');
      const path = getThemeBasePath(mockPackageJson, mockCredentials);
      expect(path).toBe('local/alice/website-456/my-theme');
    });
  });
});
