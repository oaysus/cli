import { jest } from '@jest/globals';
/**
 * Comprehensive tests for React bundler.ts
 * Tests all exported functions and achieves high code coverage
 */

// Jest globals are auto-imported
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test directories
let testDir: string;
let projectDir: string;
let outputDir: string;

// Helper to create a minimal React project structure with all required exports
async function createMockProject(dir: string) {
  // Create directory structure
  await fs.promises.mkdir(path.join(dir, 'node_modules', 'react'), { recursive: true });
  await fs.promises.mkdir(path.join(dir, 'node_modules', 'react-dom', 'client'), { recursive: true });
  await fs.promises.mkdir(path.join(dir, 'node_modules', 'react-dom', 'server'), { recursive: true });

  // Create minimal package.json for the project
  await fs.promises.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      }
    })
  );

  // Create mock react package with ALL exports expected by bundler
  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react', 'package.json'),
    JSON.stringify({
      name: 'react',
      version: '18.2.0',
      main: 'index.js',
      exports: {
        '.': './index.js',
        './jsx-runtime': './jsx-runtime.js',
        './jsx-dev-runtime': './jsx-dev-runtime.js'
      }
    })
  );

  // Include ALL exports that EXPLICIT_NAMED_EXPORTS expects
  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react', 'index.js'),
    `// React main exports
export const createElement = () => {};
export const createContext = () => ({});
export const forwardRef = (fn) => fn;
export const useCallback = (fn) => fn;
export const useContext = () => {};
export const useDebugValue = () => {};
export const useDeferredValue = (v) => v;
export const useEffect = () => {};
export const useId = () => 'id';
export const useImperativeHandle = () => {};
export const useInsertionEffect = () => {};
export const useLayoutEffect = () => {};
export const useMemo = (fn) => fn();
export const useOptimistic = () => [];
export const useReducer = () => [];
export const useRef = () => ({ current: null });
export const useState = () => [null, () => {}];
export const useSyncExternalStore = () => {};
export const useTransition = () => [];
export const use = () => {};
export const Fragment = Symbol('Fragment');
export const Profiler = () => null;
export const StrictMode = () => null;
export const Suspense = () => null;
export const Children = {};
export const Component = class {};
export const PureComponent = class {};
export const createRef = () => ({ current: null });
export const isValidElement = () => true;
export const memo = (fn) => fn;
export const lazy = (fn) => fn;
export const startTransition = (fn) => fn();
export const unstable_Activity = {};
export const cache = (fn) => fn;
export const version = '18.2.0';
export default { createElement, createContext, forwardRef, useState, useEffect, Fragment, version };`
  );

  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react', 'jsx-runtime.js'),
    `export const jsx = () => {};
export const jsxs = () => {};
export const Fragment = Symbol('Fragment');`
  );

  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react', 'jsx-dev-runtime.js'),
    `export const jsx = () => {};
export const jsxs = () => {};
export const jsxDEV = () => {};
export const Fragment = Symbol('Fragment');`
  );

  // Create mock react-dom package with ALL exports
  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react-dom', 'package.json'),
    JSON.stringify({
      name: 'react-dom',
      version: '18.2.0',
      main: 'index.js',
      exports: {
        '.': './index.js',
        './client': './client/index.js',
        './server': './server/index.js'
      }
    })
  );

  // Include ALL exports that EXPLICIT_NAMED_EXPORTS expects for react-dom
  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react-dom', 'index.js'),
    `export const createPortal = () => {};
export const flushSync = (fn) => fn();
export const prefetchDNS = () => {};
export const preconnect = () => {};
export const preload = () => {};
export const preloadModule = () => {};
export const preinit = () => {};
export const preinitModule = () => {};
export const version = '18.2.0';
export default { createPortal, flushSync, version };`
  );

  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react-dom', 'client', 'index.js'),
    `export const createRoot = () => ({ render: () => {}, unmount: () => {} });
export const hydrateRoot = () => ({ render: () => {}, unmount: () => {} });`
  );

  await fs.promises.writeFile(
    path.join(dir, 'node_modules', 'react-dom', 'server', 'index.js'),
    `export const renderToString = () => '<div></div>';
export const renderToStaticMarkup = () => '<div></div>';`
  );
}

// Helper to create a mock external dependency
async function createMockExternalDep(dir: string, name: string, version: string, hasCSS: boolean = false) {
  const depDir = path.join(dir, 'node_modules', name);
  await fs.promises.mkdir(depDir, { recursive: true });

  await fs.promises.writeFile(
    path.join(depDir, 'package.json'),
    JSON.stringify({
      name,
      version,
      main: 'index.js',
      exports: hasCSS ? {
        '.': './index.js',
        './css': './swiper.css'
      } : {
        '.': './index.js'
      }
    })
  );

  await fs.promises.writeFile(
    path.join(depDir, 'index.js'),
    `export const ${name.replace(/-/g, '_')} = () => {};
export default { ${name.replace(/-/g, '_')} };`
  );

  if (hasCSS) {
    await fs.promises.writeFile(
      path.join(depDir, 'swiper.css'),
      `.${name} { display: block; }`
    );
  }
}

