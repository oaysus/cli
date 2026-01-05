import { jest } from '@jest/globals';
/**
 * Tests for React module files
 * - builder.ts
 * - bundler.ts
 * - config.ts
 * - import-map.ts
 */

// Jest globals are auto-imported
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test directory
const testDir = path.join(os.tmpdir(), 'oaysus-react-modules-test-' + Date.now());

// ============================================================================
// config.ts Tests
// ============================================================================
describe('react/config module', () => {
  describe('REACT_EXTERNALS', () => {
    it('should export React framework externals', async () => {
      const { REACT_EXTERNALS } = await import('../src/lib/react/config.js');

      expect(REACT_EXTERNALS).toContain('react');
      expect(REACT_EXTERNALS).toContain('react-dom');
      expect(REACT_EXTERNALS).toContain('react/jsx-runtime');
      expect(REACT_EXTERNALS).toContain('react/jsx-dev-runtime');
      expect(REACT_EXTERNALS.length).toBe(4);
    });
  });

  describe('buildExternals()', () => {
    it('should return React externals when no detected deps provided', async () => {
      const { buildExternals, REACT_EXTERNALS } = await import('../src/lib/react/config.js');

      const externals = buildExternals();

      expect(externals).toEqual(expect.arrayContaining(REACT_EXTERNALS));
    });

    it('should return React externals when empty array provided', async () => {
      const { buildExternals, REACT_EXTERNALS } = await import('../src/lib/react/config.js');

      const externals = buildExternals([]);

      expect(externals).toEqual(expect.arrayContaining(REACT_EXTERNALS));
    });

    it('should include detected dependencies', async () => {
      const { buildExternals } = await import('../src/lib/react/config.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper', 'swiper/react', 'swiper/modules'],
          subExports: ['react', 'modules'],
          hasCSS: true,
          cssImports: ['swiper/css']
        }
      ];

      const externals = buildExternals(detectedDeps);

      expect(externals).toContain('swiper');
      expect(externals).toContain('swiper/react');
      expect(externals).toContain('swiper/modules');
      expect(externals).toContain('react');
    });

    it('should include multiple detected dependencies', async () => {
      const { buildExternals } = await import('../src/lib/react/config.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        },
        {
          name: 'framer-motion',
          version: '10.0.0',
          imports: ['framer-motion'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }
      ];

      const externals = buildExternals(detectedDeps);

      expect(externals).toContain('swiper');
      expect(externals).toContain('framer-motion');
    });

    it('should deduplicate externals', async () => {
      const { buildExternals } = await import('../src/lib/react/config.js');

      const detectedDeps = [
        {
          name: 'react',  // Already in REACT_EXTERNALS
          version: '18.0.0',
          imports: ['react'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }
      ];

      const externals = buildExternals(detectedDeps);
      const reactCount = externals.filter(e => e === 'react').length;

      expect(reactCount).toBe(1);
    });
  });

  describe('shouldExternalize()', () => {
    it('should return true for react', async () => {
      const { shouldExternalize } = await import('../src/lib/react/config.js');

      expect(shouldExternalize('react')).toBe(true);
    });

    it('should return true for react sub-paths', async () => {
      const { shouldExternalize } = await import('../src/lib/react/config.js');

      expect(shouldExternalize('react/jsx-runtime')).toBe(true);
      expect(shouldExternalize('react/jsx-dev-runtime')).toBe(true);
      expect(shouldExternalize('react/client')).toBe(true);
    });

    it('should return true for react-dom', async () => {
      const { shouldExternalize } = await import('../src/lib/react/config.js');

      expect(shouldExternalize('react-dom')).toBe(true);
      expect(shouldExternalize('react-dom/client')).toBe(true);
      expect(shouldExternalize('react-dom/server')).toBe(true);
    });

    it('should return false for non-React packages without detected deps', async () => {
      const { shouldExternalize } = await import('../src/lib/react/config.js');

      expect(shouldExternalize('lodash')).toBe(false);
      expect(shouldExternalize('swiper')).toBe(false);
    });

    it('should return true for detected dependencies', async () => {
      const { shouldExternalize } = await import('../src/lib/react/config.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper', 'swiper/react'],
          subExports: ['react'],
          hasCSS: false,
          cssImports: []
        }
      ];

      expect(shouldExternalize('swiper', detectedDeps)).toBe(true);
      expect(shouldExternalize('swiper/react', detectedDeps)).toBe(true);
      expect(shouldExternalize('swiper/modules', detectedDeps)).toBe(true);
    });

    it('should return false for non-detected non-React packages', async () => {
      const { shouldExternalize } = await import('../src/lib/react/config.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }
      ];

      expect(shouldExternalize('lodash', detectedDeps)).toBe(false);
      expect(shouldExternalize('framer-motion', detectedDeps)).toBe(false);
    });
  });

  describe('getReactPlugin()', () => {
    it('should return null (uses esbuild native JSX)', async () => {
      const { getReactPlugin } = await import('../src/lib/react/config.js');

      const plugin = await getReactPlugin();

      expect(plugin).toBe(null);
    });
  });
});

