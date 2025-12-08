/**
 * Svelte Framework Configuration
 * Svelte-specific externals, plugins, and build settings
 */

/**
 * External dependencies for Svelte
 * These are not bundled - expected to be provided by the runtime environment
 * Matches the bundled outputs from bundler.ts (6-7 optimized files)
 *
 * Note: The builder uses a function-based external configuration to handle
 * ALL svelte/* paths dynamically. This list is for reference.
 */
export const SVELTE_EXTERNALS = [
  'svelte',
  'svelte/internal/client',
  'svelte/store',
  'svelte/transition',
  'svelte/motion',
  'svelte/animate',
  'svelte/easing'
];

/**
 * Get Svelte-specific Vite plugin for client builds
 */
export async function getSveltePlugin(): Promise<any> {
  try {
    const { svelte } = await import('@sveltejs/vite-plugin-svelte');
    return svelte({
      compilerOptions: {
        dev: false,
        runes: true,
        customElement: false  // Not web components
      },
      emitCss: true  // Ensure CSS is emitted
    });
  } catch (error) {
    console.warn('Failed to load Svelte plugin:', error);
    return null;
  }
}

/**
 * Get Svelte-specific Vite plugin for server-side rendering builds
 */
export async function getSvelteSSRPlugin(): Promise<any> {
  try {
    const { svelte } = await import('@sveltejs/vite-plugin-svelte');
    return svelte({
      compilerOptions: {
        // @ts-expect-error - generate option is valid for SSR but not in type definitions
        generate: 'ssr',     // Server-side rendering mode
        hydratable: true,    // Enable client-side hydration support
        dev: false,
        runes: true,
        customElement: false
      },
      emitCss: true  // Ensure CSS is emitted for SSR
    });
  } catch (error) {
    console.warn('Failed to load Svelte SSR plugin:', error);
    return null;
  }
}
