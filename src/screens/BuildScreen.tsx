import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import fs from 'fs';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { SuccessMessage } from '../components/SuccessMessage.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { validatePackage } from '../lib/validator.js';
import { BuildProgress } from '../components/BuildProgress.js';
import { detectFramework, getBuilder, getBundler, getImportMapGenerator } from '../lib/core/framework-registry.js';
import type { ComponentBuildOutput } from '../lib/core/types.js';

interface Props {
  projectPath?: string;
  onExit?: () => void;
}

type Screen =
  | 'validating'
  | 'building'
  | 'success'
  | 'error';

export function BuildScreen({
  projectPath = '.',
  onExit
}: Props) {
  const [screen, setScreen] = useState<Screen>('validating');
  const [error, setError] = useState<string>('');
  const [builtComponents, setBuiltComponents] = useState<ComponentBuildOutput[]>([]);
  const [buildProgress, setBuildProgress] = useState<Array<{
    name: string;
    status: 'pending' | 'building' | 'done' | 'error';
    size?: number;
    error?: string;
  }>>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [totalSize, setTotalSize] = useState<number>(0);
  const [dependencyCount, setDependencyCount] = useState<number>(0);

  useEffect(() => {
    let isCancelled = false;

    const build = async () => {
      try {
        // Resolve absolute path
        const absolutePath = path.resolve(process.cwd(), projectPath);

        // Step 1: VALIDATE package
        setScreen('validating');
        const { validatePackage: validateFn } = await import('../lib/validator.js');
        const validationResult = await validateFn(absolutePath);

        if (!validationResult.valid) {
          if (isCancelled) return;
          setError(validationResult.errors.join('\n'));
          setScreen('error');
          return;
        }

        // Step 2: BUILD components
        if (isCancelled) return;
        setScreen('building');

        // Initialize build progress
        const initialProgress = validationResult.components.map(c => ({
          name: c.name,
          status: 'pending' as const
        }));
        setBuildProgress(initialProgress);

        // Get framework-specific builder
        const framework = detectFramework(validationResult.packageJson);
        const builder = await getBuilder(framework);

        // Build client components
        const buildResult = await builder.buildComponents(validationResult, absolutePath);

        if (!buildResult.success) {
          if (isCancelled) return;
          setError(buildResult.error || 'Build failed');
          setScreen('error');
          return;
        }

        // Update progress
        setBuildProgress(buildResult.components.map(c => ({
          name: c.name,
          status: 'done' as const,
          size: c.size
        })));

        setBuiltComponents(buildResult.components);
        setOutputDir(buildResult.outputDir);
        setTotalSize(buildResult.totalSize);

        // Build server components for SSR (island architecture)
        if (isCancelled) return;
        const serverBuildResult = await builder.buildServerComponents(validationResult, absolutePath);

        if (!serverBuildResult.success) {
          if (isCancelled) return;
          setError(serverBuildResult.error || 'Server build failed');
          setScreen('error');
          return;
        }

        // Step 3: Bundle dependencies
        if (isCancelled) return;

        // Get framework-specific bundler and import map generator
        const bundler = await getBundler(framework);
        const importMapGen = await getImportMapGenerator(framework);

        // Get dependencies to bundle (filter out dev-only packages)
        const allDeps = importMapGen.getDependenciesToBundle(validationResult.packageJson);
        const runtimeDeps = bundler.filterRuntimeDependencies(allDeps);

        // Bundle dependencies
        const bundledDeps = await bundler.bundleDependencies(runtimeDeps, {
          projectRoot: absolutePath,
          outputDir: path.join(buildResult.outputDir, 'deps')
        });

        setDependencyCount(bundledDeps.length);

        // Step 4: Generate import map for local preview (uses bundled dependencies)
        if (isCancelled) return;

        // Generate import map with local R2-style URLs for preview on port 4000
        const importMapWithStyles = importMapGen.generateImportMapWithStylesheets(validationResult.packageJson, {
          r2PublicUrl: 'http://localhost:4000/build',
          r2BasePath: ''
        });

        const importMap = { imports: importMapWithStyles.imports };

        // Save import map
        fs.writeFileSync(
          path.join(buildResult.outputDir, 'import-map.json'),
          JSON.stringify(importMap, null, 2)
        );

        // Success!
        if (isCancelled) return;
        setScreen('success');

      } catch (err) {
        if (isCancelled) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setScreen('error');
      }
    };

    build();

    return () => {
      isCancelled = true;
    };
  }, [projectPath]);

  // Don't render until loaded
  if (screen === 'validating') {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
            <Spinner message="Validating package..." />
        </Box>
      </Box>
    );
  }

  if (screen === 'building') {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1} flexDirection="column">
          <Text>Building components...</Text>
          <Box marginTop={1}>
            <BuildProgress components={buildProgress} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (screen === 'success') {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <SuccessMessage
            message="Build completed successfully!"
            details={[
              `Built ${builtComponents.length} component${builtComponents.length !== 1 ? 's' : ''} (${(totalSize / 1024).toFixed(1)} KB)`,
              `Generated server bundles for SSR`,
              `Bundled ${dependencyCount} dependencies`,
              `Output: ${outputDir}`,
              '',
              'Run "npm run preview" to test locally'
            ]}
          />
        </Box>
      </Box>
    );
  }

  if (screen === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <ErrorMessage
            message="Build failed"
            details={[error]}
            suggestion="Check the error above and fix any issues in your components."
          />
        </Box>
      </Box>
    );
  }

  return null;
}