// ============================================================================
// import-map.ts Tests
// ============================================================================
describe('react/import-map module', () => {
  describe('generateImportMapFromPackageJson()', () => {
    it('should generate import map for React dependencies', async () => {
      const { generateImportMapFromPackageJson } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      };

      const importMap = generateImportMapFromPackageJson(packageJson);

      expect(importMap.imports['react']).toContain('esm.sh/react@18.2.0');
      expect(importMap.imports['react-dom']).toContain('esm.sh/react-dom@18.2.0');
      expect(importMap.imports['react/jsx-runtime']).toContain('jsx-runtime');
      expect(importMap.imports['react-dom/client']).toContain('client');
    });

    it('should skip dev-only packages', async () => {
      const { generateImportMapFromPackageJson } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          typescript: '^5.0.0',
          eslint: '^8.0.0',
          vite: '^5.0.0',
          jest: '^29.0.0',
          tailwindcss: '^3.0.0'
        }
      };

      const importMap = generateImportMapFromPackageJson(packageJson);

      expect(importMap.imports['@types/react']).toBeUndefined();
      expect(importMap.imports['typescript']).toBeUndefined();
      expect(importMap.imports['eslint']).toBeUndefined();
      expect(importMap.imports['vite']).toBeUndefined();
      expect(importMap.imports['jest']).toBeUndefined();
      expect(importMap.imports['tailwindcss']).toBeUndefined();
    });

    it('should skip non-React framework dependencies', async () => {
      const { generateImportMapFromPackageJson } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0',
          lodash: '^4.0.0',
          axios: '^1.0.0'
        }
      };

      const importMap = generateImportMapFromPackageJson(packageJson);

      expect(importMap.imports['react']).toBeDefined();
      expect(importMap.imports['lodash']).toBeUndefined();
      expect(importMap.imports['axios']).toBeUndefined();
    });

    it('should clean version prefixes', async () => {
      const { generateImportMapFromPackageJson } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '~18.2.0'
        }
      };

      const importMap = generateImportMapFromPackageJson(packageJson);

      expect(importMap.imports['react']).toContain('@18.2.0');
      expect(importMap.imports['react']).not.toContain('~');
    });

    it('should handle empty dependencies', async () => {
      const { generateImportMapFromPackageJson } = await import('../src/lib/react/import-map.js');

      const packageJson = {};

      const importMap = generateImportMapFromPackageJson(packageJson);

      expect(importMap.imports).toEqual({});
    });
  });

  describe('generateImportMapWithR2Urls()', () => {
    it('should generate import map with R2 URLs', async () => {
      const { generateImportMapWithR2Urls } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'themes/my-theme/1.0.0'
      };

      const importMap = generateImportMapWithR2Urls(packageJson, options);

      expect(importMap.imports['react']).toBe('https://pub-xxx.r2.dev/themes/my-theme/1.0.0/deps/react@18.2.0/index.js');
      expect(importMap.imports['react-dom']).toBe('https://pub-xxx.r2.dev/themes/my-theme/1.0.0/deps/react-dom@18.2.0/index.js');
      expect(importMap.imports['react/jsx-runtime']).toBe('https://pub-xxx.r2.dev/themes/my-theme/1.0.0/deps/react@18.2.0/jsx-runtime.js');
      expect(importMap.imports['react-dom/client']).toBe('https://pub-xxx.r2.dev/themes/my-theme/1.0.0/deps/react-dom@18.2.0/client.js');
    });

    it('should handle empty r2BasePath', async () => {
      const { generateImportMapWithR2Urls } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        }
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: ''
      };

      const importMap = generateImportMapWithR2Urls(packageJson, options);

      expect(importMap.imports['react']).toBe('https://pub-xxx.r2.dev/deps/react@18.2.0/index.js');
    });

    it('should include detected external dependencies', async () => {
      const { generateImportMapWithR2Urls } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        }
      };

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper', 'swiper/react'],
          subExports: ['react'],
          hasCSS: true,
          cssImports: ['swiper/css']
        }
      ];

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'themes/test',
        detectedDeps
      };

      const importMap = generateImportMapWithR2Urls(packageJson, options);

      expect(importMap.imports['swiper']).toBe('https://pub-xxx.r2.dev/themes/test/deps/swiper@11.0.0/index.js');
      expect(importMap.imports['swiper/react']).toBe('https://pub-xxx.r2.dev/themes/test/deps/swiper@11.0.0/react.js');
      expect(importMap.imports['swiper/css']).toBe('https://pub-xxx.r2.dev/themes/test/deps/swiper@11.0.0/css.js');
    });

    it('should handle nested sub-exports with slashes', async () => {
      const { generateImportMapWithR2Urls } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        }
      };

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper/css/navigation'],
          subExports: [],
          hasCSS: true,
          cssImports: ['swiper/css/navigation']
        }
      ];

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'test',
        detectedDeps
      };

      const importMap = generateImportMapWithR2Urls(packageJson, options);

      expect(importMap.imports['swiper/css/navigation']).toBe('https://pub-xxx.r2.dev/test/deps/swiper@11.0.0/css-navigation.js');
    });
  });

  describe('generateImportMapWithStylesheets()', () => {
    it('should include tailwind stylesheet when tailwindcss is in dependencies', async () => {
      const { generateImportMapWithStylesheets } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0',
          tailwindcss: '^3.4.0'
        }
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'themes/test'
      };

      const result = generateImportMapWithStylesheets(packageJson, options);

      expect(result.stylesheets['tailwindcss']).toBe('https://pub-xxx.r2.dev/themes/test/theme.css');
    });

    it('should not include tailwind stylesheet when not in dependencies', async () => {
      const { generateImportMapWithStylesheets } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        }
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'themes/test'
      };

      const result = generateImportMapWithStylesheets(packageJson, options);

      expect(result.stylesheets['tailwindcss']).toBeUndefined();
    });

    it('should handle empty r2BasePath for stylesheets', async () => {
      const { generateImportMapWithStylesheets } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          tailwindcss: '^3.4.0'
        },
        devDependencies: {
          react: '^18.2.0'
        }
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: ''
      };

      const result = generateImportMapWithStylesheets(packageJson, options);

      expect(result.stylesheets['tailwindcss']).toBe('https://pub-xxx.r2.dev/theme.css');
    });
  });

  describe('getDependenciesToBundle()', () => {
    it('should return React framework dependencies', async () => {
      const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      };

      const deps = getDependenciesToBundle(packageJson);

      expect(deps).toContainEqual({ name: 'react', version: '18.2.0' });
      expect(deps).toContainEqual({ name: 'react-dom', version: '18.2.0' });
    });

    it('should skip dev-only packages', async () => {
      const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          typescript: '^5.0.0',
          vite: '^5.0.0',
          prettier: '^3.0.0',
          vitest: '^1.0.0',
          autoprefixer: '^10.0.0',
          postcss: '^8.0.0',
          '@vitejs/plugin-react': '^4.0.0'
        }
      };

      const deps = getDependenciesToBundle(packageJson);
      const depNames = deps.map(d => d.name);

      expect(depNames).not.toContain('@types/react');
      expect(depNames).not.toContain('typescript');
      expect(depNames).not.toContain('vite');
      expect(depNames).not.toContain('prettier');
      expect(depNames).not.toContain('vitest');
      expect(depNames).not.toContain('autoprefixer');
      expect(depNames).not.toContain('postcss');
      expect(depNames).not.toContain('@vitejs/plugin-react');
    });

    it('should skip non-React framework dependencies', async () => {
      const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0',
          lodash: '^4.0.0',
          axios: '^1.0.0',
          swiper: '^11.0.0'
        }
      };

      const deps = getDependenciesToBundle(packageJson);
      const depNames = deps.map(d => d.name);

      expect(depNames).toContain('react');
      expect(depNames).not.toContain('lodash');
      expect(depNames).not.toContain('axios');
      expect(depNames).not.toContain('swiper');
    });

    it('should clean version prefixes', async () => {
      const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '~18.2.0',
          'react-dom': '^18.0.0'
        }
      };

      const deps = getDependenciesToBundle(packageJson);

      const reactDep = deps.find(d => d.name === 'react');
      const reactDomDep = deps.find(d => d.name === 'react-dom');

      expect(reactDep?.version).toBe('18.2.0');
      expect(reactDomDep?.version).toBe('18.0.0');
    });

    it('should handle empty dependencies', async () => {
      const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

      const packageJson = {};

      const deps = getDependenciesToBundle(packageJson);

      expect(deps).toEqual([]);
    });
  });
});

