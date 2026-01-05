/**
 * Tests for path-builder.ts
 * Comprehensive tests for R2 path construction and upload metadata
 *
 * Coverage Notes:
 * - Tests achieve 100% function coverage and test all code paths
 * - Line coverage may show ~91% because config.ts caches environment at load time
 * - The uncovered lines (53-54, 104-105) are the local environment branches
 * - These branches ARE tested when running with: NEXT_PUBLIC_API_STAGE=local
 *
 * To test local environment branches:
 *   NEXT_PUBLIC_API_STAGE=local DEVELOPER=test-dev bun test tests/path-builder.test.ts
 *
 * The tests are written to work correctly regardless of which environment is active,
 * using conditional expectations based on the actual environment.
 */

// Jest globals are auto-imported
import type { PackageJson } from '../src/types/validation.js';
import type { Credentials } from '../src/types/index.js';
import {
  buildR2Path,
  buildUploadMetadata,
  getThemeBasePath,
  type UploadMetadata,
} from '../src/lib/shared/path-builder.js';
import { getEnvironment, DEVELOPER } from '../src/lib/shared/config.js';

// Helper to create mock PackageJson
function createMockPackageJson(overrides: Partial<PackageJson> = {}): PackageJson {
  return {
    name: 'test-package',
    version: '1.0.0',
    ...overrides,
  };
}

