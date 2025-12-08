/**
 * Framework Registry
 * Dynamic framework implementation loader
 * Provides factory functions for getting framework-specific implementations
 */

import type { Framework, IBuilder, IBundler, IImportMapGenerator } from './types.js';

/**
 * Get framework-specific builder
 * Dynamically imports the appropriate builder for the framework
 */
export async function getBuilder(framework: Framework): Promise<IBuilder> {
  try {
    const module = await import(`../${framework}/builder.js`);
    return module.default || module.builder;
  } catch (error) {
    throw new Error(`Failed to load builder for framework "${framework}": ${error}`);
  }
}

/**
 * Get framework-specific dependency bundler
 * Dynamically imports the appropriate bundler for the framework
 */
export async function getBundler(framework: Framework): Promise<IBundler> {
  try {
    const module = await import(`../${framework}/bundler.js`);
    return module.default || module.bundler;
  } catch (error) {
    throw new Error(`Failed to load bundler for framework "${framework}": ${error}`);
  }
}

/**
 * Get framework-specific import map generator
 * Dynamically imports the appropriate import map generator for the framework
 */
export async function getImportMapGenerator(framework: Framework): Promise<IImportMapGenerator> {
  try {
    const module = await import(`../${framework}/import-map.js`);
    return module.default || module.importMapGenerator;
  } catch (error) {
    throw new Error(`Failed to load import map generator for framework "${framework}": ${error}`);
  }
}

/**
 * Detect framework from package.json
 * Returns the framework type based on dependencies
 */
export function detectFramework(packageJson: any): Framework {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  if (allDeps.react) return 'react';
  if (allDeps.svelte) return 'svelte';
  if (allDeps.vue) return 'vue';
  if (allDeps['solid-js']) return 'solid';
  if (allDeps.preact) return 'preact';

  // Default to react if no framework detected
  return 'react';
}