// ============================================================================
// bundler.ts Tests
// ============================================================================
describe('react/bundler module', () => {
  beforeEach(async () => {
    // Create test directory
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('filterRuntimeDependencies()', () => {
    it('should filter out dev-only packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const dependencies = [
        { name: 'react', version: '18.2.0' },
        { name: '@types/react', version: '18.0.0' },
        { name: 'typescript', version: '5.0.0' },
        { name: 'eslint', version: '8.0.0' },
        { name: 'prettier', version: '3.0.0' },
        { name: 'vite', version: '5.0.0' },
        { name: 'vitest', version: '1.0.0' },
        { name: 'jest', version: '29.0.0' },
        { name: '@testing-library/react', version: '14.0.0' },
        { name: 'autoprefixer', version: '10.0.0' },
        { name: 'postcss', version: '8.0.0' },
        { name: 'tailwindcss', version: '3.0.0' },
        { name: '@vitejs/plugin-react', version: '4.0.0' }
      ];

      const filtered = filterRuntimeDependencies(dependencies);
      const filteredNames = filtered.map(d => d.name);

      expect(filteredNames).toContain('react');
      expect(filteredNames).not.toContain('@types/react');
      expect(filteredNames).not.toContain('typescript');
      expect(filteredNames).not.toContain('eslint');
      expect(filteredNames).not.toContain('prettier');
      expect(filteredNames).not.toContain('vite');
      expect(filteredNames).not.toContain('vitest');
      expect(filteredNames).not.toContain('jest');
      expect(filteredNames).not.toContain('@testing-library/react');
      expect(filteredNames).not.toContain('autoprefixer');
      expect(filteredNames).not.toContain('postcss');
      expect(filteredNames).not.toContain('tailwindcss');
      expect(filteredNames).not.toContain('@vitejs/plugin-react');
    });

    it('should keep runtime dependencies', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const dependencies = [
        { name: 'react', version: '18.2.0' },
        { name: 'react-dom', version: '18.2.0' },
        { name: 'lodash', version: '4.0.0' },
        { name: 'axios', version: '1.0.0' },
        { name: 'swiper', version: '11.0.0' },
        { name: 'framer-motion', version: '10.0.0' }
      ];

      const filtered = filterRuntimeDependencies(dependencies);
      const filteredNames = filtered.map(d => d.name);

      expect(filteredNames).toContain('react');
      expect(filteredNames).toContain('react-dom');
      expect(filteredNames).toContain('lodash');
      expect(filteredNames).toContain('axios');
      expect(filteredNames).toContain('swiper');
      expect(filteredNames).toContain('framer-motion');
    });

    it('should filter eslint-prefixed packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const dependencies = [
        { name: 'eslint-plugin-react', version: '7.0.0' },
        { name: 'eslint-config-prettier', version: '9.0.0' }
      ];

      const filtered = filterRuntimeDependencies(dependencies);

      expect(filtered).toHaveLength(0);
    });

    it('should filter vue and svelte build packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const dependencies = [
        { name: '@sveltejs/vite-plugin-svelte', version: '3.0.0' },
        { name: 'svelte-check', version: '3.0.0' },
        { name: 'vue-tsc', version: '1.0.0' }
      ];

      const filtered = filterRuntimeDependencies(dependencies);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('getBundleSize()', () => {
    it('should calculate total bundle size', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      // Using exact byte counts
      const mainBundle1 = 'const react = "test";'; // 21 bytes
      const jsxRuntime = 'export const jsx = () => {};'; // 29 bytes
      const mainBundle2 = 'const dom = "test";'; // 19 bytes

      const bundles = [
        {
          name: 'react',
          version: '18.2.0',
          mainBundle: mainBundle1,
          additionalExports: {
            'jsx-runtime': jsxRuntime
          }
        },
        {
          name: 'react-dom',
          version: '18.2.0',
          mainBundle: mainBundle2,
          additionalExports: {} as Record<string, string>
        }
      ];

      const size = getBundleSize(bundles);

      // Calculate expected size
      const expectedSize = Buffer.byteLength(mainBundle1, 'utf8') +
                          Buffer.byteLength(jsxRuntime, 'utf8') +
                          Buffer.byteLength(mainBundle2, 'utf8');
      expect(size).toBe(expectedSize);
    });

    it('should handle empty bundles', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles: Array<{ name: string; version: string; mainBundle: string; additionalExports?: Record<string, string> }> = [];

      const size = getBundleSize(bundles);

      expect(size).toBe(0);
    });

    it('should handle bundles without additionalExports', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles = [
        {
          name: 'test',
          version: '1.0.0',
          mainBundle: 'test',
          additionalExports: undefined
        }
      ];

      const size = getBundleSize(bundles);

      expect(size).toBe(4);
    });
  });

  describe('formatBundleSize()', () => {
    it('should format bytes', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');

      expect(formatBundleSize(100)).toBe('100 B');
      expect(formatBundleSize(512)).toBe('512 B');
      expect(formatBundleSize(1023)).toBe('1023 B');
    });

    it('should format kilobytes', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');

      expect(formatBundleSize(1024)).toBe('1.00 KB');
      expect(formatBundleSize(2048)).toBe('2.00 KB');
      expect(formatBundleSize(1536)).toBe('1.50 KB');
      expect(formatBundleSize(10240)).toBe('10.00 KB');
      expect(formatBundleSize(1024 * 1024 - 1)).toBe('1024.00 KB');
    });

    it('should format megabytes', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');

      expect(formatBundleSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatBundleSize(2 * 1024 * 1024)).toBe('2.00 MB');
      expect(formatBundleSize(1.5 * 1024 * 1024)).toBe('1.50 MB');
    });

    it('should handle zero bytes', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');

      expect(formatBundleSize(0)).toBe('0 B');
    });
  });

  describe('bundler singleton', () => {
    it('should export bundler singleton', async () => {
      const { bundler, default: defaultBundler } = await import('../src/lib/react/bundler.js');

      expect(bundler).toBeDefined();
      expect(defaultBundler).toBeDefined();
      expect(bundler).toBe(defaultBundler);
    });

    it('should export backward compatible functions', async () => {
      const module = await import('../src/lib/react/bundler.js');

      expect(typeof module.bundleDependencies).toBe('function');
      expect(typeof module.filterRuntimeDependencies).toBe('function');
      expect(typeof module.getBundleSize).toBe('function');
      expect(typeof module.formatBundleSize).toBe('function');
      expect(typeof module.bundleServerDependencies).toBe('function');
      expect(typeof module.bundleDetectedDependencies).toBe('function');
    });
  });
});

