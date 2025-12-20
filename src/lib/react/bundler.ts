/**
 * React Dependency Bundler
 * React-specific implementation for bundling dependencies
 */

import { build } from 'vite';
import * as path from 'path';
import * as fs from 'fs';
import type { IBundler, BundledDependency, BundleDependencyOptions, FrameworkExportConfig } from '../core/types.js';
import type { DetectedDependency } from '../shared/import-analyzer.js';

// React-specific export configurations
const REACT_EXPORT_CONFIG: Record<string, FrameworkExportConfig> = {
  'react': {
    exports: ['jsx-runtime', 'jsx-dev-runtime']
  },
  'react-dom': {
    exports: ['client'],
    externals: ['react']
  }
};

// Explicit named exports for sub-exports
const EXPLICIT_NAMED_EXPORTS: Record<string, Record<string, string[]>> = {
  'react': {
    'jsx-runtime': ['jsx', 'jsxs', 'Fragment'],
    'jsx-dev-runtime': ['jsx', 'jsxs', 'jsxDEV', 'Fragment'],
    // Main bundle exports
    '': ['createElement', 'createContext', 'forwardRef', 'useCallback', 'useContext', 'useDebugValue', 'useDeferredValue', 'useEffect', 'useId', 'useImperativeHandle', 'useInsertionEffect', 'useLayoutEffect', 'useMemo', 'useOptimistic', 'useReducer', 'useRef', 'useState', 'useSyncExternalStore', 'useTransition', 'use', 'Fragment', 'Profiler', 'StrictMode', 'Suspense', 'Children', 'Component', 'PureComponent', 'createRef', 'isValidElement', 'memo', 'lazy', 'startTransition', 'unstable_Activity', 'cache', 'version']
  },
  'react-dom': {
    'client': ['createRoot', 'hydrateRoot'],
    // Main bundle exports
    '': ['createPortal', 'flushSync', 'prefetchDNS', 'preconnect', 'preload', 'preloadModule', 'preinit', 'preinitModule', 'version']
  }
};

