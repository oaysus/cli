/**
 * Vue Dependency Bundler
 * Vue-specific implementation for bundling dependencies
 */

import { build } from 'vite';
import * as path from 'path';
import * as fs from 'fs';
import type { IBundler, BundledDependency, BundleDependencyOptions, FrameworkExportConfig } from '../core/types.js';

// Vue-specific export configurations
const VUE_EXPORT_CONFIG: Record<string, FrameworkExportConfig> = {
  'vue': {
    exports: []  // Main package re-exports everything
  },
  '@vue/runtime-dom': {
    exports: [],
    externals: ['vue', '@vue/runtime-core', '@vue/shared', '@vue/reactivity']
  },
  '@vue/runtime-core': {
    exports: [],
    externals: ['vue', '@vue/reactivity', '@vue/shared']
  },
  '@vue/reactivity': {
    exports: [],
    externals: ['vue', '@vue/shared']
  },
  '@vue/shared': {
    exports: []
  }
};

class VueBundler implements IBundler {
  /**
   * Get exports configuration for a Vue package
   */
  private getExportsConfig(packageName: string): FrameworkExportConfig | undefined {
    return VUE_EXPORT_CONFIG[packageName];
  }

  /**
   * Read bundle file from multiple possible paths
   */
  private readBundleFile(tempDir: string, distFolder: string, fileName: string): string | null {
    const possiblePaths = [
      path.join(tempDir, distFolder, `${fileName}.es.js`),
      path.join(tempDir, distFolder, `${fileName}.mjs`),
      path.join(tempDir, distFolder, `${fileName}.js`)
    ];

    for (const bundlePath of possiblePaths) {
      if (fs.existsSync(bundlePath)) {
        return fs.readFileSync(bundlePath, 'utf-8');
      }
    }

    return null;
  }

  /**
   * Bundle a single dependency
   */
  private async bundleSingleDependency(
    packageName: string,
    version: string,
    options: BundleDependencyOptions
  ): Promise<BundledDependency> {
    const { projectRoot, outputDir } = options;
    const tempDir = path.join(projectRoot, '.oaysus-temp', `${packageName}@${version}`);

    const result: BundledDependency = {
      name: packageName,
      version,
      mainBundle: '',
      additionalExports: {}
    };

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      // Get Vue-specific config
      const config = this.getExportsConfig(packageName);
      const externals = config?.externals || [];

      // Build main bundle
      const mainEntry = path.join(tempDir, 'main-entry.js');
      const entryContent = `import * as _pkg from '${packageName}';
export * from '${packageName}';
export default _pkg;`;
      fs.writeFileSync(mainEntry, entryContent);

      await build({
        root: projectRoot,
        logLevel: 'silent',
        build: {
          lib: {
            entry: mainEntry,
            formats: ['es'],
            fileName: 'index'
          },
          outDir: path.join(tempDir, 'dist'),
          emptyOutDir: true,
          minify: true,
          rollupOptions: {
            external: externals,
            output: {
              globals: externals.reduce((acc, ext) => ({ ...acc, [ext]: ext }), {})
            }
          }
        },
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      });

      // Read main bundle
      result.mainBundle = this.readBundleFile(tempDir, 'dist', 'index') || '';
      if (!result.mainBundle) {
        console.warn(`[VueBundler] Could not find main bundle for ${packageName}`);
      }

      // Save to output directory
      if (outputDir) {
        const depDir = path.join(outputDir, `${packageName}@${version}`);
        fs.mkdirSync(depDir, { recursive: true });
        fs.writeFileSync(path.join(depDir, 'index.js'), result.mainBundle);
      }

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return result;
    } catch (error) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      console.error(`Failed to bundle ${packageName}@${version}:`, error);
      throw error;
    }
  }

  /**
   * Bundle multiple dependencies for R2 upload
   */
  async bundleDependencies(
    dependencies: Array<{ name: string; version: string }>,
    options: BundleDependencyOptions
  ): Promise<BundledDependency[]> {
    const results: BundledDependency[] = [];

    for (const dep of dependencies) {
      console.log(`Bundling ${dep.name}@${dep.version}...`);
      const bundled = await this.bundleSingleDependency(dep.name, dep.version, options);
      results.push(bundled);
    }

    return results;
  }

  /**
   * Filter dependencies to only include runtime dependencies
   */
  filterRuntimeDependencies(
    dependencies: Array<{ name: string; version: string }>
  ): Array<{ name: string; version: string }> {
    const devOnlyPatterns = [
      /^@types\//,
      /^typescript$/,
      /^eslint/,
      /^prettier/,
      /^vite$/,
      /^vitest/,
      /^jest/,
      /^@testing-library/,
      /^autoprefixer$/,
      /^postcss$/,
      /^tailwindcss$/,
      /^@vitejs\//,
      /^@sveltejs\/vite-plugin/,
      /^svelte-check$/,
      /^vue-tsc$/
    ];

    return dependencies.filter(dep => {
      return !devOnlyPatterns.some(pattern => pattern.test(dep.name));
    });
  }

  /**
   * Get the size of bundled dependencies in bytes
   */
  getBundleSize(bundles: BundledDependency[]): number {
    let totalSize = 0;

    for (const bundle of bundles) {
      totalSize += Buffer.byteLength(bundle.mainBundle, 'utf8');

      for (const content of Object.values(bundle.additionalExports || {})) {
        totalSize += Buffer.byteLength(content, 'utf8');
      }
    }

    return totalSize;
  }

  /**
   * Format bundle size for display
   */
  formatBundleSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Bundle server-side dependencies for SSR (stub for Vue)
   * TODO: Implement Vue SSR bundling when needed
   */
  async bundleServerDependencies(
    _dependencies: Array<{ name: string; version: string }>,
    _options: BundleDependencyOptions
  ): Promise<{ depKey: string; path: string; size: number }[]> {
    // Vue server bundling not yet implemented
    console.log('[VueBundler] Server dependency bundling not yet implemented for Vue');
    return [];
  }

  /**
   * Bundle detected external dependencies (stub for Vue)
   * TODO: Implement when Vue components need third-party libs
   */
  async bundleDetectedDependencies(
    _detectedDeps: import('../core/types.js').DetectedDependency[],
    _options: BundleDependencyOptions
  ): Promise<BundledDependency[]> {
    console.log('[VueBundler] External dependency bundling not yet implemented for Vue');
    return [];
  }
}

// Export singleton instance
const bundler = new VueBundler();
export default bundler;
export { bundler };

// Export individual functions for backward compatibility
export const bundleDependencies = bundler.bundleDependencies.bind(bundler);
export const filterRuntimeDependencies = bundler.filterRuntimeDependencies.bind(bundler);
export const getBundleSize = bundler.getBundleSize.bind(bundler);
export const formatBundleSize = bundler.formatBundleSize.bind(bundler);
