/**
 * Svelte Dependency Bundler
 * Svelte-specific implementation for bundling dependencies
 */

import { build } from 'vite';
import * as path from 'path';
import * as fs from 'fs';
import type { IBundler, BundledDependency, BundleDependencyOptions, FrameworkExportConfig } from '../core/types.js';

// Svelte 5 has additional exports compared to Svelte 4
// Sub-exports are bundled with no externals, making them self-contained
// Svelte 5 also requires nested internal paths for proper functionality
const SVELTE_4_EXPORTS = ['internal', 'store', 'motion', 'transition', 'animate', 'easing'];
const SVELTE_5_EXPORTS = [
  'internal',
  'store',
  'motion',
  'transition',
  'animate',
  'easing',
  'legacy',
  'internal/client',
  'internal/server',
  'internal/disclose-version',
  'internal/flags/legacy'
];

// Svelte-specific export configurations
const SVELTE_EXPORT_CONFIG: Record<string, FrameworkExportConfig> = {
  'svelte': {
    exports: SVELTE_4_EXPORTS // Default to v4, will be updated based on version
  }
};

class SvelteBundler implements IBundler {
  /**
   * Get Svelte major version from version string
   */
  private getSvelteMajorVersion(version: string): number {
    const match = version.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 4;
  }

  /**
   * Get exports configuration for a Svelte package
   */
  private getExportsConfig(packageName: string, version: string): FrameworkExportConfig | undefined {
    const config = SVELTE_EXPORT_CONFIG[packageName];
    if (!config) return undefined;

    // Handle Svelte version differences
    if (packageName === 'svelte' && this.getSvelteMajorVersion(version) >= 5) {
      return { ...config, exports: SVELTE_5_EXPORTS };
    }

    return config;
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
   * Bundle a sub-export (e.g., svelte/store, svelte/motion)
   */
  private async bundleSubExport(
    packageName: string,
    exportName: string,
    tempDir: string,
    projectRoot: string,
    externals: string[]
  ): Promise<string | null> {
    const exportEntry = path.join(tempDir, `${exportName}-entry.js`);
    const outDir = `dist-${exportName.replace(/\//g, '-')}`;

    // Create parent directory if it doesn't exist (for nested paths like internal/disclose-version)
    const entryDir = path.dirname(exportEntry);
    if (!fs.existsSync(entryDir)) {
      fs.mkdirSync(entryDir, { recursive: true });
    }

    // Default: use export *
    const entryContent = `export * from '${packageName}/${exportName}';`;

    fs.writeFileSync(exportEntry, entryContent);

    // Bundle Svelte sub-exports but keep main 'svelte' as external to share runtime state
    // Svelte's internal modules need to share state with the main package
    const externalDeps = packageName === 'svelte'
      ? ['svelte'] // Make sub-exports depend on main svelte package
      : externals;

    try {
      await build({
        root: projectRoot,
        logLevel: 'silent',
        build: {
          lib: {
            entry: exportEntry,
            formats: ['es'],
            fileName: exportName.replace(/\//g, '-')
          },
          outDir: path.join(tempDir, outDir),
          emptyOutDir: true,
          minify: false, // Disabled for Svelte to preserve internal structure
          rollupOptions: {
            external: externalDeps,
            output: {
              globals: externalDeps.reduce((acc, ext) => ({ ...acc, [ext]: ext }), {})
            }
          }
        },
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      });

      return this.readBundleFile(tempDir, outDir, exportName.replace(/\//g, '-'));
    } catch (err) {
      console.warn(`[SvelteBundler] Could not bundle ${packageName}/${exportName}: ${err}`);
      return null;
    }
  }

  /**
   * Bundle Svelte runtime into a SINGLE unified bundle
   * Svelte 5 requires shared module state for DOM prototype getters.
   * All exports come from one bundle to ensure prototypes are initialized once.
   */
  private async bundleSvelteRuntime(
    version: string,
    options: BundleDependencyOptions
  ): Promise<BundledDependency> {
    const { projectRoot, outputDir } = options;
    const depDir = path.join(outputDir!, `svelte@${version}`);
    const tempDir = path.join(projectRoot, '.oaysus-temp', `svelte@${version}`);

    const result: BundledDependency = {
      name: 'svelte',
      version,
      mainBundle: '',
      additionalExports: {}
    };

    try {
      fs.mkdirSync(tempDir, { recursive: true });
      fs.mkdirSync(depDir, { recursive: true });

      // Create a unified entry that exports EVERYTHING from all Svelte modules
      // This ensures DOM prototype getters are initialized once and shared
      const unifiedEntryFile = path.join(tempDir, 'unified-entry.js');
      const unifiedEntryContent = `
// Main svelte exports
export * from 'svelte';
import * as _svelte from 'svelte';
export default _svelte;

// Re-export internal/client as named exports
import * as _internalClient from 'svelte/internal/client';
export const internal_client = _internalClient;

// Re-export internal/disclose-version
import * as _discloseVersion from 'svelte/internal/disclose-version';
export const internal_disclose_version = _discloseVersion;

// Re-export store
import * as _store from 'svelte/store';
export const store = _store;

// Re-export transition
import * as _transition from 'svelte/transition';
export const transition = _transition;

// Re-export motion
import * as _motion from 'svelte/motion';
export const motion = _motion;

// Re-export animate
import * as _animate from 'svelte/animate';
export const animate = _animate;

// Re-export easing
import * as _easing from 'svelte/easing';
export const easing = _easing;
`;
      fs.writeFileSync(unifiedEntryFile, unifiedEntryContent);

      console.log('  Bundling unified Svelte runtime...');

      await build({
        root: projectRoot,
        logLevel: 'silent',
        resolve: {
          conditions: ['browser', 'production', 'import', 'default']
        },
        build: {
          lib: {
            entry: unifiedEntryFile,
            formats: ['es'],
            fileName: 'svelte-unified'
          },
          outDir: path.join(tempDir, 'dist'),
          emptyOutDir: true,
          minify: 'terser',
          rollupOptions: {
            external: [],
            output: {
              format: 'es',
              entryFileNames: 'svelte-unified.js'
            }
          }
        },
        define: {
          'process.env.NODE_ENV': '"production"',
          'DEV': 'false',
          'BROWSER': 'true'
        }
      });

      // Read the unified bundle
      const unifiedBundlePath = path.join(tempDir, 'dist', 'svelte-unified.js');
      if (fs.existsSync(unifiedBundlePath)) {
        let unifiedContent = fs.readFileSync(unifiedBundlePath, 'utf-8');

        // CRITICAL: Svelte 5 requires init_operations() to be called before any DOM operations
        // The DOM prototype getters (first_child_getter, next_sibling_getter) must be initialized
        // before compiled components import from svelte/internal/client
        // We inject this call at the end of the module to ensure all exports are available first
        if (unifiedContent.includes('function init_operations()')) {
          // Find if there's already an init_operations call at module scope
          // If not, add one. This initializes the DOM getters when the module loads.
          const hasModuleScopeInit = /^init_operations\(\);$/m.test(unifiedContent);
          if (!hasModuleScopeInit) {
            // Add init_operations call before the export statement
            unifiedContent = unifiedContent.replace(
              /^(export\s*\{)/m,
              '// Initialize DOM prototype getters at module load time\n// This is required for Svelte 5 components that use from_html() at import time\nif (typeof window !== "undefined") { init_operations(); }\n\n$1'
            );
            console.log('  ℹ️  Injected init_operations() call at module scope');
          }
        }

        result.mainBundle = unifiedContent;

        // Write the unified bundle
        fs.writeFileSync(path.join(depDir, 'svelte-unified.js'), unifiedContent);

        // Create re-export shims for each sub-module that import from the unified bundle
        // This allows import maps to work while keeping everything in one bundle
        const shims = [
          {
            name: 'index.js',
            content: `export * from './svelte-unified.js';\nimport _default from './svelte-unified.js';\nexport default _default;`
          },
          {
            name: 'internal-client.js',
            // Re-export ALL internal client functions from the namespace
            // These are used by compiled Svelte components
            content: `import { internal_client as $ } from './svelte-unified.js';
// Re-export all internal client functions
// Using Object.assign to export all properties dynamically
const _exports = {};
for (const key of Object.keys($)) {
  _exports[key] = $[key];
}
export const {
  CLASS, FILENAME, HMR, NAMESPACE_SVG, STYLE, aborted, action, active_effect,
  add_legacy_event_listener, add_locations, add_svelte_meta, animation, append,
  append_styles, apply, assign, assign_and, assign_nullish, assign_or, async,
  async_body, async_derived, attach, attachment, attr, attribute_effect, autofocus,
  await: await_fn, bind_active_element, bind_buffered, bind_checked, bind_content_editable,
  bind_current_time, bind_element_size, bind_ended, bind_files, bind_focused, bind_group,
  bind_muted, bind_online, bind_paused, bind_playback_rate, bind_played, bind_prop,
  bind_property, bind_ready_state, bind_resize_observer, bind_seekable, bind_seeking,
  bind_select_value, bind_this, bind_value, bind_volume, bind_window_scroll, bind_window_size,
  boundary, bubble_event, check_target, child, cleanup_styles, clsx, comment, component,
  create_custom_element, create_ownership_validator, css_props, deep_read, deep_read_state,
  deferred_template_effect, delegate, derived, derived_safe_equal, document: doc,
  each, eager, effect, effect_root, effect_tracking, element, equals, event,
  exclude_from_object, fallback, first_child, flush, for_await_track_reactivity_loss,
  from_html, from_mathml, from_svg, from_tree, get, head, hmr, html, hydrate_template,
  if: if_fn, index, init, init_select, inspect, invalid_default_snippet, invalidate_inner_signals,
  invalidate_store, invoke_error_boundary, key, legacy_api, legacy_pre_effect,
  legacy_pre_effect_reset, legacy_rest_props, log_if_contains_state, mark_store_binding,
  mutable_source, mutate, next, noop, once, pending, pop, preventDefault,
  prevent_snippet_stringification, prop, props_id, proxy, push, raf, reactive_import,
  remove_input_defaults, remove_textarea_child, render_effect, replay_events, reset,
  rest_props, run, run_after_blockers, safe_get, sanitize_slots, save, select_option,
  self, set, set_attribute, set_checked, set_class, set_custom_element_data,
  set_default_checked, set_default_value, set_selected, set_style, set_text, set_value,
  set_xlink_attribute, setup_stores, sibling, slot, snapshot, snippet, spread_props,
  state, stopImmediatePropagation, stopPropagation, store_get, store_mutate, store_set,
  store_unsub, strict_equals, tag, tag_proxy, template_effect, text, tick, to_array,
  trace, track_reactivity_loss, transition, trusted, untrack, update, update_legacy_props,
  update_pre, update_pre_prop, update_pre_store, update_prop, update_store, user_effect,
  user_pre_effect, validate_binding, validate_dynamic_element_tag, validate_each_keys,
  validate_snippet_args, validate_store, validate_void_dynamic_element, window: win, with_script, wrap_snippet
} = $;
// Handle reserved words with aliases
export { await_fn as await, if_fn as if, doc as document, win as window };`
          },
          {
            name: 'internal-disclose-version.js',
            content: `import { internal_disclose_version } from './svelte-unified.js';\nexport const BROWSER = internal_disclose_version.BROWSER;\nexport default internal_disclose_version;`
          },
          {
            name: 'store.js',
            content: `import { store } from './svelte-unified.js';\nexport const { writable, readable, derived, get } = store;`
          },
          {
            name: 'transition.js',
            content: `import { transition } from './svelte-unified.js';\nexport const { fade, blur, fly, slide, scale, draw, crossfade } = transition;`
          },
          {
            name: 'motion.js',
            content: `import { motion } from './svelte-unified.js';\nexport const { tweened, spring } = motion;`
          },
          {
            name: 'animate.js',
            content: `import { animate } from './svelte-unified.js';\nexport const { flip } = animate;`
          },
          {
            name: 'easing.js',
            content: `import { easing } from './svelte-unified.js';\nexport const { linear, backIn, backOut, backInOut, bounceIn, bounceOut, bounceInOut, circIn, circOut, circInOut, cubicIn, cubicOut, cubicInOut, elasticIn, elasticOut, elasticInOut, expoIn, expoOut, expoInOut, quadIn, quadOut, quadInOut, quartIn, quartOut, quartInOut, quintIn, quintOut, quintInOut, sineIn, sineOut, sineInOut } = easing;`
          }
        ];

        for (const shim of shims) {
          fs.writeFileSync(path.join(depDir, shim.name), shim.content);
          result.additionalExports![shim.name.replace('.js', '')] = shim.content;
        }

        console.log(`  ✅ Unified bundle: ${(unifiedContent.length / 1024).toFixed(2)} KB`);
      }

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return result;
    } catch (error) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      console.error(`Failed to bundle svelte@${version}:`, error);
      throw error;
    }
  }

  /**
   * Bundle a single dependency
   */
  private async bundleSingleDependency(
    packageName: string,
    version: string,
    options: BundleDependencyOptions
  ): Promise<BundledDependency> {
    // Special handling for Svelte - use optimized bundling
    if (packageName === 'svelte') {
      console.log(`Bundling Svelte runtime (optimized production bundles)...`);
      return this.bundleSvelteRuntime(version, options);
    }

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

      // Get Svelte-specific config
      const config = this.getExportsConfig(packageName, version);
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
          minify: false, // Disabled for Svelte to preserve internal structure
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
        console.warn(`[SvelteBundler] Could not find main bundle for ${packageName}`);
      }

      // Bundle additional exports
      if (config?.exports && config.exports.length > 0) {
        for (const exportName of config.exports) {
          const exportBundle = await this.bundleSubExport(
            packageName,
            exportName,
            tempDir,
            projectRoot,
            externals
          );
          if (exportBundle) {
            result.additionalExports![exportName] = exportBundle;
          }
        }
      }

      // Save to output directory
      if (outputDir) {
        const depDir = path.join(outputDir, `${packageName}@${version}`);
        fs.mkdirSync(depDir, { recursive: true });
        fs.writeFileSync(path.join(depDir, 'index.js'), result.mainBundle);

        for (const [exportName, content] of Object.entries(result.additionalExports || {})) {
          // Use dashes in filename to match bundler output (e.g., internal-disclose-version.js)
          const fileName = exportName.replace(/\//g, '-');
          const exportPath = path.join(depDir, `${fileName}.js`);
          fs.writeFileSync(exportPath, content);
        }
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
      // Svelte will be bundled to R2
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
   * Bundle server-side dependencies for SSR (stub for Svelte)
   * TODO: Implement Svelte SSR bundling when needed
   */
  async bundleServerDependencies(
    _dependencies: Array<{ name: string; version: string }>,
    _options: BundleDependencyOptions
  ): Promise<{ depKey: string; path: string; size: number }[]> {
    // Svelte server bundling not yet implemented
    console.log('[SvelteBundler] Server dependency bundling not yet implemented for Svelte');
    return [];
  }

  /**
   * Bundle detected external dependencies (stub for Svelte)
   * TODO: Implement when Svelte components need third-party libs
   */
  async bundleDetectedDependencies(
    _detectedDeps: import('../core/types.js').DetectedDependency[],
    _options: BundleDependencyOptions
  ): Promise<BundledDependency[]> {
    console.log('[SvelteBundler] External dependency bundling not yet implemented for Svelte');
    return [];
  }
}

// Export singleton instance
const bundler = new SvelteBundler();
export default bundler;
export { bundler };

// Export individual functions for backward compatibility
export const bundleDependencies = bundler.bundleDependencies.bind(bundler);
export const filterRuntimeDependencies = bundler.filterRuntimeDependencies.bind(bundler);
export const getBundleSize = bundler.getBundleSize.bind(bundler);
export const formatBundleSize = bundler.formatBundleSize.bind(bundler);