class ReactBundler implements IBundler {
  /**
   * Get exports configuration for a React package
   */
  private getExportsConfig(packageName: string): FrameworkExportConfig | undefined {
    return REACT_EXPORT_CONFIG[packageName];
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
   * Bundle a sub-export (e.g., react/jsx-runtime, react-dom/client)
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

    // Check if we need explicit named exports
    const explicitExports = EXPLICIT_NAMED_EXPORTS[packageName]?.[exportName];

    let entryContent: string;
    if (explicitExports && explicitExports.length > 0) {
      const imports = explicitExports.join(', ');
      entryContent = `import { ${imports} } from '${packageName}/${exportName}';\nexport { ${imports} };`;
    } else {
      entryContent = `export * from '${packageName}/${exportName}';`;
    }

    fs.writeFileSync(exportEntry, entryContent);

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

      return this.readBundleFile(tempDir, outDir, exportName.replace(/\//g, '-'));
    } catch (err) {
      console.warn(`[ReactBundler] Could not bundle ${packageName}/${exportName}: ${err}`);
      return null;
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

      // Get React-specific config
      const config = this.getExportsConfig(packageName);
      const externals = config?.externals || [];

      // Build main bundle
      const mainEntry = path.join(tempDir, 'main-entry.js');

      // Check if we need explicit named exports for the main bundle
      const explicitExports = EXPLICIT_NAMED_EXPORTS[packageName]?.[''];

      let entryContent: string;
      if (explicitExports && explicitExports.length > 0) {
        const imports = explicitExports.join(', ');
        entryContent = `import { ${imports} } from '${packageName}';\nimport * as _pkg from '${packageName}';\nexport { ${imports} };\nexport default _pkg;`;
      } else {
        entryContent = `import * as _pkg from '${packageName}';\nexport * from '${packageName}';\nexport default _pkg;`;
      }

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
        console.warn(`[ReactBundler] Could not find main bundle for ${packageName}`);
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
          // Use dashes in filename to match bundler output (e.g., jsx-runtime.js)
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
      // console.log(`Bundling ${dep.name}@${dep.version}...`);
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
   * Bundle framework dependencies for server-side rendering (Node.js)
   * Creates node_modules structure that can be downloaded and used by Express
   */
  async bundleServerDependencies(
    dependencies: Array<{ name: string; version: string }>,
    options: BundleDependencyOptions
  ): Promise<{ depKey: string; path: string; size: number }[]> {
    const { projectRoot, outputDir } = options;
    const results: { depKey: string; path: string; size: number }[] = [];

    // Group react and react-dom together since they share the same version
    const reactDep = dependencies.find(d => d.name === 'react');
    const reactDomDep = dependencies.find(d => d.name === 'react-dom');

    if (!reactDep) {
      console.warn('[ReactBundler] No React dependency found for server bundling');
      return results;
    }

    const version = reactDep.version;
    const depKey = `react@${version}`;
    const serverDepsDir = path.join(outputDir!, 'server-deps', depKey, 'node_modules');

    // Create directory structure
    const reactDir = path.join(serverDepsDir, 'react');
    const reactDomDir = path.join(serverDepsDir, 'react-dom');

    fs.mkdirSync(reactDir, { recursive: true });
    fs.mkdirSync(reactDomDir, { recursive: true });

    const tempDir = path.join(projectRoot, '.oaysus-temp', 'server-deps');
    fs.mkdirSync(tempDir, { recursive: true });

    let totalSize = 0;

    try {
      // Bundle React core for Node.js
      // IMPORTANT: Include both named exports AND a default export
      // because react-dom/server may import React with a default import
      const reactEntry = path.join(tempDir, 'react-entry.js');
      const reactExports = EXPLICIT_NAMED_EXPORTS['react'][''];
      fs.writeFileSync(reactEntry, `import * as React from 'react';\nimport { ${reactExports.join(', ')} } from 'react';\nexport { ${reactExports.join(', ')} };\nexport default React;`);

      await build({
        root: projectRoot,
        logLevel: 'silent',
        build: {
          lib: { entry: reactEntry, formats: ['es'], fileName: 'index' },
          outDir: path.join(tempDir, 'react-dist'),
          emptyOutDir: true,
          minify: false, // Keep readable for debugging
          target: 'node18',
          rollupOptions: { external: [] }
        },
        define: { 'process.env.NODE_ENV': '"production"' }
      });

      // Copy to node_modules structure
      const reactBundle = this.readBundleFile(tempDir, 'react-dist', 'index');
      if (reactBundle) {
        fs.writeFileSync(path.join(reactDir, 'index.js'), reactBundle);
        totalSize += Buffer.byteLength(reactBundle, 'utf8');
      }

      // Bundle React JSX runtime
      const jsxEntry = path.join(tempDir, 'jsx-entry.js');
      const jsxExports = EXPLICIT_NAMED_EXPORTS['react']['jsx-runtime'];
      fs.writeFileSync(jsxEntry, `import { ${jsxExports.join(', ')} } from 'react/jsx-runtime';\nexport { ${jsxExports.join(', ')} };`);

      await build({
        root: projectRoot,
        logLevel: 'silent',
        build: {
          lib: { entry: jsxEntry, formats: ['es'], fileName: 'jsx-runtime' },
          outDir: path.join(tempDir, 'jsx-dist'),
          emptyOutDir: true,
          minify: false,
          target: 'node18',
          rollupOptions: { external: ['react'] }
        },
        define: { 'process.env.NODE_ENV': '"production"' }
      });

      const jsxBundle = this.readBundleFile(tempDir, 'jsx-dist', 'jsx-runtime');
      if (jsxBundle) {
        fs.writeFileSync(path.join(reactDir, 'jsx-runtime.js'), jsxBundle);
        totalSize += Buffer.byteLength(jsxBundle, 'utf8');
      }

      // Bundle React DOM server (for renderToString)
      if (reactDomDep) {
        const serverEntry = path.join(tempDir, 'server-entry.js');
        fs.writeFileSync(serverEntry, `export { renderToString, renderToStaticMarkup } from 'react-dom/server';`);

        await build({
          root: projectRoot,
          logLevel: 'silent',
          build: {
            lib: { entry: serverEntry, formats: ['es'], fileName: 'server' },
            outDir: path.join(tempDir, 'server-dist'),
            emptyOutDir: true,
            minify: false,
            target: 'node18',
            rollupOptions: { external: ['react'] }
          },
          define: { 'process.env.NODE_ENV': '"production"' }
        });

        const serverBundle = this.readBundleFile(tempDir, 'server-dist', 'server');
        if (serverBundle) {
          fs.writeFileSync(path.join(reactDomDir, 'server.js'), serverBundle);
          totalSize += Buffer.byteLength(serverBundle, 'utf8');
        }

        // Bundle React DOM client (for hydrateRoot - completeness)
        const clientEntry = path.join(tempDir, 'client-entry.js');
        fs.writeFileSync(clientEntry, `export { createRoot, hydrateRoot } from 'react-dom/client';`);

        await build({
          root: projectRoot,
          logLevel: 'silent',
          build: {
            lib: { entry: clientEntry, formats: ['es'], fileName: 'client' },
            outDir: path.join(tempDir, 'client-dist'),
            emptyOutDir: true,
            minify: false,
            target: 'node18',
            rollupOptions: { external: ['react'] }
          },
          define: { 'process.env.NODE_ENV': '"production"' }
        });

        const clientBundle = this.readBundleFile(tempDir, 'client-dist', 'client');
        if (clientBundle) {
          fs.writeFileSync(path.join(reactDomDir, 'client.js'), clientBundle);
          totalSize += Buffer.byteLength(clientBundle, 'utf8');
        }

        // React DOM main index
        const domEntry = path.join(tempDir, 'dom-entry.js');
        fs.writeFileSync(domEntry, `export { createPortal, flushSync } from 'react-dom';`);

        await build({
          root: projectRoot,
          logLevel: 'silent',
          build: {
            lib: { entry: domEntry, formats: ['es'], fileName: 'index' },
            outDir: path.join(tempDir, 'dom-dist'),
            emptyOutDir: true,
            minify: false,
            target: 'node18',
            rollupOptions: { external: ['react'] }
          },
          define: { 'process.env.NODE_ENV': '"production"' }
        });

        const domBundle = this.readBundleFile(tempDir, 'dom-dist', 'index');
        if (domBundle) {
          fs.writeFileSync(path.join(reactDomDir, 'index.js'), domBundle);
          totalSize += Buffer.byteLength(domBundle, 'utf8');
        }
      }

      // Create package.json files for Node.js module resolution
      const reactPkg = {
        name: 'react',
        version: version,
        main: 'index.js',
        module: 'index.js',
        type: 'module',
        exports: {
          '.': './index.js',
          './jsx-runtime': './jsx-runtime.js',
          './jsx-dev-runtime': './jsx-runtime.js'
        }
      };
      fs.writeFileSync(path.join(reactDir, 'package.json'), JSON.stringify(reactPkg, null, 2));

      if (reactDomDep) {
        const reactDomPkg = {
          name: 'react-dom',
          version: reactDomDep.version,
          main: 'index.js',
          module: 'index.js',
          type: 'module',
          exports: {
            '.': './index.js',
            './server': './server.js',
            './client': './client.js'
          }
        };
        fs.writeFileSync(path.join(reactDomDir, 'package.json'), JSON.stringify(reactDomPkg, null, 2));
      }

      results.push({
        depKey,
        path: serverDepsDir,
        size: totalSize
      });

    } finally {
      // Cleanup temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

    return results;
  }

  /**
   * Bundle detected external dependencies (non-React libraries)
   * Creates ESM bundles for JS and CSS wrapper modules
   */
  async bundleDetectedDependencies(
    detectedDeps: DetectedDependency[],
    options: BundleDependencyOptions
  ): Promise<BundledDependency[]> {
    const results: BundledDependency[] = [];

    for (const dep of detectedDeps) {
      // console.log(`Bundling ${dep.name}@${dep.version}...`);
      const bundled = await this.bundleExternalDependency(dep, options);
      results.push(bundled);
    }

    return results;
  }

  /**
   * Bundle a single external dependency with all its sub-exports and CSS
   */
  private async bundleExternalDependency(
    dep: DetectedDependency,
    options: BundleDependencyOptions
  ): Promise<BundledDependency> {
    const { projectRoot, outputDir } = options;
    const tempDir = path.join(projectRoot, '.oaysus-temp', `${dep.name}@${dep.version}`);
    const depDir = path.join(outputDir!, `${dep.name}@${dep.version}`);

    const result: BundledDependency = {
      name: dep.name,
      version: dep.version,
      mainBundle: '',
      additionalExports: {}
    };

    try {
      fs.mkdirSync(tempDir, { recursive: true });
      fs.mkdirSync(depDir, { recursive: true });

      // Bundle main package
      const mainBundle = await this.bundlePackageExport(dep.name, '', tempDir, projectRoot);
      if (mainBundle) {
        result.mainBundle = mainBundle;
        fs.writeFileSync(path.join(depDir, 'index.js'), mainBundle);
      }

      // Bundle sub-exports (JS)
      for (const subExport of dep.subExports) {
        const subBundle = await this.bundlePackageExport(dep.name, subExport, tempDir, projectRoot);
        if (subBundle) {
          result.additionalExports![subExport] = subBundle;
          // Create directory structure for nested exports
          const exportPath = path.join(depDir, `${subExport.replace(/\//g, '-')}.js`);
          fs.writeFileSync(exportPath, subBundle);
        }
      }

      // Bundle CSS imports as JS modules that inject styles
      for (const cssImport of dep.cssImports) {
        const cssBundle = await this.bundleCSSAsModule(cssImport, tempDir, projectRoot);
        if (cssBundle) {
          // Get the path relative to package (e.g., "swiper/css" -> "css")
          const relativePath = cssImport.slice(dep.name.length + 1); // Remove "swiper/"
          const fileName = relativePath.replace(/\//g, '-').replace(/\.css$/, '') + '.js';
          result.additionalExports![relativePath] = cssBundle;
          fs.writeFileSync(path.join(depDir, fileName), cssBundle);
        }
      }

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return result;
    } catch (error) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      console.error(`Failed to bundle ${dep.name}@${dep.version}:`, error);
      throw error;
    }
  }

  /**
   * Bundle a package export (main or sub-export)
   */
  private async bundlePackageExport(
    packageName: string,
    exportPath: string,
    tempDir: string,
    projectRoot: string
  ): Promise<string | null> {
    const fullImport = exportPath ? `${packageName}/${exportPath}` : packageName;
    const entryFile = path.join(tempDir, `entry-${exportPath.replace(/\//g, '-') || 'main'}.js`);
    const outDir = path.join(tempDir, `dist-${exportPath.replace(/\//g, '-') || 'main'}`);

    // Create entry file - only use named exports, don't assume default export exists
    fs.writeFileSync(entryFile, `export * from '${fullImport}';`);

    try {
      await build({
        root: projectRoot,
        logLevel: 'silent',
        build: {
          lib: {
            entry: entryFile,
            formats: ['es'],
            fileName: 'index'
          },
          outDir,
          emptyOutDir: true,
          minify: true,
          rollupOptions: {
            external: (id) => {
              // Externalize React and other framework deps
              if (id === 'react' || id.startsWith('react/') ||
                  id === 'react-dom' || id.startsWith('react-dom/')) {
                return true;
              }
              return false;
            }
          }
        },
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      });

      // Read the bundle
      const bundlePath = path.join(outDir, 'index.es.js');
      const altPath = path.join(outDir, 'index.js');
      const msjPath = path.join(outDir, 'index.mjs');

      for (const p of [bundlePath, altPath, msjPath]) {
        if (fs.existsSync(p)) {
          return fs.readFileSync(p, 'utf-8');
        }
      }

      return null;
    } catch (err) {
      console.warn(`[ReactBundler] Could not bundle ${fullImport}: ${err}`);
      return null;
    }
  }

  /**
   * Bundle a CSS import as a JS module that injects styles
   */
  private async bundleCSSAsModule(
    cssImport: string,
    tempDir: string,
    projectRoot: string
  ): Promise<string | null> {
    try {
      // Try to resolve the CSS file from node_modules
      const nodeModulesPath = path.join(projectRoot, 'node_modules', cssImport);
      let cssContent = '';

      // Handle various CSS paths
      const possiblePaths = [
        nodeModulesPath,
        nodeModulesPath + '.css',
        path.join(nodeModulesPath, 'index.css'),
        // For paths like "swiper/css" try "swiper/swiper.css"
        path.join(projectRoot, 'node_modules', cssImport.replace(/\/css$/, '/swiper.css')),
        // Try package.json style field
        path.join(projectRoot, 'node_modules', cssImport.split('/')[0], 'swiper-bundle.css')
      ];

      for (const cssPath of possiblePaths) {
        if (fs.existsSync(cssPath) && fs.statSync(cssPath).isFile()) {
          cssContent = fs.readFileSync(cssPath, 'utf-8');
          break;
        }
      }

      // If still not found, try to use Vite to build and extract CSS
      if (!cssContent) {
        const entryFile = path.join(tempDir, 'css-entry.js');
        const outDir = path.join(tempDir, 'css-dist');

        fs.writeFileSync(entryFile, `import '${cssImport}';`);

        try {
          await build({
            root: projectRoot,
            logLevel: 'silent',
            build: {
              lib: {
                entry: entryFile,
                formats: ['es'],
                fileName: 'css'
              },
              outDir,
              emptyOutDir: true,
              cssCodeSplit: false
            }
          });

          // Look for extracted CSS
          const files = fs.readdirSync(outDir);
          const cssFile = files.find(f => f.endsWith('.css'));
          if (cssFile) {
            cssContent = fs.readFileSync(path.join(outDir, cssFile), 'utf-8');
          }
        } catch (err) {
          console.warn(`[ReactBundler] Could not extract CSS for ${cssImport}`);
        }
      }

      if (!cssContent) {
        console.warn(`[ReactBundler] No CSS content found for ${cssImport}`);
        return null;
      }

      // Create a JS module that injects the CSS
      const escapedCSS = JSON.stringify(cssContent);
      const jsModule = `// CSS Module: ${cssImport}
const css = ${escapedCSS};
if (typeof document !== 'undefined') {
  const id = 'oaysus-css-${cssImport.replace(/[^a-zA-Z0-9]/g, '-')}';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }
}
export default css;
`;
      return jsModule;
    } catch (error) {
      console.warn(`[ReactBundler] Failed to bundle CSS ${cssImport}:`, error);
      return null;
    }
  }
}

// Export singleton instance
const bundler = new ReactBundler();
export default bundler;
export { bundler };

// Export individual functions for backward compatibility
export const bundleDependencies = bundler.bundleDependencies.bind(bundler);
export const filterRuntimeDependencies = bundler.filterRuntimeDependencies.bind(bundler);
export const getBundleSize = bundler.getBundleSize.bind(bundler);
export const formatBundleSize = bundler.formatBundleSize.bind(bundler);
export const bundleServerDependencies = bundler.bundleServerDependencies.bind(bundler);
export const bundleDetectedDependencies = bundler.bundleDetectedDependencies.bind(bundler);
