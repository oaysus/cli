/**
 * Vue Import Map Generator
 * Vue-specific implementation for generating import maps
 */

import type { IImportMapGenerator, ImportMap, ImportMapWithStylesheets, R2ImportMapOptions } from '../core/types.js';

// Vue-specific import mappings for sub-exports
const VUE_IMPORT_MAPPINGS: Record<string, string[]> = {
  'vue': [],  // Main package re-exports everything
  '@vue/runtime-dom': [],
  '@vue/runtime-core': [],
  '@vue/reactivity': [],
  '@vue/shared': []
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

class VueImportMapGenerator implements IImportMapGenerator {
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

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');

      // Use esm.sh CDN
      const baseUrl = `https://esm.sh/${packageName}@${version}`;

      // Add main export
      imports[packageName] = baseUrl;

      // Add Vue-specific sub-exports (if any)
      const subExports = VUE_IMPORT_MAPPINGS[packageName];
      if (subExports && subExports.length > 0) {
        for (const exportName of subExports) {
          imports[`${packageName}/${exportName}`] = `${baseUrl}/${exportName}`;
        }
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

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');

      // Build R2 URL for all dependencies (including Vue)
      const baseUrl = r2BasePath
        ? `${r2PublicUrl}/${r2BasePath}/deps/${packageName}@${version}`
        : `${r2PublicUrl}/deps/${packageName}@${version}`;

      // Add main export
      imports[packageName] = `${baseUrl}/index.js`;

      // Add Vue-specific sub-exports (if any)
      const subExports = VUE_IMPORT_MAPPINGS[packageName];
      if (subExports && subExports.length > 0) {
        for (const exportName of subExports) {
          imports[`${packageName}/${exportName}`] = `${baseUrl}/${exportName}.js`;
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

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');
      deps.push({ name: packageName, version });
    }

    return deps;
  }
}

// Export singleton instance
const importMapGenerator = new VueImportMapGenerator();
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
