/**
 * Import Analyzer
 * Scans component source files to detect external dependencies
 * Used to determine which packages need to be bundled separately
 */

import fs from 'fs';
import path from 'path';

/**
 * Detected dependency with all its imports
 */
export interface DetectedDependency {
  /** Package name (e.g., "swiper") */
  name: string;
  /** Version from package.json */
  version: string;
  /** All import specifiers found (e.g., ["swiper", "swiper/react"]) */
  imports: string[];
  /** Sub-exports to bundle (e.g., ["react", "modules"]) */
  subExports: string[];
  /** Whether any CSS imports were detected */
  hasCSS: boolean;
  /** CSS import specifiers (e.g., ["swiper/css", "swiper/css/navigation"]) */
  cssImports: string[];
}

/**
 * Packages that are always externalized (framework deps)
 */
const FRAMEWORK_EXTERNALS = [
  'react',
  'react-dom',
  'vue',
  'svelte',
  'solid-js'
];

/**
 * Dev-only packages that should never be bundled
 */
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
  /^@storybook\//,
  /^storybook$/
];

/**
 * Extract all import statements from source code
 * Handles both static imports and dynamic imports
 */
function extractImports(sourceCode: string): string[] {
  const imports: string[] = [];

  // Match static imports: import ... from "package"
  const staticImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticImportRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  // Match side-effect imports: import "package"
  const sideEffectImportRegex = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectImportRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  // Match dynamic imports: import("package")
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  // Match require statements: require("package")
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Check if an import is external (not relative or absolute path)
 */
function isExternalImport(importPath: string): boolean {
  // Relative imports start with . or ..
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return false;
  }
  // Node built-ins
  if (importPath.startsWith('node:')) {
    return false;
  }
  return true;
}

/**
 * Get the package name from an import specifier
 * e.g., "swiper/react" -> "swiper"
 * e.g., "@scope/package/sub" -> "@scope/package"
 */
