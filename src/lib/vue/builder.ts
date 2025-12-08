/**
 * Vue Component Builder
 * Vue-specific implementation of the component builder
 */

import { build as viteBuild } from 'vite';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import type { ValidationResult, ComponentInfo } from '../../types/validation.js';
import type { IBuilder, ComponentBuildOutput, BuildResult } from '../core/types.js';
import { VUE_EXTERNALS, getVuePlugin } from './config.js';

class VueBuilder implements IBuilder {
  /**
   * Build a single Vue component with Vite
   */
  private async buildComponent(
    component: ComponentInfo,
    projectPath: string,
    outputDir: string,
    packageJson: any,
    getDependenciesToBundle: (packageJson: any) => Array<{ name: string; version: string }>,
    filterRuntimeDependencies: (deps: Array<{ name: string; version: string }>) => Array<{ name: string; version: string }>
  ): Promise<ComponentBuildOutput> {
    const componentOutDir = path.join(outputDir, component.name);

    // Ensure output directory exists
    if (!fs.existsSync(componentOutDir)) {
      fs.mkdirSync(componentOutDir, { recursive: true });
    }

    // Get Vue plugin
    const plugin = await getVuePlugin();
    const plugins = plugin ? [plugin] : [];

    // Get external dependencies
    const allDeps = getDependenciesToBundle(packageJson);
    const runtimeDeps = filterRuntimeDependencies(allDeps);
    const runtimeDepNames = runtimeDeps.map((d: { name: string; version: string }) => d.name);
    const external = [...VUE_EXTERNALS, ...runtimeDepNames];

    // Resolve absolute entry path
    const entryPath = path.resolve(projectPath, component.entryPoint);

    // Build with Vite in production mode
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await viteBuild({
        configFile: false,
        mode: 'production',
        logLevel: 'warn',
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
          __VUE_OPTIONS_API__: JSON.stringify(true),
          __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
        },
        build: {
          lib: {
            entry: entryPath,
            formats: ['es'],
            fileName: 'index'
          },
          rollupOptions: {
            external,
            output: {
              format: 'es',
              entryFileNames: 'index.js',
              exports: 'auto'
            }
          },
          outDir: componentOutDir,
          minify: 'terser',
          sourcemap: false,
          emptyOutDir: false,
          target: 'es2020',
          cssCodeSplit: false
        },
        plugins
      });
    } finally {
      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    }

    // Copy schema.json
    const schemaSource = path.join(component.path, 'schema.json');
    const schemaDest = path.join(componentOutDir, 'schema.json');

    if (fs.existsSync(schemaSource)) {
      fs.copyFileSync(schemaSource, schemaDest);
    }

    // Get file sizes
    const jsPath = path.join(componentOutDir, 'index.js');
    const cssPath = path.join(componentOutDir, 'style.css');

    let size = 0;
    if (fs.existsSync(jsPath)) {
      size += fs.statSync(jsPath).size;
    }

    const hasCss = fs.existsSync(cssPath);
    if (hasCss) {
      size += fs.statSync(cssPath).size;
    }

    return {
      name: component.name,
      displayName: component.displayName,
      jsPath,
      cssPath: hasCss ? cssPath : undefined,
      schemaPath: schemaDest,
      size
    };
  }

  /**
   * Build theme-level Tailwind CSS
   * Supports both Tailwind v3 and v4
   */
  async buildThemeCSS(
    projectPath: string,
    outputDir: string,
    packageJson: any
  ): Promise<{ cssPath: string; size: number } | null> {
    // Check if Tailwind is in dependencies
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (!deps.tailwindcss) {
      console.log('[VueBuilder] No Tailwind dependency found, skipping CSS build');
      return null;
    }

    // Detect Tailwind version
    const tailwindVersion = deps.tailwindcss;
    const isV4 = tailwindVersion.match(/^[\^~]?4/);

    // Check for tailwind config
    const tailwindConfigPath = path.join(projectPath, 'tailwind.config.js');
    const tailwindConfigTsPath = path.join(projectPath, 'tailwind.config.ts');
    const hasTailwindConfig = fs.existsSync(tailwindConfigPath) || fs.existsSync(tailwindConfigTsPath);

    if (!isV4 && !hasTailwindConfig) {
      console.log('[VueBuilder] No tailwind.config found, skipping CSS build');
      return null;
    }

    try {
      // Create temporary CSS entry file
      const tempCssEntry = path.join(projectPath, '.oaysus-temp-tailwind.css');

      if (isV4) {
        fs.writeFileSync(tempCssEntry, `@import "tailwindcss";\n`);
      } else {
        fs.writeFileSync(tempCssEntry, `@tailwind base;
@tailwind components;
@tailwind utilities;
`);
      }

      const themeCssPath = path.join(outputDir, 'theme.css');

      console.log(`[VueBuilder] Building Tailwind CSS (v${isV4 ? '4' : '3'})...`);

      // Get Tailwind binary
      let tailwindBin: string;
      if (isV4) {
        const v4CliBin = path.join(projectPath, 'node_modules/.bin/tailwindcss');
        const v4CliPackage = path.join(projectPath, 'node_modules/@tailwindcss/cli');

        if (fs.existsSync(v4CliPackage)) {
          tailwindBin = v4CliBin;
        } else {
          console.log('[VueBuilder] Installing @tailwindcss/cli for Tailwind v4...');
          execSync('npm install --save-dev @tailwindcss/cli', {
            cwd: projectPath,
            stdio: 'pipe'
          });
          tailwindBin = v4CliBin;
        }
      } else {
        tailwindBin = path.join(projectPath, 'node_modules/.bin/tailwindcss');
      }

      execSync(
        `"${tailwindBin}" -i "${tempCssEntry}" -o "${themeCssPath}" --minify`,
        {
          cwd: projectPath,
          stdio: 'pipe',
          env: {
            ...process.env,
            NODE_ENV: 'production'
          }
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempCssEntry);

      // Get file size
      const size = fs.existsSync(themeCssPath) ? fs.statSync(themeCssPath).size : 0;

      console.log(`[VueBuilder] Theme CSS built: ${(size / 1024).toFixed(2)} KB`);

      return {
        cssPath: themeCssPath,
        size
      };
    } catch (error) {
      console.error('[VueBuilder] Failed to build Tailwind CSS:', error);
      const tempCssEntry = path.join(projectPath, '.oaysus-temp-tailwind.css');
      if (fs.existsSync(tempCssEntry)) {
        fs.unlinkSync(tempCssEntry);
      }
      return null;
    }
  }

  /**
   * Build all Vue components in a package
   */
  async buildComponents(
    validationResult: ValidationResult,
    projectPath: string
  ): Promise<BuildResult> {
    const outputDir = path.join(projectPath, '.oaysus-build');
    const components: ComponentBuildOutput[] = [];
    let totalSize = 0;

    try {
      // Clean output directory
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }
      fs.mkdirSync(outputDir, { recursive: true });

      // Import dependencies functions dynamically
      const { getDependenciesToBundle } = await import('./import-map.js');
      const { filterRuntimeDependencies } = await import('./bundler.js');

      // Build each component
      for (const component of validationResult.components) {
        const builtComponent = await this.buildComponent(
          component,
          projectPath,
          outputDir,
          validationResult.packageJson,
          getDependenciesToBundle,
          filterRuntimeDependencies
        );

        components.push(builtComponent);
        totalSize += builtComponent.size;
      }

      // Build theme-level Tailwind CSS
      const themeCss = await this.buildThemeCSS(
        projectPath,
        outputDir,
        validationResult.packageJson
      );

      return {
        success: true,
        outputDir,
        components,
        totalSize: totalSize + (themeCss?.size || 0),
        themeCssPath: themeCss?.cssPath,
        themeCssSize: themeCss?.size
      };
    } catch (error) {
      return {
        success: false,
        outputDir,
        components,
        totalSize: 0,
        error: error instanceof Error ? error.message : 'Build failed'
      };
    }
  }

  /**
   * Build a single Vue component for server-side rendering
   * Creates self-contained Node.js bundle with render function export
   */
  private async buildServerComponent(
    component: ComponentInfo,
    projectPath: string,
    outputDir: string
  ): Promise<{ name: string; displayName: string; jsPath: string; size: number }> {
    const componentOutDir = path.join(outputDir, component.name);

    // Ensure output directory exists
    if (!fs.existsSync(componentOutDir)) {
      fs.mkdirSync(componentOutDir, { recursive: true });
    }

    // Create temporary wrapper that exports component + render function
    const componentPath = path.resolve(projectPath, component.entryPoint);
    const wrapperPath = path.join(componentOutDir, '.temp-server-wrapper.js');

    // Vue SSR wrapper - imports component and provides render function
    const wrapperCode = `
import Component from '${componentPath}';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';

export default Component;

export async function render(props) {
  const app = createSSRApp(Component, props);
  const html = await renderToString(app);
  return html;
}
`;

    fs.writeFileSync(wrapperPath, wrapperCode);

    // Get Vue plugin for SSR
    const { getVueSSRPlugin } = await import('./config.js');
    const plugin = await getVueSSRPlugin();
    const plugins = plugin ? [plugin] : [];

    // Build with Vite in production mode for Node.js
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await viteBuild({
        configFile: false,
        mode: 'production',
        logLevel: 'warn',
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
          __VUE_OPTIONS_API__: JSON.stringify(true),
          __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
        },
        ssr: {
          noExternal: true  // Bundle all dependencies
        },
        build: {
          lib: {
            entry: wrapperPath,
            formats: ['es'],
            fileName: 'server'
          },
          rollupOptions: {
            external: [],  // Bundle everything for SSR
            output: {
              format: 'es',
              entryFileNames: 'server.js',
              exports: 'auto',
              inlineDynamicImports: false
            }
          },
          outDir: componentOutDir,
          minify: 'terser',
          sourcemap: false,
          emptyOutDir: false,
          target: 'node18',
          ssr: true,
          cssCodeSplit: false
        },
        plugins
      });
    } finally {
      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }

      // Clean up temp wrapper file
      if (fs.existsSync(wrapperPath)) {
        fs.unlinkSync(wrapperPath);
      }
    }

    // Get file size
    const jsPath = path.join(componentOutDir, 'server.js');
    const size = fs.existsSync(jsPath) ? fs.statSync(jsPath).size : 0;

    return {
      name: component.name,
      displayName: component.displayName,
      jsPath,
      size
    };
  }

  /**
   * Build all Vue components for server-side rendering
   */
  async buildServerComponents(
    validationResult: ValidationResult,
    projectPath: string
  ): Promise<import('../core/types.js').ServerBuildResult> {
    const outputDir = path.join(projectPath, '.oaysus-build');
    const serverComponents: Array<{ name: string; displayName: string; jsPath: string; size: number }> = [];
    let totalSize = 0;

    try {
      // Build each component for server
      for (const component of validationResult.components) {
        const builtServerComponent = await this.buildServerComponent(
          component,
          projectPath,
          outputDir
        );

        serverComponents.push(builtServerComponent);
        totalSize += builtServerComponent.size;
      }

      return {
        success: true,
        outputDir,
        components: serverComponents,
        totalSize
      };
    } catch (error) {
      return {
        success: false,
        outputDir,
        components: [],
        totalSize: 0,
        error: error instanceof Error ? error.message : 'Server build failed'
      };
    }
  }
}

// Export singleton instance
const builder = new VueBuilder();
export default builder;
export { builder };
