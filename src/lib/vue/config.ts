/**
 * Vue Framework Configuration
 * Vue-specific externals, plugins, and build settings
 */

/**
 * External dependencies for Vue
 * These are not bundled - expected to be provided by the runtime environment
 */
export const VUE_EXTERNALS = [
  'vue'
];

/**
 * Get Vue-specific Vite plugin for client builds
 */
export async function getVuePlugin(): Promise<any> {
  try {
    const { default: vue } = await import('@vitejs/plugin-vue');
    return vue({
      isProduction: true
    });
  } catch (error) {
    console.warn('Failed to load Vue plugin:', error);
    return null;
  }
}

/**
 * Get Vue-specific Vite plugin for server-side rendering builds
 */
export async function getVueSSRPlugin(): Promise<any> {
  try {
    const { default: vue } = await import('@vitejs/plugin-vue');
    return vue({
      isProduction: true
    });
  } catch (error) {
    console.warn('Failed to load Vue SSR plugin:', error);
    return null;
  }
}
