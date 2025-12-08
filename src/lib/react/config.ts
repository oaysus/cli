/**
 * React Framework Configuration
 * React-specific externals, plugins, and build settings
 */

import type { DetectedDependency } from '../shared/import-analyzer.js';

/**
 * Base external dependencies for React (framework deps)
 * These are always externalized
 */
export const REACT_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime'
];

/**
 * Build dynamic externals list from detected dependencies
 * Includes React framework deps + all detected third-party deps
 *
 * @param detectedDeps - Dependencies detected from component imports
 * @returns Array of external specifiers to pass to Vite
 */
export function buildExternals(detectedDeps: DetectedDependency[] = []): string[] {
  const externals = new Set<string>(REACT_EXTERNALS);

  for (const dep of detectedDeps) {
    // Add main package
    externals.add(dep.name);

    // Add all detected imports (including sub-exports)
    for (const imp of dep.imports) {
      externals.add(imp);
    }
  }

  return Array.from(externals);
}

/**
 * Check if an import should be externalized
 * Used by Vite's rollup external option as a function
 *
 * @param id - Import specifier
 * @param detectedDeps - Dependencies detected from component imports
 * @returns true if the import should be externalized
 */
export function shouldExternalize(id: string, detectedDeps: DetectedDependency[] = []): boolean {
  // Always externalize React
  if (REACT_EXTERNALS.some(ext => id === ext || id.startsWith(ext + '/'))) {
    return true;
  }

  // Check if it matches any detected dependency
  for (const dep of detectedDeps) {
    if (id === dep.name || id.startsWith(dep.name + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Get React-specific Vite plugin
 * React uses esbuild native JSX instead of a React plugin
 * This produces clean production code without dev metadata
 */
export async function getReactPlugin(): Promise<any> {
  // Use esbuild native JSX - no plugin needed
  return null;
}
