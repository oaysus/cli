/**
 * Tests for core modules
 * Covers framework-registry.ts - framework detection and dynamic module loading
 */

// Jest globals are auto-imported

describe('framework-registry module', () => {
  beforeEach(() => {
    // Bun doesn't need module reset like Jest
  });

  afterEach(() => {
    // Bun doesn't need mock restoration like Jest
  });

  describe('detectFramework()', () => {
    it('should detect React from dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('react');
    });

    it('should detect React from devDependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        devDependencies: {
          react: '^18.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('react');
    });

    it('should detect Svelte from dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          svelte: '^4.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('svelte');
    });

    it('should detect Vue from dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          vue: '^3.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('vue');
    });

    it('should detect Solid from dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          'solid-js': '^1.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('solid');
    });

    it('should detect Preact from dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          preact: '^10.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('preact');
    });

    it('should default to react when no framework detected', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          lodash: '^4.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('react');
    });

    it('should prioritize React over other frameworks when multiple present', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      // React should be detected first due to order in detectFramework
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          vue: '^3.0.0',
          svelte: '^4.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('react');
    });

    it('should handle empty dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {},
      };

      expect(detectFramework(packageJson)).toBe('react');
    });

    it('should handle undefined dependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {};

      expect(detectFramework(packageJson)).toBe('react');
    });

    it('should merge dependencies and devDependencies', async () => {
      const { detectFramework } = await import('../src/lib/core/framework-registry.js');

      const packageJson = {
        dependencies: {
          lodash: '^4.0.0',
        },
        devDependencies: {
          svelte: '^4.0.0',
        },
      };

      expect(detectFramework(packageJson)).toBe('svelte');
    });
  });

  describe('getBuilder()', () => {
    it('should load React builder successfully', async () => {
      const { getBuilder } = await import('../src/lib/core/framework-registry.js');

      const builder = await getBuilder('react');

      expect(builder).toBeDefined();
      expect(typeof builder.buildComponents).toBe('function');
      expect(typeof builder.buildServerComponents).toBe('function');
      expect(typeof builder.buildThemeCSS).toBe('function');
    });

    it('should throw error for non-existent framework builder', async () => {
      const { getBuilder } = await import('../src/lib/core/framework-registry.js');

      // @ts-ignore - testing invalid framework
      await expect(getBuilder('invalid-framework')).rejects.toThrow(
        /Failed to load builder for framework "invalid-framework"/
      );
    });

    it('should return module.default if available', async () => {
      const { getBuilder } = await import('../src/lib/core/framework-registry.js');

      // The React builder exports default, so this should work
      const builder = await getBuilder('react');
      expect(builder).toBeDefined();
    });
  });

  describe('getBundler()', () => {
    it('should load React bundler successfully', async () => {
      const { getBundler } = await import('../src/lib/core/framework-registry.js');

      const bundler = await getBundler('react');

      expect(bundler).toBeDefined();
      expect(typeof bundler.bundleDependencies).toBe('function');
      expect(typeof bundler.bundleServerDependencies).toBe('function');
      expect(typeof bundler.bundleDetectedDependencies).toBe('function');
      expect(typeof bundler.filterRuntimeDependencies).toBe('function');
      expect(typeof bundler.getBundleSize).toBe('function');
      expect(typeof bundler.formatBundleSize).toBe('function');
    });

    it('should throw error for non-existent framework bundler', async () => {
      const { getBundler } = await import('../src/lib/core/framework-registry.js');

      // @ts-ignore - testing invalid framework
      await expect(getBundler('invalid-framework')).rejects.toThrow(
        /Failed to load bundler for framework "invalid-framework"/
      );
    });
  });

  describe('getImportMapGenerator()', () => {
    it('should load React import map generator successfully', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      const importMapGen = await getImportMapGenerator('react');

      expect(importMapGen).toBeDefined();
      expect(typeof importMapGen.generateImportMapFromPackageJson).toBe('function');
      expect(typeof importMapGen.generateImportMapWithR2Urls).toBe('function');
      expect(typeof importMapGen.generateImportMapWithStylesheets).toBe('function');
      expect(typeof importMapGen.getDependenciesToBundle).toBe('function');
    });

    it('should throw error for non-existent framework import map generator', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      // @ts-ignore - testing invalid framework
      await expect(getImportMapGenerator('invalid-framework')).rejects.toThrow(
        /Failed to load import map generator for framework "invalid-framework"/
      );
    });
  });

  describe('Integration tests - framework detection and module loading', () => {
    it('should load correct modules for detected React framework', async () => {
      const { detectFramework, getBuilder, getBundler, getImportMapGenerator } = await import(
        '../src/lib/core/framework-registry.js'
      );

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const framework = detectFramework(packageJson);
      expect(framework).toBe('react');

      const builder = await getBuilder(framework);
      const bundler = await getBundler(framework);
      const importMapGen = await getImportMapGenerator(framework);

      expect(builder).toBeDefined();
      expect(bundler).toBeDefined();
      expect(importMapGen).toBeDefined();
    });

    it('should use import map generator to get dependencies', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      const importMapGen = await getImportMapGenerator('react');

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const deps = importMapGen.getDependenciesToBundle(packageJson);
      expect(Array.isArray(deps)).toBe(true);
      expect(deps.length).toBeGreaterThan(0);

      // React should be in the dependencies
      const reactDep = deps.find((d: { name: string }) => d.name === 'react');
      expect(reactDep).toBeDefined();
    });

    it('should generate import map from package.json', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      const importMapGen = await getImportMapGenerator('react');

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const importMap = importMapGen.generateImportMapFromPackageJson(packageJson);
      expect(importMap).toBeDefined();
      expect(importMap.imports).toBeDefined();
      expect(typeof importMap.imports).toBe('object');
    });

    it('should generate import map with R2 URLs', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      const importMapGen = await getImportMapGenerator('react');

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'local/user/website/theme/1.0.0',
      };

      const importMap = importMapGen.generateImportMapWithR2Urls(packageJson, options);
      expect(importMap).toBeDefined();
      expect(importMap.imports).toBeDefined();

      // URLs should contain the R2 base path
      const importValues = Object.values(importMap.imports);
      const hasR2Urls = importValues.some((url: unknown) =>
        typeof url === 'string' && url.includes('r2.dev')
      );
      expect(hasR2Urls).toBe(true);
    });

    it('should generate import map with stylesheets', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      const importMapGen = await getImportMapGenerator('react');

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const options = {
        r2PublicUrl: 'https://pub-xxx.r2.dev',
        r2BasePath: 'local/user/website/theme/1.0.0',
        detectedDeps: [],
      };

      const result = importMapGen.generateImportMapWithStylesheets(packageJson, options);
      expect(result).toBeDefined();
      expect(result.imports).toBeDefined();
      expect(result.stylesheets).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should include framework name in error message for getBuilder', async () => {
      const { getBuilder } = await import('../src/lib/core/framework-registry.js');

      try {
        // @ts-ignore - testing invalid framework
        await getBuilder('nonexistent');
        throw new Error('Expected error to be thrown');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('nonexistent');
        expect((error as Error).message).toContain('builder');
      }
    });

    it('should include framework name in error message for getBundler', async () => {
      const { getBundler } = await import('../src/lib/core/framework-registry.js');

      try {
        // @ts-ignore - testing invalid framework
        await getBundler('nonexistent');
        throw new Error('Expected error to be thrown');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('nonexistent');
        expect((error as Error).message).toContain('bundler');
      }
    });

    it('should include framework name in error message for getImportMapGenerator', async () => {
      const { getImportMapGenerator } = await import('../src/lib/core/framework-registry.js');

      try {
        // @ts-ignore - testing invalid framework
        await getImportMapGenerator('nonexistent');
        throw new Error('Expected error to be thrown');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('nonexistent');
        expect((error as Error).message).toContain('import map');
      }
    });
  });

  describe('Bundler functionality', () => {
    it('should filter runtime dependencies', async () => {
      const { getBundler } = await import('../src/lib/core/framework-registry.js');

      const bundler = await getBundler('react');

      const dependencies = [
        { name: 'react', version: '18.0.0' },
        { name: 'react-dom', version: '18.0.0' },
        { name: 'typescript', version: '5.0.0' },
      ];

      const filtered = bundler.filterRuntimeDependencies(dependencies);
      expect(Array.isArray(filtered)).toBe(true);

      // React and react-dom should be kept, typescript should be filtered out
      const names = filtered.map((d: { name: string }) => d.name);
      expect(names).toContain('react');
      expect(names).toContain('react-dom');
    });

    it('should format bundle size correctly', async () => {
      const { getBundler } = await import('../src/lib/core/framework-registry.js');

      const bundler = await getBundler('react');

      // Test various sizes
      const smallSize = bundler.formatBundleSize(500);
      const mediumSize = bundler.formatBundleSize(1500);
      const largeSize = bundler.formatBundleSize(1500000);

      expect(typeof smallSize).toBe('string');
      expect(typeof mediumSize).toBe('string');
      expect(typeof largeSize).toBe('string');
    });

    it('should calculate bundle size from array', async () => {
      const { getBundler } = await import('../src/lib/core/framework-registry.js');

      const bundler = await getBundler('react');

      const bundles = [
        { name: 'react', version: '18.0.0', mainBundle: '/path/to/bundle.js' },
        { name: 'react-dom', version: '18.0.0', mainBundle: '/path/to/bundle2.js' },
      ];

      const size = bundler.getBundleSize(bundles);
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });
});