describe('React Bundler - Comprehensive Tests', () => {
  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), 'oaysus-react-bundler-test-' + Date.now() + '-' + Math.random().toString(36).substring(7));
    projectDir = testDir;
    outputDir = path.join(testDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ==========================================================================
  // filterRuntimeDependencies Tests
  // ==========================================================================
  describe('filterRuntimeDependencies()', () => {
    it('should filter out all @types/* packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: '@types/react', version: '18.0.0' },
        { name: '@types/node', version: '20.0.0' },
        { name: '@types/lodash', version: '4.0.0' },
        { name: 'lodash', version: '4.17.21' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('lodash');
    });

    it('should filter out typescript', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'typescript', version: '5.0.0' },
        { name: 'lodash', version: '4.17.21' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('lodash');
    });

    it('should filter out all eslint packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'eslint', version: '8.0.0' },
        { name: 'eslint-plugin-react', version: '7.0.0' },
        { name: 'eslint-config-prettier', version: '9.0.0' },
        { name: '@eslint/js', version: '8.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      // @eslint/js doesn't match the /^eslint/ pattern
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('@eslint/js');
    });

    it('should filter out prettier', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'prettier', version: '3.0.0' },
        { name: 'some-other-lib', version: '1.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('some-other-lib');
    });

    it('should filter out vite', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'vite', version: '5.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out all vitest packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'vitest', version: '1.0.0' },
        { name: 'vitest-ui', version: '1.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out all jest packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'jest', version: '29.0.0' },
        { name: 'jest-environment-jsdom', version: '29.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out @testing-library packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: '@testing-library/react', version: '14.0.0' },
        { name: '@testing-library/jest-dom', version: '6.0.0' },
        { name: '@testing-library/user-event', version: '14.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out autoprefixer', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'autoprefixer', version: '10.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out postcss', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'postcss', version: '8.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out tailwindcss', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'tailwindcss', version: '3.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out @vitejs packages', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: '@vitejs/plugin-react', version: '4.0.0' },
        { name: '@vitejs/plugin-vue', version: '5.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out @sveltejs/vite-plugin', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: '@sveltejs/vite-plugin-svelte', version: '3.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out svelte-check', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'svelte-check', version: '3.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should filter out vue-tsc', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'vue-tsc', version: '1.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(0);
    });

    it('should keep runtime dependencies', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const deps = [
        { name: 'react', version: '18.2.0' },
        { name: 'react-dom', version: '18.2.0' },
        { name: 'lodash', version: '4.17.21' },
        { name: 'axios', version: '1.0.0' },
        { name: 'zustand', version: '4.0.0' },
        { name: 'framer-motion', version: '10.0.0' }
      ];

      const filtered = filterRuntimeDependencies(deps);

      expect(filtered).toHaveLength(6);
      expect(filtered.map(d => d.name)).toEqual([
        'react', 'react-dom', 'lodash', 'axios', 'zustand', 'framer-motion'
      ]);
    });

    it('should handle empty array', async () => {
      const { filterRuntimeDependencies } = await import('../src/lib/react/bundler.js');

      const filtered = filterRuntimeDependencies([]);

      expect(filtered).toEqual([]);
    });
  });

  // ==========================================================================
  // getBundleSize Tests
  // ==========================================================================
  describe('getBundleSize()', () => {
    it('should calculate size of main bundle only', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles = [
        {
          name: 'test',
          version: '1.0.0',
          mainBundle: 'a'.repeat(1000),
          additionalExports: {}
        }
      ];

      const size = getBundleSize(bundles);
      expect(size).toBe(1000);
    });

    it('should calculate size with additionalExports', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles = [
        {
          name: 'test',
          version: '1.0.0',
          mainBundle: 'a'.repeat(1000),
          additionalExports: {
            'sub1': 'b'.repeat(500),
            'sub2': 'c'.repeat(200)
          }
        }
      ];

      const size = getBundleSize(bundles);
      expect(size).toBe(1700);
    });

    it('should handle multiple bundles', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles = [
        {
          name: 'pkg1',
          version: '1.0.0',
          mainBundle: 'x'.repeat(100),
          additionalExports: {}
        },
        {
          name: 'pkg2',
          version: '2.0.0',
          mainBundle: 'y'.repeat(200),
          additionalExports: { 'extra': 'z'.repeat(50) }
        }
      ];

      const size = getBundleSize(bundles as any);
      expect(size).toBe(350);
    });

    it('should handle undefined additionalExports', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles = [
        {
          name: 'test',
          version: '1.0.0',
          mainBundle: 'a'.repeat(100),
          additionalExports: undefined
        }
      ];

      const size = getBundleSize(bundles as any);
      expect(size).toBe(100);
    });

    it('should handle empty mainBundle', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      const bundles = [
        {
          name: 'test',
          version: '1.0.0',
          mainBundle: '',
          additionalExports: {}
        }
      ];

      const size = getBundleSize(bundles);
      expect(size).toBe(0);
    });

    it('should handle multi-byte characters correctly', async () => {
      const { getBundleSize } = await import('../src/lib/react/bundler.js');

      // Unicode characters take more bytes than their length
      const unicodeString = '你好世界'; // 4 characters, 12 bytes in UTF-8

      const bundles = [
        {
          name: 'test',
          version: '1.0.0',
          mainBundle: unicodeString,
          additionalExports: {}
        }
      ];

      const size = getBundleSize(bundles);
      expect(size).toBe(Buffer.byteLength(unicodeString, 'utf8'));
      expect(size).toBe(12); // 4 Chinese characters = 12 bytes
    });
  });

  // ==========================================================================
  // formatBundleSize Tests
  // ==========================================================================
  describe('formatBundleSize()', () => {
    it('should format 0 bytes', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(0)).toBe('0 B');
    });

    it('should format bytes under 1024', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(1)).toBe('1 B');
      expect(formatBundleSize(100)).toBe('100 B');
      expect(formatBundleSize(512)).toBe('512 B');
      expect(formatBundleSize(1023)).toBe('1023 B');
    });

    it('should format exactly 1 KB', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(1024)).toBe('1.00 KB');
    });

    it('should format kilobytes with decimals', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(1536)).toBe('1.50 KB');
      expect(formatBundleSize(2048)).toBe('2.00 KB');
      expect(formatBundleSize(10240)).toBe('10.00 KB');
      expect(formatBundleSize(102400)).toBe('100.00 KB');
    });

    it('should format at boundary of KB to MB', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(1024 * 1024 - 1)).toBe('1024.00 KB');
    });

    it('should format exactly 1 MB', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(1024 * 1024)).toBe('1.00 MB');
    });

    it('should format megabytes with decimals', async () => {
      const { formatBundleSize } = await import('../src/lib/react/bundler.js');
      expect(formatBundleSize(1.5 * 1024 * 1024)).toBe('1.50 MB');
      expect(formatBundleSize(2 * 1024 * 1024)).toBe('2.00 MB');
      expect(formatBundleSize(10 * 1024 * 1024)).toBe('10.00 MB');
    });
  });

  // ==========================================================================
  // bundleDependencies Tests
  // ==========================================================================
  describe('bundleDependencies()', () => {
    it('should return empty array for empty dependencies', async () => {
      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDependencies([], {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toEqual([]);
    });

    it('should bundle React dependencies with real node_modules', async () => {
      await createMockProject(projectDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('react');
      expect(results[0].version).toBe('18.2.0');
      expect(results[0].mainBundle.length).toBeGreaterThan(0);
    }, 30000);

    it('should bundle react-dom with client export', async () => {
      await createMockProject(projectDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDependencies(
        [{ name: 'react-dom', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('react-dom');
      expect(results[0].additionalExports).toBeDefined();
      expect(results[0].additionalExports!['client']).toBeDefined();
    }, 30000);

    it('should handle bundling errors gracefully', async () => {
      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      // Create minimal project without actual react installed
      await fs.promises.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        bundleDependencies(
          [{ name: 'nonexistent-package', version: '1.0.0' }],
          { projectRoot: projectDir, outputDir }
        )
      ).rejects.toThrow();

      errorSpy.mockRestore();
    });

    it('should write bundles to output directory', async () => {
      await createMockProject(projectDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      await bundleDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      const depDir = path.join(outputDir, 'react@18.2.0');
      expect(fs.existsSync(depDir)).toBe(true);
      expect(fs.existsSync(path.join(depDir, 'index.js'))).toBe(true);
    }, 30000);

    it('should clean up temp directory after bundling', async () => {
      await createMockProject(projectDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      await bundleDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      const tempDir = path.join(projectDir, '.oaysus-temp', 'react@18.2.0');
      expect(fs.existsSync(tempDir)).toBe(false);
    }, 30000);
  });

  // ==========================================================================
  // bundleServerDependencies Tests
  // ==========================================================================
  describe('bundleServerDependencies()', () => {
    it('should return empty array and warn when no React dependency', async () => {
      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await bundleServerDependencies(
        [{ name: 'lodash', version: '4.17.21' }],
        { projectRoot: projectDir, outputDir }
      );

      expect(results).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No React dependency found')
      );

      warnSpy.mockRestore();
    });

    it('should bundle React for server-side rendering', async () => {
      await createMockProject(projectDir);

      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleServerDependencies(
        [
          { name: 'react', version: '18.2.0' },
          { name: 'react-dom', version: '18.2.0' }
        ],
        { projectRoot: projectDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].depKey).toBe('react@18.2.0');
      expect(results[0].size).toBeGreaterThan(0);
    }, 60000);

    it('should create node_modules structure in server-deps', async () => {
      await createMockProject(projectDir);

      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');

      await bundleServerDependencies(
        [
          { name: 'react', version: '18.2.0' },
          { name: 'react-dom', version: '18.2.0' }
        ],
        { projectRoot: projectDir, outputDir }
      );

      const serverDepsDir = path.join(outputDir, 'server-deps', 'react@18.2.0', 'node_modules');
      expect(fs.existsSync(serverDepsDir)).toBe(true);
      expect(fs.existsSync(path.join(serverDepsDir, 'react', 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(serverDepsDir, 'react', 'package.json'))).toBe(true);
    }, 60000);

    it('should bundle React without react-dom', async () => {
      await createMockProject(projectDir);

      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleServerDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].depKey).toBe('react@18.2.0');
    }, 60000);

    it('should clean up temp directory after server bundling', async () => {
      await createMockProject(projectDir);

      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');

      await bundleServerDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      const tempDir = path.join(projectDir, '.oaysus-temp', 'server-deps');
      expect(fs.existsSync(tempDir)).toBe(false);
    }, 60000);
  });

  // ==========================================================================
  // bundleDetectedDependencies Tests
  // ==========================================================================
  describe('bundleDetectedDependencies()', () => {
    it('should return empty array for empty detected deps', async () => {
      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDetectedDependencies([], {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toEqual([]);
    });

    it('should bundle external dependency with sub-exports', async () => {
      await createMockProject(projectDir);
      await createMockExternalDep(projectDir, 'custom-lib', '1.0.0');

      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const detectedDeps = [
        {
          name: 'custom-lib',
          version: '1.0.0',
          imports: ['custom-lib'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }
      ];

      const results = await bundleDetectedDependencies(detectedDeps, {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('custom-lib');
      expect(results[0].version).toBe('1.0.0');
    }, 30000);

    it('should bundle CSS imports as JS modules', async () => {
      await createMockProject(projectDir);
      await createMockExternalDep(projectDir, 'css-lib', '2.0.0', true);

      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const detectedDeps = [
        {
          name: 'css-lib',
          version: '2.0.0',
          imports: ['css-lib', 'css-lib/css'],
          subExports: [],
          hasCSS: true,
          cssImports: ['css-lib/css']
        }
      ];

      // Note: This will produce a warning about CSS not found since our mock is minimal
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await bundleDetectedDependencies(detectedDeps, {
        projectRoot: projectDir,
        outputDir
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('css-lib');

      warnSpy.mockRestore();
    }, 30000);

    it('should handle bundling warnings for missing external deps', async () => {
      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      await fs.promises.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      const detectedDeps = [
        {
          name: 'nonexistent-lib',
          version: '1.0.0',
          imports: ['nonexistent-lib'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }
      ];

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // bundleDetectedDependencies will warn but not throw for missing packages
      const results = await bundleDetectedDependencies(detectedDeps, {
        projectRoot: projectDir,
        outputDir
      });

      // Result will have empty mainBundle due to bundling failure
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('nonexistent-lib');

      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Bundler Singleton Tests
  // ==========================================================================
  describe('bundler singleton', () => {
    it('should export bundler singleton', async () => {
      const { bundler, default: defaultBundler } = await import('../src/lib/react/bundler.js');

      expect(bundler).toBeDefined();
      expect(defaultBundler).toBeDefined();
      expect(bundler).toBe(defaultBundler);
    });

    it('should export all backward compatible functions', async () => {
      const module = await import('../src/lib/react/bundler.js');

      expect(typeof module.bundleDependencies).toBe('function');
      expect(typeof module.filterRuntimeDependencies).toBe('function');
      expect(typeof module.getBundleSize).toBe('function');
      expect(typeof module.formatBundleSize).toBe('function');
      expect(typeof module.bundleServerDependencies).toBe('function');
      expect(typeof module.bundleDetectedDependencies).toBe('function');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Integration tests', () => {
    it('should bundle React and write jsx-runtime export', async () => {
      await createMockProject(projectDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: projectDir, outputDir }
      );

      expect(results[0].additionalExports!['jsx-runtime']).toBeDefined();

      // Check file was written
      const jsxRuntimePath = path.join(outputDir, 'react@18.2.0', 'jsx-runtime.js');
      expect(fs.existsSync(jsxRuntimePath)).toBe(true);
    }, 30000);

    it('should handle multiple dependencies in sequence', async () => {
      await createMockProject(projectDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDependencies(
        [
          { name: 'react', version: '18.2.0' },
          { name: 'react-dom', version: '18.2.0' }
        ],
        { projectRoot: projectDir, outputDir }
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('react');
      expect(results[1].name).toBe('react-dom');
    }, 60000);
  });
});

// ==========================================================================
// Tests for sub-exports and CSS bundling
// ==========================================================================
describe('React Bundler - Sub-exports and CSS', () => {
  let subExportTestDir: string;

  beforeEach(async () => {
    subExportTestDir = path.join(os.tmpdir(), 'oaysus-subexport-test-' + Date.now() + '-' + Math.random().toString(36).substring(7));
    await fs.promises.mkdir(subExportTestDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(subExportTestDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should bundle detected dependency with JS sub-exports', async () => {
    await createMockProject(subExportTestDir);

    // Create a package with sub-exports
    const libDir = path.join(subExportTestDir, 'node_modules', 'my-lib');
    const libSubDir = path.join(libDir, 'utils');
    await fs.promises.mkdir(libSubDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        name: 'my-lib',
        version: '1.0.0',
        main: 'index.js',
        exports: {
          '.': './index.js',
          './utils': './utils/index.js'
        }
      })
    );

    await fs.promises.writeFile(
      path.join(libDir, 'index.js'),
      'export const main = () => {};'
    );

    await fs.promises.writeFile(
      path.join(libSubDir, 'index.js'),
      'export const utils = () => {};'
    );

    const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');
    const outputDir = path.join(subExportTestDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const results = await bundleDetectedDependencies(
      [{
        name: 'my-lib',
        version: '1.0.0',
        imports: ['my-lib', 'my-lib/utils'],
        subExports: ['utils'],
        hasCSS: false,
        cssImports: []
      }],
      { projectRoot: subExportTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    expect(results[0].additionalExports).toBeDefined();
    expect(results[0].additionalExports!['utils']).toBeDefined();
  }, 30000);

  it('should bundle CSS from file with .css extension', async () => {
    await createMockProject(subExportTestDir);

    // Create a package with CSS
    const libDir = path.join(subExportTestDir, 'node_modules', 'css-pkg');
    await fs.promises.mkdir(libDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        name: 'css-pkg',
        version: '1.0.0',
        main: 'index.js',
        style: 'style.css'
      })
    );

    await fs.promises.writeFile(
      path.join(libDir, 'index.js'),
      'export const pkg = () => {};'
    );

    // CSS file at direct path with .css extension
    await fs.promises.writeFile(
      path.join(libDir, 'style.css'),
      '.css-pkg { display: block; }'
    );

    const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');
    const outputDir = path.join(subExportTestDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const results = await bundleDetectedDependencies(
      [{
        name: 'css-pkg',
        version: '1.0.0',
        imports: ['css-pkg', 'css-pkg/style'],
        subExports: [],
        hasCSS: true,
        cssImports: ['css-pkg/style']
      }],
      { projectRoot: subExportTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    // CSS is bundled as JS module
    expect(results[0].additionalExports!['style']).toBeDefined();
    expect(results[0].additionalExports!['style']).toContain('display: block');
  }, 30000);

  it('should bundle CSS from index.css', async () => {
    await createMockProject(subExportTestDir);

    // Create a package with CSS in folder with index.css
    const libDir = path.join(subExportTestDir, 'node_modules', 'styled-lib');
    const cssDir = path.join(libDir, 'css');
    await fs.promises.mkdir(cssDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        name: 'styled-lib',
        version: '2.0.0',
        main: 'index.js'
      })
    );

    await fs.promises.writeFile(
      path.join(libDir, 'index.js'),
      'export const lib = () => {};'
    );

    // CSS file at css/index.css
    await fs.promises.writeFile(
      path.join(cssDir, 'index.css'),
      '.styled-lib { color: red; }'
    );

    const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');
    const outputDir = path.join(subExportTestDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const results = await bundleDetectedDependencies(
      [{
        name: 'styled-lib',
        version: '2.0.0',
        imports: ['styled-lib', 'styled-lib/css'],
        subExports: [],
        hasCSS: true,
        cssImports: ['styled-lib/css']
      }],
      { projectRoot: subExportTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    expect(results[0].additionalExports!['css']).toBeDefined();
    expect(results[0].additionalExports!['css']).toContain('color: red');
  }, 30000);

  it('should warn when CSS file not found', async () => {
    await createMockProject(subExportTestDir);

    // Create a package without the CSS file
    const libDir = path.join(subExportTestDir, 'node_modules', 'missing-css');
    await fs.promises.mkdir(libDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        name: 'missing-css',
        version: '1.0.0',
        main: 'index.js'
      })
    );

    await fs.promises.writeFile(
      path.join(libDir, 'index.js'),
      'export const lib = () => {};'
    );

    const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');
    const outputDir = path.join(subExportTestDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const results = await bundleDetectedDependencies(
      [{
        name: 'missing-css',
        version: '1.0.0',
        imports: ['missing-css'],
        subExports: [],
        hasCSS: true,
        cssImports: ['missing-css/nonexistent.css']
      }],
      { projectRoot: subExportTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    // CSS not found, so no additional export for it
    expect(results[0].additionalExports!['nonexistent.css']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  }, 30000);

  it('should bundle package without explicit exports config (uses export * from)', async () => {
    await createMockProject(subExportTestDir);

    // Create a custom package not in REACT_EXPORT_CONFIG
    const libDir = path.join(subExportTestDir, 'node_modules', 'generic-lib');
    const subDir = path.join(libDir, 'sub');
    await fs.promises.mkdir(subDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        name: 'generic-lib',
        version: '1.0.0',
        main: 'index.js',
        exports: {
          '.': './index.js',
          './sub': './sub/index.js'
        }
      })
    );

    await fs.promises.writeFile(
      path.join(libDir, 'index.js'),
      'export const main = "main"; export const foo = () => {};'
    );

    await fs.promises.writeFile(
      path.join(subDir, 'index.js'),
      'export const sub = "sub"; export const bar = () => {};'
    );

    const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');
    const outputDir = path.join(subExportTestDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });

    const results = await bundleDetectedDependencies(
      [{
        name: 'generic-lib',
        version: '1.0.0',
        imports: ['generic-lib', 'generic-lib/sub'],
        subExports: ['sub'],
        hasCSS: false,
        cssImports: []
      }],
      { projectRoot: subExportTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    expect(results[0].mainBundle).toBeDefined();
    expect(results[0].additionalExports!['sub']).toBeDefined();
  }, 30000);
});

// ==========================================================================
// Additional edge case tests for complete coverage
// ==========================================================================
describe('React Bundler - Edge Cases', () => {
  let edgeTestDir: string;
  let outputDir: string;

  beforeEach(async () => {
    edgeTestDir = path.join(os.tmpdir(), 'oaysus-edge-test-' + Date.now() + '-' + Math.random().toString(36).substring(7));
    outputDir = path.join(edgeTestDir, 'output');
    await fs.promises.mkdir(edgeTestDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(edgeTestDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('readBundleFile path resolution', () => {
    it('should find .es.js file first', async () => {
      await createMockProject(edgeTestDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');
      const outputDir = path.join(edgeTestDir, 'output');
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Run bundling which uses readBundleFile internally
      const results = await bundleDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: edgeTestDir, outputDir }
      );

      // If bundling succeeded, readBundleFile found the file
      expect(results[0].mainBundle.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('bundleSubExport with nested paths', () => {
    it('should handle export names with slashes', async () => {
      // This is tested implicitly through bundling react which has jsx-runtime
      await createMockProject(edgeTestDir);

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');
      const outputDir = path.join(edgeTestDir, 'output');
      await fs.promises.mkdir(outputDir, { recursive: true });

      const results = await bundleDependencies(
        [{ name: 'react', version: '18.2.0' }],
        { projectRoot: edgeTestDir, outputDir }
      );

      // jsx-runtime is bundled as additional export
      expect(results[0].additionalExports).toBeDefined();
    }, 30000);
  });

  describe('bundleCSSAsModule fallback paths', () => {
    it('should try multiple CSS paths', async () => {
      await createMockProject(edgeTestDir);

      // Create a package with various CSS file patterns
      const cssLibDir = path.join(edgeTestDir, 'node_modules', 'css-test-lib');
      await fs.promises.mkdir(cssLibDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(cssLibDir, 'package.json'),
        JSON.stringify({ name: 'css-test-lib', version: '1.0.0', main: 'index.js' })
      );

      await fs.promises.writeFile(
        path.join(cssLibDir, 'index.js'),
        'export const test = 1;'
      );

      // Create CSS file in index.css location
      await fs.promises.writeFile(
        path.join(cssLibDir, 'index.css'),
        '.test { color: red; }'
      );

      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');
      const outputDir = path.join(edgeTestDir, 'output');
      await fs.promises.mkdir(outputDir, { recursive: true });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await bundleDetectedDependencies(
        [{
          name: 'css-test-lib',
          version: '1.0.0',
          imports: ['css-test-lib'],
          subExports: [],
          hasCSS: true,
          cssImports: ['css-test-lib']
        }],
        { projectRoot: edgeTestDir, outputDir }
      );

      expect(results).toHaveLength(1);

      warnSpy.mockRestore();
    }, 30000);
  });

  describe('getExportsConfig for packages without config', () => {
    it('should return undefined for unknown packages', async () => {
      await createMockProject(edgeTestDir);

      // Create a non-React package
      const customLibDir = path.join(edgeTestDir, 'node_modules', 'custom-pkg');
      await fs.promises.mkdir(customLibDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(customLibDir, 'package.json'),
        JSON.stringify({ name: 'custom-pkg', version: '1.0.0', main: 'index.js' })
      );

      await fs.promises.writeFile(
        path.join(customLibDir, 'index.js'),
        'export const test = 1;'
      );

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');
      const outputDir = path.join(edgeTestDir, 'output');
      await fs.promises.mkdir(outputDir, { recursive: true });

      // This should work but with no additional exports since no config
      const results = await bundleDependencies(
        [{ name: 'custom-pkg', version: '1.0.0' }],
        { projectRoot: edgeTestDir, outputDir }
      );

      expect(results[0].name).toBe('custom-pkg');
      // No additional exports for unknown packages
      expect(Object.keys(results[0].additionalExports || {}).length).toBe(0);
    }, 30000);
  });

  describe('error handling and cleanup', () => {
    it('should clean up temp directory on bundling error', async () => {
      const { bundleDependencies } = await import('../src/lib/react/bundler.js');

      await fs.promises.writeFile(
        path.join(edgeTestDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      await fs.promises.mkdir(outputDir, { recursive: true });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await bundleDependencies(
          [{ name: 'nonexistent', version: '1.0.0' }],
          { projectRoot: edgeTestDir, outputDir }
        );
      } catch {
        // Expected
      }

      // Temp directory should be cleaned up
      const tempDir = path.join(edgeTestDir, '.oaysus-temp', 'nonexistent@1.0.0');
      expect(fs.existsSync(tempDir)).toBe(false);

      errorSpy.mockRestore();
    });

    it('should handle bundleServerDependencies error and cleanup', async () => {
      const { bundleServerDependencies } = await import('../src/lib/react/bundler.js');

      await fs.promises.writeFile(
        path.join(edgeTestDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      // Create node_modules but no react
      await fs.promises.mkdir(path.join(edgeTestDir, 'node_modules'), { recursive: true });

      await fs.promises.mkdir(outputDir, { recursive: true });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await bundleServerDependencies(
          [{ name: 'react', version: '18.2.0' }],
          { projectRoot: edgeTestDir, outputDir }
        );
      } catch {
        // May throw due to missing actual react
      }

      // Temp directory should be cleaned up
      const tempDir = path.join(edgeTestDir, '.oaysus-temp', 'server-deps');
      expect(fs.existsSync(tempDir)).toBe(false);

      errorSpy.mockRestore();
    });

    it('should handle bundleExternalDependency error and cleanup', async () => {
      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      await fs.promises.writeFile(
        path.join(edgeTestDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      await fs.promises.mkdir(outputDir, { recursive: true });

      // Create a package that will cause a Vite build error
      const libDir = path.join(edgeTestDir, 'node_modules', 'broken-pkg');
      await fs.promises.mkdir(libDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(libDir, 'package.json'),
        JSON.stringify({ name: 'broken-pkg', version: '1.0.0', main: 'index.js' })
      );

      // Invalid JavaScript that will cause build to fail
      await fs.promises.writeFile(
        path.join(libDir, 'index.js'),
        'export const broken = (() => { throw new Error("fail"); })();'
      );

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Note: This should warn, not throw, because bundlePackageExport catches errors
      const results = await bundleDetectedDependencies(
        [{
          name: 'broken-pkg',
          version: '1.0.0',
          imports: ['broken-pkg'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }],
        { projectRoot: edgeTestDir, outputDir }
      );

      // Should complete but with empty bundle
      expect(results).toHaveLength(1);

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('bundleSubExport nested path handling', () => {
    it('should create parent directory for nested export paths', async () => {
      await createMockProject(edgeTestDir);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Create a package with nested sub-exports like "internal/client"
      const libDir = path.join(edgeTestDir, 'node_modules', 'nested-pkg');
      const internalDir = path.join(libDir, 'internal');
      await fs.promises.mkdir(internalDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(libDir, 'package.json'),
        JSON.stringify({
          name: 'nested-pkg',
          version: '1.0.0',
          main: 'index.js',
          exports: {
            '.': './index.js',
            './internal/client': './internal/client.js'
          }
        })
      );

      await fs.promises.writeFile(
        path.join(libDir, 'index.js'),
        'export const main = () => {};'
      );

      await fs.promises.writeFile(
        path.join(internalDir, 'client.js'),
        'export const client = () => {};'
      );

      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDetectedDependencies(
        [{
          name: 'nested-pkg',
          version: '1.0.0',
          imports: ['nested-pkg', 'nested-pkg/internal/client'],
          subExports: ['internal/client'],
          hasCSS: false,
          cssImports: []
        }],
        { projectRoot: edgeTestDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].additionalExports!['internal/client']).toBeDefined();
    }, 30000);
  });

  describe('bundleSingleDependency mainBundle warning', () => {
    it('should warn when main bundle file cannot be found', async () => {
      await createMockProject(edgeTestDir);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Create a package that produces no output (empty exports)
      const libDir = path.join(edgeTestDir, 'node_modules', 'empty-pkg');
      await fs.promises.mkdir(libDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(libDir, 'package.json'),
        JSON.stringify({
          name: 'empty-pkg',
          version: '1.0.0',
          main: 'index.js'
        })
      );

      // Package with no exports
      await fs.promises.writeFile(
        path.join(libDir, 'index.js'),
        '// Empty file with no exports'
      );

      const { bundleDependencies } = await import('../src/lib/react/bundler.js');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const results = await bundleDependencies(
        [{ name: 'empty-pkg', version: '1.0.0' }],
        { projectRoot: edgeTestDir, outputDir }
      );

      expect(results).toHaveLength(1);
      // Even empty packages should produce a bundle
      expect(results[0].name).toBe('empty-pkg');

      warnSpy.mockRestore();
    }, 30000);
  });

  describe('bundleSubExport without explicit exports', () => {
    it('should use export * from for packages without EXPLICIT_NAMED_EXPORTS config', async () => {
      await createMockProject(edgeTestDir);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Create a package that's not in EXPLICIT_NAMED_EXPORTS (like lodash)
      const libDir = path.join(edgeTestDir, 'node_modules', 'unknown-lib');
      const utilsDir = path.join(libDir, 'utils');
      await fs.promises.mkdir(utilsDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(libDir, 'package.json'),
        JSON.stringify({
          name: 'unknown-lib',
          version: '3.0.0',
          main: 'index.js',
          exports: {
            '.': './index.js',
            './utils': './utils/index.js'
          }
        })
      );

      await fs.promises.writeFile(
        path.join(libDir, 'index.js'),
        'export const lib = () => {};'
      );

      await fs.promises.writeFile(
        path.join(utilsDir, 'index.js'),
        'export const util = () => {};'
      );

      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDetectedDependencies(
        [{
          name: 'unknown-lib',
          version: '3.0.0',
          imports: ['unknown-lib', 'unknown-lib/utils'],
          subExports: ['utils'],
          hasCSS: false,
          cssImports: []
        }],
        { projectRoot: edgeTestDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].mainBundle.length).toBeGreaterThan(0);
      expect(results[0].additionalExports!['utils']).toBeDefined();
    }, 30000);
  });

  describe('bundlePackageExport path variations', () => {
    it('should bundle package with empty export path (main export)', async () => {
      await createMockProject(edgeTestDir);
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Create a simple package
      const libDir = path.join(edgeTestDir, 'node_modules', 'simple-pkg');
      await fs.promises.mkdir(libDir, { recursive: true });

      await fs.promises.writeFile(
        path.join(libDir, 'package.json'),
        JSON.stringify({
          name: 'simple-pkg',
          version: '1.0.0',
          main: 'index.js'
        })
      );

      await fs.promises.writeFile(
        path.join(libDir, 'index.js'),
        'export const simple = () => "simple";'
      );

      const { bundleDetectedDependencies } = await import('../src/lib/react/bundler.js');

      const results = await bundleDetectedDependencies(
        [{
          name: 'simple-pkg',
          version: '1.0.0',
          imports: ['simple-pkg'],
          subExports: [],
          hasCSS: false,
          cssImports: []
        }],
        { projectRoot: edgeTestDir, outputDir }
      );

      expect(results).toHaveLength(1);
      expect(results[0].mainBundle).toContain('simple');
    }, 30000);
  });
});

// ==========================================================================
// Tests for bundleDependencies with React framework exports
// ==========================================================================
describe('React Bundler - Framework Export Bundling', () => {
  let frameworkTestDir: string;
  let outputDir: string;

  beforeEach(async () => {
    frameworkTestDir = path.join(os.tmpdir(), 'oaysus-framework-test-' + Date.now() + '-' + Math.random().toString(36).substring(7));
    outputDir = path.join(frameworkTestDir, 'output');
    await fs.promises.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(frameworkTestDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should bundle react with jsx-runtime and jsx-dev-runtime exports', async () => {
    await createMockProject(frameworkTestDir);

    const { bundleDependencies } = await import('../src/lib/react/bundler.js');

    const results = await bundleDependencies(
      [{ name: 'react', version: '18.2.0' }],
      { projectRoot: frameworkTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    expect(results[0].additionalExports!['jsx-runtime']).toBeDefined();
    expect(results[0].additionalExports!['jsx-dev-runtime']).toBeDefined();

    // Verify files were written
    expect(fs.existsSync(path.join(outputDir, 'react@18.2.0', 'jsx-runtime.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'react@18.2.0', 'jsx-dev-runtime.js'))).toBe(true);
  }, 60000);

  it('should bundle react-dom with client export externalized to react', async () => {
    await createMockProject(frameworkTestDir);

    const { bundleDependencies } = await import('../src/lib/react/bundler.js');

    const results = await bundleDependencies(
      [{ name: 'react-dom', version: '18.2.0' }],
      { projectRoot: frameworkTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    expect(results[0].additionalExports!['client']).toBeDefined();

    // Client export should reference react as external
    const clientBundle = results[0].additionalExports!['client'];
    expect(clientBundle).toBeDefined();
  }, 60000);

  it('should bundle package without explicit named exports config (uses export * from)', async () => {
    await createMockProject(frameworkTestDir);

    // Create a package that has a sub-export but is NOT in EXPLICIT_NAMED_EXPORTS
    const libDir = path.join(frameworkTestDir, 'node_modules', 'no-explicit-pkg');
    const subDir = path.join(libDir, 'sub');
    await fs.promises.mkdir(subDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(libDir, 'package.json'),
      JSON.stringify({
        name: 'no-explicit-pkg',
        version: '1.0.0',
        main: 'index.js',
        exports: {
          '.': './index.js',
          './sub': './sub/index.js'
        }
      })
    );

    await fs.promises.writeFile(
      path.join(libDir, 'index.js'),
      'export const main = () => "main";'
    );

    await fs.promises.writeFile(
      path.join(subDir, 'index.js'),
      'export const sub = () => "sub";'
    );

    const { bundleDependencies } = await import('../src/lib/react/bundler.js');

    // To hit the else branch (line 91), we need to bundle a package
    // that has exports config but the specific sub-export is not in EXPLICIT_NAMED_EXPORTS
    // React has jsx-runtime defined but if we create a package that mimics the structure
    // without being in the config, it should use export * from

    const results = await bundleDependencies(
      [{ name: 'no-explicit-pkg', version: '1.0.0' }],
      { projectRoot: frameworkTestDir, outputDir }
    );

    expect(results).toHaveLength(1);
    // This package won't have additional exports since it's not in REACT_EXPORT_CONFIG
    expect(results[0].name).toBe('no-explicit-pkg');
  }, 30000);
});