// Helper to create mock Credentials
function createMockCredentials(overrides: Partial<Credentials> = {}): Credentials {
  return {
    jwt: 'test-jwt-token',
    userId: 'user-123',
    email: 'test@example.com',
    websiteId: 'website-456',
    websiteName: 'Test Website',
    subdomain: 'test',
    platforms: ['react'],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

// Get the current environment for test expectations
const currentEnv = getEnvironment();
const currentDeveloper = DEVELOPER;

describe('path-builder module', () => {
  describe('buildR2Path', () => {
    describe('path structure', () => {
      it('should build path with correct structure for current environment', () => {
        const packageJson = createMockPackageJson({
          name: 'my-theme',
          version: '2.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'site-abc',
        });

        const result = buildR2Path(packageJson, credentials);

        if (currentEnv === 'local') {
          const dev = currentDeveloper || 'unknown';
          expect(result).toBe(`local/${dev}/site-abc/my-theme/2.0.0`);
        } else {
          expect(result).toBe(`${currentEnv}/site-abc/my-theme/2.0.0`);
        }
      });

      it('should use oaysus theme name when provided', () => {
        const packageJson = createMockPackageJson({
          name: 'package-name',
          version: '1.5.0',
          oaysus: {
            theme: {
              name: 'custom-theme-name',
              displayName: 'Custom Theme',
            },
          },
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-123',
        });

        const result = buildR2Path(packageJson, credentials);

        if (currentEnv === 'local') {
          const dev = currentDeveloper || 'unknown';
          expect(result).toBe(`local/${dev}/ws-123/custom-theme-name/1.5.0`);
        } else {
          expect(result).toBe(`${currentEnv}/ws-123/custom-theme-name/1.5.0`);
        }
      });

      it('should fall back to package name when oaysus.theme.name is not set', () => {
        const packageJson = createMockPackageJson({
          name: 'fallback-name',
          version: '1.0.0',
          oaysus: {} as any,
        });
        const credentials = createMockCredentials({
          websiteId: 'site-id',
        });

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('fallback-name');
      });

      it('should include correct version in path', () => {
        const packageJson = createMockPackageJson({
          name: 'versioned-theme',
          version: '3.2.1',
        });
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('3.2.1');
        expect(result.endsWith('/3.2.1')).toBe(true);
      });

      it('should include correct websiteId in path', () => {
        const packageJson = createMockPackageJson({
          name: 'site-theme',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'unique-site-id-123',
        });

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('unique-site-id-123');
      });
    });

    describe('edge cases', () => {
      it('should handle package name with scope', () => {
        const packageJson = createMockPackageJson({
          name: '@scope/my-package',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'site-123',
        });

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('@scope/my-package');
      });

      it('should handle pre-release version', () => {
        const packageJson = createMockPackageJson({
          name: 'beta-theme',
          version: '1.0.0-beta.1',
        });
        const credentials = createMockCredentials({
          websiteId: 'site-456',
        });

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('1.0.0-beta.1');
      });

      it('should handle hyphenated theme names', () => {
        const packageJson = createMockPackageJson({
          name: 'my-awesome-theme-pack',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-789',
        });

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('my-awesome-theme-pack');
      });

      it('should handle underscore in theme names', () => {
        const packageJson = createMockPackageJson({
          name: 'theme_with_underscores',
          version: '2.0.0',
        });
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('theme_with_underscores');
      });

      it('should handle numeric version strings', () => {
        const packageJson = createMockPackageJson({
          name: 'numeric-version',
          version: '0.0.1',
        });
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(result).toContain('0.0.1');
      });
    });

    describe('path validation', () => {
      it('should return a string', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(typeof result).toBe('string');
      });

      it('should not have leading slash', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(result.startsWith('/')).toBe(false);
      });

      it('should not have trailing slash', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(result.endsWith('/')).toBe(false);
      });

      it('should contain the environment prefix', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildR2Path(packageJson, credentials);

        expect(result.startsWith(currentEnv) || result.startsWith('local')).toBe(true);
      });
    });
  });

  describe('buildUploadMetadata', () => {
    describe('required properties', () => {
      it('should include all required metadata fields', () => {
        const packageJson = createMockPackageJson({
          name: 'test-theme',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-123',
        });

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.environment).toBeDefined();
        expect(result.websiteId).toBe('ws-123');
        expect(result.themeName).toBe('test-theme');
        expect(result.displayName).toBe('test-theme');
        expect(result.version).toBe('1.0.0');
        expect(result.r2Path).toBeDefined();
      });

      it('should set environment correctly', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.environment).toBe(currentEnv);
      });

      it('should include r2Path matching buildR2Path output', () => {
        const packageJson = createMockPackageJson({
          name: 'sync-test',
          version: '1.0.0',
        });
        const credentials = createMockCredentials();

        const metadata = buildUploadMetadata(packageJson, credentials);
        const directPath = buildR2Path(packageJson, credentials);

        expect(metadata.r2Path).toBe(directPath);
      });
    });

    describe('optional properties', () => {
      it('should include importMap when provided', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();
        const options = {
          importMap: { react: 'https://cdn.example.com/react' },
        };

        const result = buildUploadMetadata(packageJson, credentials, options);

        expect(result.importMap).toEqual({ react: 'https://cdn.example.com/react' });
      });

      it('should include stylesheets when provided', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();
        const options = {
          stylesheets: { main: 'index.css', theme: 'theme.css' },
        };

        const result = buildUploadMetadata(packageJson, credentials, options);

        expect(result.stylesheets).toEqual({ main: 'index.css', theme: 'theme.css' });
      });

      it('should include dependencies when provided', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();
        const options = {
          dependencies: [
            { name: 'lodash', version: '4.17.21' },
            { name: 'dayjs', version: '1.11.0' },
          ],
        };

        const result = buildUploadMetadata(packageJson, credentials, options);

        expect(result.dependencies).toHaveLength(2);
        expect(result.dependencies![0].name).toBe('lodash');
        expect(result.dependencies![1].name).toBe('dayjs');
      });

      it('should include all optional fields together', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();
        const options = {
          importMap: { react: 'https://cdn.example.com/react' },
          stylesheets: { main: 'style.css' },
          dependencies: [{ name: 'react', version: '18.2.0' }],
        };

        const result = buildUploadMetadata(packageJson, credentials, options);

        expect(result.importMap).toBeDefined();
        expect(result.stylesheets).toBeDefined();
        expect(result.dependencies).toBeDefined();
      });
    });

    describe('optional properties undefined cases', () => {
      it('should have undefined importMap when not provided', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.importMap).toBeUndefined();
      });

      it('should have undefined stylesheets when not provided', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.stylesheets).toBeUndefined();
      });

      it('should have undefined dependencies when not provided', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.dependencies).toBeUndefined();
      });

      it('should handle empty options object', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials, {});

        expect(result.importMap).toBeUndefined();
        expect(result.stylesheets).toBeUndefined();
        expect(result.dependencies).toBeUndefined();
      });

      it('should handle partial options', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials, {
          importMap: { test: 'value' },
        });

        expect(result.importMap).toEqual({ test: 'value' });
        expect(result.stylesheets).toBeUndefined();
        expect(result.dependencies).toBeUndefined();
      });
    });

    describe('theme naming', () => {
      it('should use oaysus theme name when available', () => {
        const packageJson = createMockPackageJson({
          name: 'pkg-name',
          version: '1.0.0',
          oaysus: {
            theme: {
              name: 'custom-theme',
              displayName: 'Custom Theme Display',
            },
          },
        });
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.themeName).toBe('custom-theme');
        expect(result.displayName).toBe('Custom Theme Display');
      });

      it('should fall back to themeName for displayName when not provided', () => {
        const packageJson = createMockPackageJson({
          name: 'pkg-name',
          version: '1.0.0',
          oaysus: {
            theme: {
              name: 'theme-only',
            },
          } as any,
        });
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.themeName).toBe('theme-only');
        expect(result.displayName).toBe('theme-only');
      });

      it('should fall back to package name when no oaysus config', () => {
        const packageJson = createMockPackageJson({
          name: 'package-fallback',
          version: '1.0.0',
        });
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.themeName).toBe('package-fallback');
        expect(result.displayName).toBe('package-fallback');
      });

      it('should handle empty oaysus object', () => {
        const packageJson = createMockPackageJson({
          name: 'empty-oaysus',
          version: '1.0.0',
          oaysus: {} as any,
        });
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        expect(result.themeName).toBe('empty-oaysus');
        expect(result.displayName).toBe('empty-oaysus');
      });
    });

    describe('developer handling', () => {
      it('should handle developer based on environment', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials);

        if (currentEnv === 'local') {
          expect(result.developer).toBe(currentDeveloper);
        } else {
          expect(result.developer).toBeUndefined();
        }
      });
    });

    describe('complex data structures', () => {
      it('should handle complex nested importMap', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();
        const complexImportMap = {
          imports: {
            react: 'https://cdn.example.com/react',
            'react-dom': 'https://cdn.example.com/react-dom',
          },
          scopes: {
            '/components/': {
              lodash: 'https://cdn.example.com/lodash',
            },
          },
        };

        const result = buildUploadMetadata(packageJson, credentials, {
          importMap: complexImportMap,
        });

        expect(result.importMap).toEqual(complexImportMap);
      });

      it('should handle empty dependencies array', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials, {
          dependencies: [],
        });

        expect(result.dependencies).toEqual([]);
      });

      it('should handle empty stylesheets object', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = buildUploadMetadata(packageJson, credentials, {
          stylesheets: {},
        });

        expect(result.stylesheets).toEqual({});
      });
    });
  });

  describe('getThemeBasePath', () => {
    describe('path structure', () => {
      it('should return path without version', () => {
        const packageJson = createMockPackageJson({
          name: 'my-theme',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-123',
        });

        const result = getThemeBasePath(packageJson, credentials);

        // Should not contain version
        expect(result).not.toContain('1.0.0');
        expect(result).toContain('my-theme');
        expect(result).toContain('ws-123');
      });

      it('should match buildR2Path without version segment', () => {
        const packageJson = createMockPackageJson({
          name: 'compare-theme',
          version: '2.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-compare',
        });

        const fullPath = buildR2Path(packageJson, credentials);
        const basePath = getThemeBasePath(packageJson, credentials);

        // basePath should be fullPath without the last segment (version)
        expect(fullPath.startsWith(basePath)).toBe(true);
        expect(fullPath).toBe(`${basePath}/2.0.0`);
      });

      it('should use oaysus theme name when available', () => {
        const packageJson = createMockPackageJson({
          name: 'pkg-name',
          version: '1.0.0',
          oaysus: {
            theme: {
              name: 'custom-theme',
              displayName: 'Custom',
            },
          },
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-456',
        });

        const result = getThemeBasePath(packageJson, credentials);

        expect(result).toContain('custom-theme');
        expect(result).not.toContain('pkg-name');
      });

      it('should fall back to package name', () => {
        const packageJson = createMockPackageJson({
          name: 'fallback-theme',
          version: '1.0.0',
        });
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(result).toContain('fallback-theme');
      });
    });

    describe('environment handling', () => {
      it('should include environment prefix', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(result.startsWith(currentEnv) || result.startsWith('local')).toBe(true);
      });

      it('should handle path structure based on current environment', () => {
        const packageJson = createMockPackageJson({
          name: 'env-theme',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-env',
        });

        const result = getThemeBasePath(packageJson, credentials);

        if (currentEnv === 'local') {
          const dev = currentDeveloper || 'unknown';
          expect(result).toBe(`local/${dev}/ws-env/env-theme`);
        } else {
          expect(result).toBe(`${currentEnv}/ws-env/env-theme`);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle scoped package names', () => {
        const packageJson = createMockPackageJson({
          name: '@company/theme-pack',
          version: '1.0.0',
        });
        const credentials = createMockCredentials({
          websiteId: 'ws-scope',
        });

        const result = getThemeBasePath(packageJson, credentials);

        expect(result).toContain('@company/theme-pack');
      });

      it('should handle empty oaysus object', () => {
        const packageJson = createMockPackageJson({
          name: 'fallback-pkg',
          version: '1.0.0',
          oaysus: {} as any,
        });
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(result).toContain('fallback-pkg');
      });

      it('should handle oaysus without theme property', () => {
        const packageJson = createMockPackageJson({
          name: 'no-theme-pkg',
          version: '1.0.0',
          oaysus: {
            // theme is undefined
          } as any,
        });
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(result).toContain('no-theme-pkg');
      });
    });

    describe('path validation', () => {
      it('should return a string', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(typeof result).toBe('string');
      });

      it('should not have leading slash', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(result.startsWith('/')).toBe(false);
      });

      it('should not have trailing slash', () => {
        const packageJson = createMockPackageJson();
        const credentials = createMockCredentials();

        const result = getThemeBasePath(packageJson, credentials);

        expect(result.endsWith('/')).toBe(false);
      });
    });
  });

  describe('UploadMetadata interface', () => {
    it('should return valid UploadMetadata structure', () => {
      const packageJson = createMockPackageJson({
        name: 'interface-test',
        version: '1.0.0',
      });
      const credentials = createMockCredentials();

      const result: UploadMetadata = buildUploadMetadata(packageJson, credentials);

      // Type checking ensures the interface is correct
      // Runtime checks for structure
      expect(typeof result.environment).toBe('string');
      expect(typeof result.websiteId).toBe('string');
      expect(typeof result.themeName).toBe('string');
      expect(typeof result.displayName).toBe('string');
      expect(typeof result.version).toBe('string');
      expect(typeof result.r2Path).toBe('string');
    });

    it('should have correct types for optional fields', () => {
      const packageJson = createMockPackageJson();
      const credentials = createMockCredentials();
      const options = {
        importMap: { key: 'value' },
        stylesheets: { main: 'style.css' },
        dependencies: [{ name: 'test', version: '1.0.0' }],
      };

      const result: UploadMetadata = buildUploadMetadata(packageJson, credentials, options);

      expect(typeof result.importMap).toBe('object');
      expect(typeof result.stylesheets).toBe('object');
      expect(Array.isArray(result.dependencies)).toBe(true);
    });
  });

  describe('function exports', () => {
    it('should export buildR2Path as a function', () => {
      expect(typeof buildR2Path).toBe('function');
    });

    it('should export buildUploadMetadata as a function', () => {
      expect(typeof buildUploadMetadata).toBe('function');
    });

    it('should export getThemeBasePath as a function', () => {
      expect(typeof getThemeBasePath).toBe('function');
    });
  });

  describe('consistency between functions', () => {
    it('should maintain consistency between buildR2Path and getThemeBasePath', () => {
      const packageJson = createMockPackageJson({
        name: 'consistent-theme',
        version: '5.0.0',
      });
      const credentials = createMockCredentials({
        websiteId: 'ws-consistent',
      });

      const fullPath = buildR2Path(packageJson, credentials);
      const basePath = getThemeBasePath(packageJson, credentials);

      // Full path should be base path + version
      expect(fullPath).toBe(`${basePath}/${packageJson.version}`);
    });

    it('should maintain consistency between buildR2Path and buildUploadMetadata', () => {
      const packageJson = createMockPackageJson({
        name: 'meta-consistent',
        version: '1.0.0',
      });
      const credentials = createMockCredentials();

      const directPath = buildR2Path(packageJson, credentials);
      const metadata = buildUploadMetadata(packageJson, credentials);

      expect(metadata.r2Path).toBe(directPath);
      expect(metadata.themeName).toBe('meta-consistent');
      expect(metadata.version).toBe('1.0.0');
    });
  });
});