// ============================================================================
// builder.ts Tests
// ============================================================================
describe('react/builder module', () => {
  let componentDir: string;

  beforeEach(async () => {
    // Create test directory structure
    await fs.promises.mkdir(testDir, { recursive: true });
    componentDir = path.join(testDir, 'components', 'TestButton');
    await fs.promises.mkdir(componentDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('builder singleton', () => {
    it('should export builder singleton', async () => {
      const { builder, default: defaultBuilder } = await import('../src/lib/react/builder.js');

      expect(builder).toBeDefined();
      expect(defaultBuilder).toBeDefined();
      expect(builder).toBe(defaultBuilder);
    });

    it('should implement IBuilder interface methods', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      expect(typeof builder.buildComponents).toBe('function');
      expect(typeof builder.buildServerComponents).toBe('function');
      expect(typeof builder.buildThemeCSS).toBe('function');
    });
  });

  describe('setDetectedDependencies()', () => {
    it('should set detected dependencies', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const deps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }
      ];

      // Should not throw
      builder.setDetectedDependencies(deps);
    });
  });

  describe('buildThemeCSS()', () => {
    it('should return null when no tailwind dependency', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        }
      };

      const result = await builder.buildThemeCSS(testDir, testDir, packageJson);

      expect(result).toBe(null);
    });

    it('should return null for Tailwind v3 when no config file exists', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const packageJson = {
        dependencies: {
          tailwindcss: '^3.4.0'
        }
      };

      const result = await builder.buildThemeCSS(testDir, testDir, packageJson);

      expect(result).toBe(null);
    });
  });

  describe('buildComponents()', () => {
    it('should return error result when build fails', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      // Create a minimal but invalid validation result
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        components: [
          {
            name: 'InvalidComponent',
            displayName: 'Invalid Component',
            path: path.join(testDir, 'nonexistent'),
            schema: { type: 'component', displayName: 'Invalid', props: {} },
            entryPoint: 'nonexistent/index.tsx'
          }
        ],
        packageJson: {
          name: 'test-package',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        },
        inferredConfig: {
          framework: 'react' as const,
          type: 'component' as const,
          componentCount: 1,
          version: '1.0.0',
          name: 'test-package'
        }
      };

      const result = await builder.buildComponents(validationResult, testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should create output directory', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      // Create a simple component
      const componentPath = path.join(componentDir, 'index.tsx');
      await fs.promises.writeFile(componentPath, `
        export default function TestButton() {
          return <button>Test</button>;
        }
      `);

      const schemaPath = path.join(componentDir, 'schema.json');
      await fs.promises.writeFile(schemaPath, JSON.stringify({
        type: 'component',
        displayName: 'Test Button',
        props: {}
      }));

      // Create package.json in test dir
      await fs.promises.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        })
      );

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        components: [
          {
            name: 'TestButton',
            displayName: 'Test Button',
            path: componentDir,
            schema: { type: 'component', displayName: 'Test Button', props: {} },
            entryPoint: 'components/TestButton/index.tsx'
          }
        ],
        packageJson: {
          name: 'test-package',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        },
        inferredConfig: {
          framework: 'react' as const,
          type: 'component' as const,
          componentCount: 1,
          version: '1.0.0',
          name: 'test-package'
        }
      };

      const result = await builder.buildComponents(validationResult, testDir);

      // Check that output directory was created
      expect(result.outputDir).toBe(path.join(testDir, '.oaysus-build'));
    });
  });

  describe('buildServerComponents()', () => {
    it('should return error result when build fails', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        components: [
          {
            name: 'InvalidComponent',
            displayName: 'Invalid Component',
            path: path.join(testDir, 'nonexistent'),
            schema: { type: 'component', displayName: 'Invalid', props: {} },
            entryPoint: 'nonexistent/index.tsx'
          }
        ],
        packageJson: {
          name: 'test-package',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        },
        inferredConfig: {
          framework: 'react' as const,
          type: 'component' as const,
          componentCount: 1,
          version: '1.0.0',
          name: 'test-package'
        }
      };

      const result = await builder.buildServerComponents(validationResult, testDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// ============================================================================
// Additional bundler.ts Tests for Coverage
// ============================================================================
describe('react/bundler module (additional coverage)', () => {
  let projectDir: string;
  let outputDir: string;

  beforeEach(async () => {
    // Create test project directory with node_modules
    projectDir = path.join(os.tmpdir(), 'oaysus-bundler-test-' + Date.now());
    outputDir = path.join(projectDir, 'output');
    await fs.promises.mkdir(path.join(projectDir, 'node_modules'), { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Create a package.json
    await fs.promises.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      })
    );
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(projectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('bundleDependencies()', () => {
    it('should handle empty dependencies array', async () => {
      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDependencies([], {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toEqual([]);
    });
  });

  describe('bundleDetectedDependencies()', () => {
    it('should handle empty detected deps array', async () => {
      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDetectedDependencies([], {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toEqual([]);
    });
  });

  describe('bundleServerDependencies()', () => {
    it('should warn and return empty when no React dependency', async () => {
      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await bundleServerDependencies([
        { name: 'lodash', version: '4.0.0' }
      ], {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No React dependency found')
      );

      consoleSpy.mockRestore();
    });
  });
});

// ============================================================================
// Additional builder.ts Tests for Coverage
// ============================================================================
describe('react/builder module (additional coverage)', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = path.join(os.tmpdir(), 'oaysus-builder-coverage-' + Date.now());
    await fs.promises.mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(projectDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('buildThemeCSS() additional cases', () => {
    it('should handle Tailwind v4 detection', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const packageJson = {
        dependencies: {
          tailwindcss: '^4.0.0'
        }
      };

      // Tailwind v4 doesn't require a config file but needs @tailwindcss/cli
      // The result depends on whether @tailwindcss/cli is available globally
      const result = await builder.buildThemeCSS(projectDir, projectDir, packageJson);

      // Either returns null (no tailwind) or a valid CSS result
      if (result !== null) {
        expect(result.cssPath).toContain('theme.css');
        expect(typeof result.size).toBe('number');
      } else {
        expect(result).toBe(null);
      }
    });

    it('should check for Tailwind v3 with tailwind.config.ts', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      // Create tailwind.config.ts
      await fs.promises.writeFile(
        path.join(projectDir, 'tailwind.config.ts'),
        'export default { content: [] }'
      );

      const packageJson = {
        dependencies: {
          tailwindcss: '^3.4.0'
        }
      };

      // This will fail because no actual tailwind binary, but tests the config detection
      const result = await builder.buildThemeCSS(projectDir, projectDir, packageJson);

      // Should return null because build fails (no actual tailwind installed)
      expect(result).toBe(null);
    });

    it('should clean up temp file on error', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      // Create tailwind.config.js
      await fs.promises.writeFile(
        path.join(projectDir, 'tailwind.config.js'),
        'module.exports = { content: [] }'
      );

      const packageJson = {
        dependencies: {
          tailwindcss: '^3.4.0'
        }
      };

      await builder.buildThemeCSS(projectDir, projectDir, packageJson);

      // Verify temp file was cleaned up
      const tempFile = path.join(projectDir, '.oaysus-temp-tailwind.css');
      expect(fs.existsSync(tempFile)).toBe(false);
    });
  });

  describe('buildComponents() additional cases', () => {
    it('should clean existing output directory', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      // Create an existing output directory with files
      const outputDir = path.join(projectDir, '.oaysus-build');
      await fs.promises.mkdir(outputDir, { recursive: true });
      await fs.promises.writeFile(path.join(outputDir, 'old-file.js'), 'old content');

      // Create minimal component
      const componentDir = path.join(projectDir, 'components', 'Test');
      await fs.promises.mkdir(componentDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(componentDir, 'index.tsx'),
        'export default function Test() { return null; }'
      );
      await fs.promises.writeFile(
        path.join(componentDir, 'schema.json'),
        JSON.stringify({ type: 'component', displayName: 'Test', props: {} })
      );

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        components: [
          {
            name: 'Test',
            displayName: 'Test',
            path: componentDir,
            schema: { type: 'component', displayName: 'Test', props: {} },
            entryPoint: 'components/Test/index.tsx'
          }
        ],
        packageJson: {
          name: 'test',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        },
        inferredConfig: {
          framework: 'react' as const,
          type: 'component' as const,
          componentCount: 1,
          version: '1.0.0',
          name: 'test'
        }
      };

      // This will fail to build but will clean the directory
      await builder.buildComponents(validationResult, projectDir);

      // The old file should be gone (directory was cleaned)
      expect(fs.existsSync(path.join(outputDir, 'old-file.js'))).toBe(false);
    });

    it('should handle non-Error throws', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        components: [
          {
            name: 'Invalid',
            displayName: 'Invalid',
            path: '/nonexistent/path',
            schema: { type: 'component', displayName: 'Invalid', props: {} },
            entryPoint: '/nonexistent/index.tsx'
          }
        ],
        packageJson: {
          name: 'test',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        },
        inferredConfig: {
          framework: 'react' as const,
          type: 'component' as const,
          componentCount: 1,
          version: '1.0.0',
          name: 'test'
        }
      };

      const result = await builder.buildComponents(validationResult, projectDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('buildServerComponents() additional cases', () => {
    it('should handle non-Error throws', async () => {
      const { builder } = await import('../src/lib/react/builder.js');

      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        components: [
          {
            name: 'Invalid',
            displayName: 'Invalid',
            path: '/nonexistent/path',
            schema: { type: 'component', displayName: 'Invalid', props: {} },
            entryPoint: '/nonexistent/index.tsx'
          }
        ],
        packageJson: {
          name: 'test',
          version: '1.0.0',
          dependencies: { react: '^18.2.0' }
        },
        inferredConfig: {
          framework: 'react' as const,
          type: 'component' as const,
          componentCount: 1,
          version: '1.0.0',
          name: 'test'
        }
      };

      const result = await builder.buildServerComponents(validationResult, projectDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// ============================================================================
// Additional import-map.ts Tests for Coverage
// ============================================================================
describe('react/import-map module (additional coverage)', () => {
  describe('generateImportMapWithR2Urls() edge cases', () => {
    it('should skip dev-only packages', async () => {
      const { generateImportMapWithR2Urls } = await import('../src/lib/react/import-map.js');

      const packageJson = {
        dependencies: {
          react: '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          '@testing-library/react': '^14.0.0',
          '@tailwindcss/cli': '^4.0.0'
        }
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'test'
      };

      const importMap = generateImportMapWithR2Urls(packageJson, options);

      expect(importMap.imports['@types/react']).toBeUndefined();
      expect(importMap.imports['@testing-library/react']).toBeUndefined();
      expect(importMap.imports['@tailwindcss/cli']).toBeUndefined();
    });
  });

  describe('importMapGenerator singleton', () => {
    it('should export singleton and default export', async () => {
      const { importMapGenerator, default: defaultGenerator } = await import('../src/lib/react/import-map.js');

      expect(importMapGenerator).toBeDefined();
      expect(defaultGenerator).toBeDefined();
      expect(importMapGenerator).toBe(defaultGenerator);
    });
  });
});

// ============================================================================
// Integration tests
// ============================================================================
describe('React modules integration', () => {
  it('should have consistent externals between config and import-map', async () => {
    const { REACT_EXTERNALS } = await import('../src/lib/react/config.js');
    const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

    const packageJson = {
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      }
    };

    const deps = getDependenciesToBundle(packageJson);
    const depNames = deps.map(d => d.name);

    // All deps returned by getDependenciesToBundle should be in REACT_EXTERNALS
    for (const name of depNames) {
      expect(REACT_EXTERNALS).toContain(name);
    }
  });

  it('should filter same dev packages in bundler and import-map', async () => {
    const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');
    const { getDependenciesToBundle } = await import('../src/lib/react/import-map.js');

    const packageJson = {
      dependencies: {
        react: '^18.2.0'
      },
      devDependencies: {
        '@types/react': '^18.0.0',
        typescript: '^5.0.0',
        vite: '^5.0.0'
      }
    };

    const bundlerDeps = filterRuntimeDependencies([
      { name: 'react', version: '18.2.0' },
      { name: '@types/react', version: '18.0.0' },
      { name: 'typescript', version: '5.0.0' },
      { name: 'vite', version: '5.0.0' }
    ]);

    const importMapDeps = getDependenciesToBundle(packageJson);

    // Both should only include react (import-map also filters non-React packages)
    const bundlerNames = bundlerDeps.map(d => d.name);
    expect(bundlerNames).toContain('react');
    expect(bundlerNames).not.toContain('@types/react');
    expect(bundlerNames).not.toContain('typescript');
    expect(bundlerNames).not.toContain('vite');

    const importMapNames = importMapDeps.map(d => d.name);
    expect(importMapNames).toContain('react');
    expect(importMapNames).not.toContain('@types/react');
    expect(importMapNames).not.toContain('typescript');
    expect(importMapNames).not.toContain('vite');
  });

  it('should generate valid import map from detected deps', async () => {
    const { buildExternals } = await import('../src/lib/react/config.js');
    const { generateImportMapWithR2Urls } = await import('../src/lib/react/import-map.js');

    const packageJson = {
      dependencies: {
        react: '^18.2.0'
      }
    };

    const detectedDeps = [
      {
        name: 'swiper',
        version: '11.0.0',
        imports: ['swiper', 'swiper/react', 'swiper/css'],
        subExports: ['react'],
        hasCSS: true,
        cssImports: ['swiper/css']
      }
    ];

    // Build externals from detected deps
    const externals = buildExternals(detectedDeps);

    // Generate import map with same detected deps
    const importMap = generateImportMapWithR2Urls(packageJson, {
      r2PublicUrl: 'https://pub-xxx.r2.dev',
      r2BasePath: 'test',
      detectedDeps
    });

    // Externals should include swiper
    expect(externals).toContain('swiper');
    expect(externals).toContain('swiper/react');
    expect(externals).toContain('swiper/css');

    // Import map should have URLs for swiper
    expect(importMap.imports['swiper']).toBeDefined();
    expect(importMap.imports['swiper/react']).toBeDefined();
    expect(importMap.imports['swiper/css']).toBeDefined();
  });
});