function getPackageName(importPath: string): string {
  if (importPath.startsWith('@')) {
    // Scoped package: @scope/package/sub -> @scope/package
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  // Regular package: package/sub -> package
  return importPath.split('/')[0];
}

/**
 * Get the sub-export path from an import specifier
 * e.g., "swiper/react" -> "react"
 * e.g., "@scope/package/sub/path" -> "sub/path"
 */
function getSubExport(importPath: string): string | null {
  const packageName = getPackageName(importPath);
  if (importPath === packageName) {
    return null; // Main export
  }
  return importPath.slice(packageName.length + 1); // Remove package name and /
}

/**
 * Check if an import is a CSS import
 */
function isCSSImport(importPath: string): boolean {
  // Direct .css extension
  if (importPath.endsWith('.css')) {
    return true;
  }
  // Known CSS-exporting paths (like swiper/css)
  const cssPatterns = [
    /\/css$/,
    /\/css\//,
    /\/styles$/,
    /\/styles\//,
    /\.scss$/,
    /\.less$/,
    /\.sass$/
  ];
  return cssPatterns.some(pattern => pattern.test(importPath));
}

/**
 * Check if a package is dev-only
 */
function isDevOnlyPackage(packageName: string): boolean {
  return DEV_ONLY_PATTERNS.some(pattern => pattern.test(packageName));
}

/**
 * Check if a package is a framework external
 */
function isFrameworkExternal(packageName: string): boolean {
  return FRAMEWORK_EXTERNALS.some(ext =>
    packageName === ext || packageName.startsWith(ext + '/')
  );
}

/**
 * Analyze component files and detect external dependencies
 *
 * @param componentPaths - Absolute paths to component entry files
 * @param packageJson - Package.json contents
 * @returns Array of detected dependencies with their imports
 */
export function analyzeComponentImports(
  componentPaths: string[],
  packageJson: any
): DetectedDependency[] {
  console.log('[ImportAnalyzer] Starting analysis of', componentPaths.length, 'components');
  const allImports = new Map<string, Set<string>>(); // packageName -> Set of full import paths

  // Get all dependencies from package.json
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies
  };
  console.log('[ImportAnalyzer] Package deps:', Object.keys(deps || {}).slice(0, 10).join(', '));

  // Read and analyze each component file
  for (const componentPath of componentPaths) {
    try {
      // Also analyze any local imports recursively (limited depth)
      const filesToAnalyze = [componentPath];
      const analyzed = new Set<string>();
      const componentDir = path.dirname(componentPath);

      while (filesToAnalyze.length > 0) {
        const filePath = filesToAnalyze.pop()!;
        if (analyzed.has(filePath)) continue;
        analyzed.add(filePath);

        // Try to read the file (handle .tsx, .ts, .jsx, .js)
        let sourceCode = '';
        const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
        for (const ext of extensions) {
          const tryPath = filePath + ext;
          if (fs.existsSync(tryPath)) {
            sourceCode = fs.readFileSync(tryPath, 'utf-8');
            break;
          }
        }

        if (!sourceCode && fs.existsSync(filePath)) {
          sourceCode = fs.readFileSync(filePath, 'utf-8');
        }

        if (!sourceCode) continue;

        // Extract imports
        const imports = extractImports(sourceCode);

        for (const importPath of imports) {
          if (isExternalImport(importPath)) {
            const packageName = getPackageName(importPath);

            // Only track if it's in our dependencies
            if (deps[packageName]) {
              if (!allImports.has(packageName)) {
                allImports.set(packageName, new Set());
              }
              allImports.get(packageName)!.add(importPath);
            }
          } else if (importPath.startsWith('.')) {
            // Local import - add to analyze queue (limited to same component)
            const resolvedPath = path.resolve(path.dirname(filePath), importPath);
            // Only follow if within the component directory
            if (resolvedPath.startsWith(componentDir) && analyzed.size < 50) {
              filesToAnalyze.push(resolvedPath);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[ImportAnalyzer] Could not analyze ${componentPath}:`, error);
    }
  }

  console.log('[ImportAnalyzer] External packages found:', Array.from(allImports.keys()).join(', ') || 'none');

  // Convert to DetectedDependency array
  const detected: DetectedDependency[] = [];

  for (const [packageName, importPaths] of allImports) {
    // Skip framework externals and dev-only packages
    if (isFrameworkExternal(packageName) || isDevOnlyPackage(packageName)) {
      continue;
    }

    // Get version from package.json
    const version = (deps[packageName] as string || '0.0.0').replace(/^[\^~>=<]/, '');

    // Categorize imports
    const imports = Array.from(importPaths);
    const cssImports = imports.filter(isCSSImport);
    const jsImports = imports.filter(imp => !isCSSImport(imp));

    // Extract sub-exports
    const subExports = new Set<string>();
    for (const imp of jsImports) {
      const sub = getSubExport(imp);
      if (sub) {
        subExports.add(sub);
      }
    }

    detected.push({
      name: packageName,
      version,
      imports,
      subExports: Array.from(subExports),
      hasCSS: cssImports.length > 0,
      cssImports
    });
  }

  return detected;
}

/**
 * Merge detected dependencies with existing dependencies list
 * Used to combine framework deps (React) with detected deps (Swiper)
 */
export function mergeWithFrameworkDeps(
  frameworkDeps: Array<{ name: string; version: string }>,
  detectedDeps: DetectedDependency[]
): Array<{ name: string; version: string; subExports?: string[]; cssImports?: string[] }> {
  const result: Array<{ name: string; version: string; subExports?: string[]; cssImports?: string[] }> = [];

  // Add framework deps first
  for (const dep of frameworkDeps) {
    result.push({ name: dep.name, version: dep.version });
  }

  // Add detected deps
  for (const dep of detectedDeps) {
    result.push({
      name: dep.name,
      version: dep.version,
      subExports: dep.subExports.length > 0 ? dep.subExports : undefined,
      cssImports: dep.cssImports.length > 0 ? dep.cssImports : undefined
    });
  }

  return result;
}

export default {
  analyzeComponentImports,
  mergeWithFrameworkDeps
};
