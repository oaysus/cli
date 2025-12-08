/**
 * React Import Map Generator
 * React-specific implementation for generating import maps
 */

import type { IImportMapGenerator, ImportMap, ImportMapWithStylesheets, R2ImportMapOptions } from '../core/types.js';
import type { DetectedDependency } from '../shared/import-analyzer.js';

import { REACT_EXTERNALS } from './config.js';

// React-specific import mappings for sub-exports
const REACT_IMPORT_MAPPINGS: Record<string, string[]> = {
  'react': ['jsx-runtime', 'jsx-dev-runtime'],
  'react-dom': ['client']
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

class ReactImportMapGenerator implements IImportMapGenerator {
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

      // Only include React framework dependencies
      if (!REACT_EXTERNALS.includes(packageName)) {
        continue;
      }

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');

      // Use esm.sh CDN
      const baseUrl = `https://esm.sh/${packageName}@${version}`;

      // Add main export
      imports[packageName] = baseUrl;

      // Add React-specific sub-exports
      const subExports = REACT_IMPORT_MAPPINGS[packageName];
      if (subExports) {
        for (const exportName of subExports) {
          imports[`${packageName}/${exportName}`] = `${baseUrl}/${exportName}`;
        }
      }
    }

    return { imports };
  }

  /**
   * Generate import map using R2 URLs
   * Includes both React framework deps and detected external deps
   */
  generateImportMapWithR2Urls(
    packageJson: any,
    options: R2ImportMapOptions & { detectedDeps?: DetectedDependency[] }
  ): ImportMap {
    const imports: Record<string, string> = {};
    const { r2PublicUrl, r2BasePath, detectedDeps = [] } = options;

    // Get all dependencies
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Generate import map entries for React framework deps
    for (const [packageName, versionRange] of Object.entries(deps || {})) {
      // Skip dev-only packages
      if (this.isDevOnlyPackage(packageName)) {
        continue;
      }

      // Only include React framework dependencies here
      if (!REACT_EXTERNALS.includes(packageName)) {
        continue;
      }

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');

      // Build R2 URL (handle empty r2BasePath)
      const baseUrl = r2BasePath
        ? `${r2PublicUrl}/${r2BasePath}/deps/${packageName}@${version}`
        : `${r2PublicUrl}/deps/${packageName}@${version}`;

      // Add main export
      imports[packageName] = `${baseUrl}/index.js`;

      // Add React-specific sub-exports
      const subExports = REACT_IMPORT_MAPPINGS[packageName];
      if (subExports) {
        for (const exportName of subExports) {
          imports[`${packageName}/${exportName}`] = `${baseUrl}/${exportName}.js`;
        }
      }
    }

    // Generate import map entries for detected external deps
    for (const dep of detectedDeps) {
      const baseUrl = r2BasePath
        ? `${r2PublicUrl}/${r2BasePath}/deps/${dep.name}@${dep.version}`
        : `${r2PublicUrl}/deps/${dep.name}@${dep.version}`;

      // Add main export
      imports[dep.name] = `${baseUrl}/index.js`;

      // Add sub-exports (JS)
      for (const subExport of dep.subExports) {
        const fileName = subExport.replace(/\//g, '-');
        imports[`${dep.name}/${subExport}`] = `${baseUrl}/${fileName}.js`;
      }

      // Add CSS imports (converted to JS modules)
      for (const cssImport of dep.cssImports) {
        const relativePath = cssImport.slice(dep.name.length + 1); // Remove "swiper/"
        const fileName = relativePath.replace(/\//g, '-').replace(/\.css$/, '');
        imports[cssImport] = `${baseUrl}/${fileName}.js`;
      }
    }

    return { imports };
  }

  /**
   * Generate import map with stylesheets from package.json using R2 URLs
   * Includes detected external dependencies
   */
  generateImportMapWithStylesheets(
    packageJson: any,
    options: R2ImportMapOptions & { detectedDeps?: DetectedDependency[] }
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
   * Get list of React framework dependencies that need to be bundled
   * (Does not include detected deps - those are handled separately)
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

      // Only include React framework dependencies
      if (!REACT_EXTERNALS.includes(packageName)) continue;

      // Clean version
      const version = (versionRange as string).replace(/^[\^~>=<]/, '');
      deps.push({ name: packageName, version });
    }

    return deps;
  }
}

// Export singleton instance
const importMapGenerator = new ReactImportMapGenerator();
export default importMapGenerator;
export { importMapGenerator };

// Export helper functions for backward compatibility
export const generateImportMapFromPackageJson = (packageJson: any) =>
  importMapGenerator.generateImportMapFromPackageJson(packageJson);
export const generateImportMapWithR2Urls = (packageJson: any, options: R2ImportMapOptions & { detectedDeps?: DetectedDependency[] }) =>
  importMapGenerator.generateImportMapWithR2Urls(packageJson, options);
export const generateImportMapWithStylesheets = (packageJson: any, options: R2ImportMapOptions & { detectedDeps?: DetectedDependency[] }) =>
  importMapGenerator.generateImportMapWithStylesheets(packageJson, options);
export const getDependenciesToBundle = (packageJson: any) =>
  importMapGenerator.getDependenciesToBundle(packageJson);
