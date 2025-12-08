/**
 * Svelte Import Map Generator
 * Svelte-specific implementation for generating import maps
 */

import type { IImportMapGenerator, ImportMap, ImportMapWithStylesheets, R2ImportMapOptions } from '../core/types.js';
import { SVELTE_EXTERNALS } from './config.js';

// Svelte-specific import mappings for bundled sub-exports
// Maps import specifiers to bundled filenames (8 optimized bundles)
const SVELTE_IMPORT_MAPPINGS: Record<string, string[]> = {
  'svelte': ['internal/client', 'internal/disclose-version', 'store', 'motion', 'transition', 'animate', 'easing']
};

// Map from import specifier to bundled filename
const SVELTE_BUNDLE_FILENAMES: Record<string, string> = {
  'internal/client': 'internal-client.js',
  'internal/disclose-version': 'internal-disclose-version.js',
  'store': 'store.js',
  'motion': 'motion.js',
  'transition': 'transition.js',
  'animate': 'animate.js',
  'easing': 'easing.js'
};

// Dev-only packages that shouldn't be in import map
const DEV_ONLY_PATTERNS = [
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
  /^@tailwindcss\//,
  /^@vitejs\//,
  /^@sveltejs\/vite-plugin/,
  /^svelte-check$/,
  /^vue-tsc$/
];

class SvelteImportMapGenerator implements IImportMapGenerator {
  /**
   * Check if a package is dev-only
   */
  private isDevOnlyPackage(packageName: string): boolean {
    return DEV_ONLY_PATTERNS.some(pattern => pattern.test(packageName));
  }

  /**
   * Generate import map from package.json dependencies
   * Uses esm.sh CDN for now
   */
  generateImportMapFromPackageJson(packageJson: any): ImportMap {
    const imports: Record<string, string> = {};

    // Get all dependencies
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Generate import map entries for each dependency
    for (const [packageName, versionRange] of Object.entries(deps || {})) {
      // Skip dev-only packages
      if (this.isDevOnlyPackage(packageName)) {
        continue;
      }

      // Only include Svelte framework dependencies
      if (!SVELTE_EXTERNALS.includes(packageName)) {
        continue;
      }

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');

      // Use esm.sh CDN
      const baseUrl = `https://esm.sh/${packageName}@${version}`;

      // Add main export
      imports[packageName] = baseUrl;

      // Add Svelte-specific sub-exports
      const subExports = SVELTE_IMPORT_MAPPINGS[packageName];
      if (subExports) {
        for (const exportName of subExports) {
          // For CDN, keep the slash path (esm.sh handles it)
          imports[`${packageName}/${exportName}`] = `${baseUrl}/${exportName}`;
        }
      }

      // For Svelte with CDN, also map nested internal paths (esm.sh will handle them)
      if (packageName === 'svelte') {
        imports['svelte/internal/client'] = `${baseUrl}/internal/client`;
        imports['svelte/internal/server'] = `${baseUrl}/internal/server`;
        imports['svelte/internal/disclose-version'] = `${baseUrl}/internal/disclose-version`;
        imports['svelte/internal/flags/legacy'] = `${baseUrl}/internal/flags/legacy`;
      }
    }

    return { imports };
  }

  /**
   * Generate import map using R2 URLs
   */
  generateImportMapWithR2Urls(
    packageJson: any,
    options: R2ImportMapOptions
  ): ImportMap {
    const imports: Record<string, string> = {};
    const { r2PublicUrl, r2BasePath } = options;

    // Get all dependencies
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Generate import map entries
    for (const [packageName, versionRange] of Object.entries(deps || {})) {
      // Skip dev-only packages
      if (this.isDevOnlyPackage(packageName)) {
        continue;
      }

      // Only include Svelte framework dependencies
      if (!SVELTE_EXTERNALS.includes(packageName)) {
        continue;
      }

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');

      // Build R2 URL
      const baseUrl = r2BasePath
        ? `${r2PublicUrl}/${r2BasePath}/deps/${packageName}@${version}`
        : `${r2PublicUrl}/deps/${packageName}@${version}`;

      // Use local bundled Svelte (bundler creates optimized production bundles)
      if (packageName === 'svelte') {
        imports[packageName] = `${baseUrl}/index.js`;
        imports['svelte/internal/client'] = `${baseUrl}/internal-client.js`;
        imports['svelte/internal/disclose-version'] = `${baseUrl}/internal-disclose-version.js`;
        imports['svelte/store'] = `${baseUrl}/store.js`;
        imports['svelte/motion'] = `${baseUrl}/motion.js`;
        imports['svelte/transition'] = `${baseUrl}/transition.js`;
        imports['svelte/animate'] = `${baseUrl}/animate.js`;
        imports['svelte/easing'] = `${baseUrl}/easing.js`;
        continue;
      }

      // Add main export for non-Svelte packages
      imports[packageName] = `${baseUrl}/index.js`;

      // Add sub-exports (for non-Svelte packages)
      const subExports = SVELTE_IMPORT_MAPPINGS[packageName];
      if (subExports) {
        for (const exportName of subExports) {
          // Replace slashes with dashes to match bundled filename
          const exportPath = exportName.replace(/\//g, '-');
          imports[`${packageName}/${exportName}`] = `${baseUrl}/${exportPath}.js`;
        }
      }
    }

    return { imports };
  }

  /**
   * Generate import map with stylesheets from package.json using R2 URLs
   */
  generateImportMapWithStylesheets(
    packageJson: any,
    options: R2ImportMapOptions
  ): ImportMapWithStylesheets {
    const { imports } = this.generateImportMapWithR2Urls(packageJson, options);
    const stylesheets: Record<string, string> = {};
    const { r2PublicUrl, r2BasePath } = options;

    // Get all dependencies
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check if Tailwind is used
    if (deps.tailwindcss) {
      stylesheets['tailwindcss'] = r2BasePath
        ? `${r2PublicUrl}/${r2BasePath}/theme.css`
        : `${r2PublicUrl}/theme.css`;
    }

    return { imports, stylesheets };
  }

  /**
   * Get list of dependencies that need to be bundled
   */
  getDependenciesToBundle(packageJson: any): Array<{ name: string; version: string }> {
    const deps: Array<{ name: string; version: string }> = [];

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    for (const [packageName, versionRange] of Object.entries(allDeps || {})) {
      // Skip dev-only packages
      if (this.isDevOnlyPackage(packageName)) continue;

      // Only include Svelte framework dependencies
      if (!SVELTE_EXTERNALS.includes(packageName)) continue;

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');
      deps.push({ name: packageName, version });
    }

    return deps;
  }
}

// Export singleton instance
const importMapGenerator = new SvelteImportMapGenerator();
export default importMapGenerator;
export { importMapGenerator };

// Export helper functions for backward compatibility
export const generateImportMapFromPackageJson = (packageJson: any) =>
  importMapGenerator.generateImportMapFromPackageJson(packageJson);
export const generateImportMapWithR2Urls = (packageJson: any, options: R2ImportMapOptions) =>
  importMapGenerator.generateImportMapWithR2Urls(packageJson, options);
export const generateImportMapWithStylesheets = (packageJson: any, options: R2ImportMapOptions) =>
  importMapGenerator.generateImportMapWithStylesheets(packageJson, options);
export const getDependenciesToBundle = (packageJson: any) =>
  importMapGenerator.getDependenciesToBundle(packageJson);
