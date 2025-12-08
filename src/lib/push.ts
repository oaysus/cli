/**
 * Non-interactive Push Module
 * Runs the full push flow without requiring TTY/Ink
 */

import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from './shared/auth.js';
import { validatePackage } from './validator.js';
import { uploadBuildFilesToR2 } from './shared/uploader.js';
import { buildR2Path } from './shared/path-builder.js';
import { R2_PUBLIC_URL } from './shared/config.js';
import { detectFramework, getBuilder, getBundler, getImportMapGenerator } from './core/framework-registry.js';
import { analyzeComponentImports, type DetectedDependency } from './shared/import-analyzer.js';

const execAsync = promisify(exec);

interface PushOptions {
  projectPath?: string;
  silent?: boolean;
}

interface PushResult {
  success: boolean;
  themePackId?: string;
  componentCount?: number;
  error?: string;
}

function log(message: string, silent: boolean = false) {
  if (!silent) {
    console.log(message);
  }
}

function logSuccess(message: string, silent: boolean = false) {
  if (!silent) {
    console.log(`✓ ${message}`);
  }
}

function logError(message: string, silent: boolean = false) {
  if (!silent) {
    console.error(`✗ ${message}`);
  }
}

/**
 * Run the full push flow non-interactively
 */
export async function push(options: PushOptions = {}): Promise<PushResult> {
  const { projectPath = '.', silent = false } = options;

  try {
    // Step 1: Check authentication
    log('\n📦 Oaysus Push', silent);
    log('─'.repeat(40), silent);

    let credentials;
    try {
      credentials = await requireAuth();
      logSuccess('Authenticated', silent);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Not authenticated';
      logError(message, silent);
      if (message.toLowerCase().includes('expired')) {
        log('Tip: Your session has expired. Run "oaysus login" to re-authenticate.', silent);
      } else {
        log('Tip: Run "oaysus login" to authenticate.', silent);
      }
      return { success: false, error: message };
    }

    // Step 2: Validate package
    const absolutePath = path.resolve(projectPath);
    log(`\nValidating package at ${absolutePath}...`, silent);

    const validationResult = await validatePackage(absolutePath);
    if (!validationResult.valid) {
      logError(`Validation failed: ${validationResult.errors.join(', ')}`, silent);
      return { success: false, error: validationResult.errors.join(', ') };
    }
    logSuccess(`Validated ${validationResult.components.length} component(s)`, silent);

    // Step 3: Install dependencies if needed
    const nodeModulesPath = path.join(absolutePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      log('\nInstalling dependencies...', silent);
      try {
        await execAsync('npm install', { cwd: absolutePath });
        logSuccess('Dependencies installed', silent);
      } catch (err) {
        logError('Failed to install dependencies', silent);
        return { success: false, error: 'Failed to install dependencies' };
      }
    }

    // Step 3.5: Analyze component imports to detect external dependencies
    log('\nAnalyzing component imports...', silent);
    // Note: entryPoint is already an absolute path from validation
    const componentPaths = validationResult.components.map(c => c.entryPoint);
    const detectedDeps = analyzeComponentImports(componentPaths, validationResult.packageJson);
    if (detectedDeps.length > 0) {
      logSuccess(`Detected ${detectedDeps.length} external dependencies: ${detectedDeps.map(d => d.name).join(', ')}`, silent);
    } else {
      log('  No external dependencies detected (only React)', silent);
    }

    // Step 4: Build client components
    log('\nBuilding client components...', silent);
    const framework = detectFramework(validationResult.packageJson);
    const builder = await getBuilder(framework);
    const buildResult = await builder.buildComponents(validationResult, absolutePath, detectedDeps);

    if (!buildResult.success) {
      logError(`Build failed: ${buildResult.error}`, silent);
      return { success: false, error: buildResult.error };
    }
    logSuccess(`Built ${buildResult.components.length} component(s) (${(buildResult.totalSize / 1024).toFixed(1)} KB)`, silent);

    // Step 5: Build server components for SSR
    log('\nBuilding server components for SSR...', silent);
    const serverBuildResult = await builder.buildServerComponents(validationResult, absolutePath);

    if (serverBuildResult.success) {
      logSuccess(`Built ${serverBuildResult.components.length} server component(s) (${(serverBuildResult.totalSize / 1024).toFixed(1)} KB)`, silent);
    } else {
      log(`⚠ Server components skipped: ${serverBuildResult.error}`, silent);
    }

    // Step 6: Bundle client dependencies (React framework deps)
    log('\nBundling React dependencies...', silent);
    const bundler = await getBundler(framework);
    const importMapGen = await getImportMapGenerator(framework);

    const allDeps = importMapGen.getDependenciesToBundle(validationResult.packageJson);
    const runtimeDeps = bundler.filterRuntimeDependencies(allDeps);

    const bundledDeps = await bundler.bundleDependencies(runtimeDeps, {
      projectRoot: absolutePath,
      outputDir: path.join(buildResult.outputDir, 'deps')
    });
    logSuccess(`Bundled ${bundledDeps.length} React dependencies`, silent);

    // Step 6.5: Bundle detected external dependencies (Swiper, etc.)
    if (detectedDeps.length > 0) {
      log('\nBundling external dependencies...', silent);
      const externalBundled = await bundler.bundleDetectedDependencies(detectedDeps, {
        projectRoot: absolutePath,
        outputDir: path.join(buildResult.outputDir, 'deps')
      });
      logSuccess(`Bundled ${externalBundled.length} external dependencies`, silent);
    }

    // Step 7: Bundle server dependencies for SSR
    log('\nBundling server dependencies for SSR...', silent);
    const serverDeps = await bundler.bundleServerDependencies(runtimeDeps, {
      projectRoot: absolutePath,
      outputDir: buildResult.outputDir
    });

    if (serverDeps.length > 0) {
      const serverDepSize = serverDeps.reduce((sum, d) => sum + d.size, 0);
      logSuccess(`Bundled server dependencies (${(serverDepSize / 1024).toFixed(1)} KB)`, silent);
    }

    // Step 8: Generate theme manifest
    const allDepsForManifest = { ...validationResult.packageJson.dependencies, ...validationResult.packageJson.devDependencies };
    const reactVersion = (allDepsForManifest['react'] as string || '19.0.0').replace(/^[\^~>=<]/, '');

    const themeManifest = {
      framework: framework as 'react' | 'vue' | 'svelte',
      frameworkVersion: reactVersion,
      components: validationResult.components.map(c => c.name),
      deps: [
        // React framework deps
        ...runtimeDeps.map(dep => ({
          name: dep.name,
          version: dep.version,
          r2Path: `server-deps/react@${reactVersion}/`
        })),
        // Detected external deps
        ...detectedDeps.map(dep => ({
          name: dep.name,
          version: dep.version,
          r2Path: `deps/${dep.name}@${dep.version}/`,
          subExports: dep.subExports,
          cssImports: dep.cssImports
        }))
      ],
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(buildResult.outputDir, 'manifest.json'),
      JSON.stringify(themeManifest, null, 2)
    );
    logSuccess('Generated theme manifest', silent);

    // Step 9: Generate import map (includes detected deps)
    const r2BasePath = buildR2Path(validationResult.packageJson, credentials);

    const importMapWithStyles = importMapGen.generateImportMapWithStylesheets(validationResult.packageJson, {
      r2PublicUrl: R2_PUBLIC_URL,
      r2BasePath,
      detectedDeps // Pass detected deps for import map generation
    });

    const importMap = { imports: importMapWithStyles.imports };
    const stylesheets = importMapWithStyles.stylesheets;

    fs.writeFileSync(
      path.join(buildResult.outputDir, 'import-map.json'),
      JSON.stringify(importMap, null, 2)
    );
    logSuccess(`Generated import map (${Object.keys(importMap.imports).length} entries)`, silent);

    // Step 10: Upload to R2
    log('\nUploading to server...', silent);

    const deps = validationResult.packageJson.dependencies || {};
    const dependenciesArray = Object.entries(deps).map(([name, version]) => ({
      name,
      version: version as string
    }));

    let lastPercent = 0;
    const uploadResult = await uploadBuildFilesToR2(
      buildResult.outputDir,
      validationResult.packageJson,
      (bytesUploaded, totalBytes, pct) => {
        if (!silent && pct >= lastPercent + 10) {
          lastPercent = Math.floor(pct / 10) * 10;
          process.stdout.write(`\r  Uploading: ${pct}%`);
        }
      },
      {
        importMap,
        stylesheets,
        dependencies: dependenciesArray
      }
    );

    if (!silent) {
      process.stdout.write('\r');
    }
    logSuccess(`Uploaded to R2`, silent);

    // Success!
    log('\n' + '─'.repeat(40), silent);
    logSuccess(`Published ${uploadResult.componentCount} component(s) to Oaysus`, silent);
    log(`  Theme Pack ID: ${uploadResult.themePackId}`, silent);
    log('─'.repeat(40) + '\n', silent);

    return {
      success: true,
      themePackId: uploadResult.themePackId,
      componentCount: uploadResult.componentCount
    };

  } catch (err: any) {
    logError(err.message || 'Push failed', silent);
    return { success: false, error: err.message || 'Push failed' };
  }
}

// Allow running directly
if (process.argv[1]?.includes('push.js') || process.argv[1]?.includes('push.ts')) {
  const projectPath = process.argv[2] || '.';
  push({ projectPath }).then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
