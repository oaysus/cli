import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import fs from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { Logo } from '../components/Logo.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { requireAuth, loadCredentials } from '../lib/shared/auth.js';
import type { Credentials } from '../types/index.js';
import { validatePackage } from '../lib/validator.js';
import { uploadBuildFilesToR2, UploadError } from '../lib/shared/uploader.js';
import { buildR2Path } from '../lib/shared/path-builder.js';
import { R2_PUBLIC_URL } from '../lib/shared/config.js';
import { detectFramework, getBuilder, getBundler, getImportMapGenerator } from '../lib/core/framework-registry.js';
import type { ComponentBuildOutput } from '../lib/core/types.js';
import { analyzeComponentImports, type DetectedDependency } from '../lib/shared/import-analyzer.js';
import { Spinner } from '../components/Spinner.js';
import { HistoryEntry } from '../components/App.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Props {
  projectPath?: string;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

type Screen =
  | 'checking-auth'
  | 'validating'
  | 'installing-deps'
  | 'building'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

export function PushScreen({
  projectPath = '.',
  onExit,
  sessionHistory = [],
  addToHistory,
  removeFromHistory
}: Props) {
  const [screen, setScreen] = useState<Screen>('checking-auth');
  const [error, setError] = useState<string>('');
  const [bytesUploaded, setBytesUploaded] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  const [themePackId, setThemePackId] = useState<string>('');
  const [componentCount, setComponentCount] = useState<number>(0);
  const [builtComponents, setBuiltComponents] = useState<ComponentBuildOutput[]>([]);
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

  // Standalone mode: maintain local history when external callbacks aren't available
  const isStandalone = !addToHistory;
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);

  // Unified history management - works in both standalone and interactive modes
  const addEntry = (entry: HistoryEntry | HistoryEntry[]) => {
    if (addToHistory) {
      addToHistory(entry);
    } else {
      // Standalone mode: manage local history
      if (Array.isArray(entry)) {
        setLocalHistory(prev => [...prev, ...entry]);
      } else {
        setLocalHistory(prev => [...prev, entry]);
      }
    }
  };

  const removeEntry = (spinnerId: string) => {
    if (removeFromHistory) {
      removeFromHistory(spinnerId);
    } else {
      // Standalone mode: remove from local history
      setLocalHistory(prev => prev.filter(entry => entry.spinnerId !== spinnerId));
    }
  };

  // Use the appropriate history for rendering
  const displayHistory = isStandalone ? localHistory : sessionHistory;

  // Destructure for easier access
  const { version, userEmail, isLoaded } = appData;

  // Load version and credentials on mount
  useEffect(() => {
    const loadAllData = async () => {
      const [versionData, credsData] = await Promise.all([
        (async () => {
          try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const pkgPath = path.join(__dirname, '../../package.json');
            const pkgData = await readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgData);
            return pkg.version;
          } catch {
            return '0.1.0';
          }
        })(),
        loadCredentials()
      ]);

      setAppData({
        version: versionData,
        userEmail: credsData?.email || null,
        isLoaded: true
      });
    };

    loadAllData();
  }, []);

  // Auto-exit after success
  useEffect(() => {
    if (screen === 'success') {
      const timer = setTimeout(() => {
        if (onExit) onExit();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [screen, onExit]);

  // Handle cancellation with Escape key
  const handleCancel = () => {
    addEntry({
      type: 'info',
      content: 'Push command cancelled, returned to menu'
    });
    if (onExit) onExit();
  };

  useInput((input, key) => {
    // Allow Escape to cancel (except during upload or after completion)
    if (key.escape && screen !== 'uploading' && screen !== 'success' && screen !== 'error') {
      handleCancel();
    }
  });

  // Main upload flow
  useEffect(() => {
    let isCancelled = false;

    const runUploadFlow = async () => {
      try {
        // Step 1: Check authentication (with expiry validation)
        setScreen('checking-auth');
        let credentials: Credentials;
        try {
          credentials = await requireAuth();
        } catch (authError) {
          if (isCancelled) return;
          const message = authError instanceof Error ? authError.message : 'Not authenticated';
          const isExpired = message.toLowerCase().includes('expired');

          setError(message);
          addEntry({
            type: 'error',
            content: `✗ ${message}`,
            color: 'red'
          });
          addEntry({
            type: 'info',
            content: isExpired
              ? '💡 Your session has expired. Run "oaysus login" to re-authenticate.'
              : '💡 Run "oaysus login" to authenticate.',
            color: 'yellow'
          });
          setScreen('error');
          return;
        }

        // Log the command being run
        addEntry({
          type: 'info',
          content: '❯ /push',
          color: 'cyan',
          // Add spacing marker to indicate this should have top margin
          spinnerId: displayHistory.length > 0 ? 'command-separator' : undefined
        });

        // Step 2: Validate package
        if (isCancelled) return;
        setScreen('validating');

        addEntry({
          type: 'spinner',
          content: `Validating package...`,
          color: 'cyan',
          spinnerId: 'validation'
        });

        const absolutePath = path.resolve(projectPath);
        const validationResult = await validatePackage(absolutePath);

        if (!validationResult.valid) {
          if (isCancelled) return;
          removeEntry('validation');
          setError(validationResult.errors.join('\n'));
          setScreen('error');
          return;
        }

        removeEntry('validation');

        addEntry({
          type: 'success',
          content: `✓ Validated ${validationResult.components.length} component${validationResult.components.length !== 1 ? 's' : ''}`,
          color: 'green'
        });

        // Step 2.5: Analyze component imports to detect external dependencies
        const componentPaths = validationResult.components.map(c => c.entryPoint);
        const detectedDeps = analyzeComponentImports(componentPaths, validationResult.packageJson);
        if (detectedDeps.length > 0) {
          addEntry({
            type: 'success',
            content: `✓ Detected ${detectedDeps.length} external ${detectedDeps.length === 1 ? 'dependency' : 'dependencies'}: ${detectedDeps.map(d => d.name).join(', ')}`,
            color: 'green'
          });
        }

        // Step 3: Install dependencies if needed
        const nodeModulesPath = path.join(absolutePath, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
          if (isCancelled) return;
          setScreen('installing-deps');

          try {
            await execAsync('npm install', { cwd: absolutePath });

            addEntry({
              type: 'success',
              content: '✓ Dependencies installed',
              color: 'green'
            });
          } catch (err) {
            if (isCancelled) return;
            setError('Failed to install dependencies. Run "npm install" manually.');
            setScreen('error');
            return;
          }
        }

        // Step 4: BUILD components with Vite
        if (isCancelled) return;
        setScreen('building');

        addEntry({
          type: 'spinner',
          content: `Building components...`,
          color: 'cyan',
          spinnerId: 'building'
        });

        // Suppress console output during build
        const originalLog = console.log;
        console.log = () => {};

        // Get framework-specific builder
        const framework = detectFramework(validationResult.packageJson);
        const builder = await getBuilder(framework);
        const buildResult = await builder.buildComponents(validationResult, absolutePath, detectedDeps);

        // Restore console.log
        console.log = originalLog;

        if (!buildResult.success) {
          if (isCancelled) return;
          removeEntry('building');
          setError(buildResult.error || 'Build failed');
          setScreen('error');
          return;
        }

        setBuiltComponents(buildResult.components);

        removeEntry('building');

        addEntry({
          type: 'success',
          content: `✓ Built ${buildResult.components.length} component${buildResult.components.length !== 1 ? 's' : ''} (${(buildResult.totalSize / 1024).toFixed(1)} KB)`,
          color: 'green'
        });

        // Step 4.5: Build server components for SSR
        if (isCancelled) return;

        addEntry({
          type: 'spinner',
          content: `Building server components for SSR...`,
          color: 'cyan',
          spinnerId: 'building-server'
        });

        // Suppress console output during server build
        console.log = () => {};

        const serverBuildResult = await builder.buildServerComponents(validationResult, absolutePath);

        // Restore console.log
        console.log = originalLog;

        removeEntry('building-server');

        if (serverBuildResult.success) {
          addEntry({
            type: 'success',
            content: `✓ Built ${serverBuildResult.components.length} server component${serverBuildResult.components.length !== 1 ? 's' : ''} (${(serverBuildResult.totalSize / 1024).toFixed(1)} KB)`,
            color: 'green'
          });
        } else {
          // Server build failure is not fatal - log warning and continue
          addEntry({
            type: 'info',
            content: `⚠ Server components skipped: ${serverBuildResult.error}`,
            color: 'yellow'
          });
        }

        // Step 5: Bundle dependencies for R2 upload
        if (isCancelled) return;

        addEntry({
          type: 'spinner',
          content: `Bundling dependencies...`,
          color: 'cyan',
          spinnerId: 'bundling'
        });

        // Get framework-specific bundler and import map generator
        const bundler = await getBundler(framework);
        const importMapGen = await getImportMapGenerator(framework);

        // Get dependencies to bundle (filter out dev-only packages)
        const allDeps = importMapGen.getDependenciesToBundle(validationResult.packageJson);
        const runtimeDeps = bundler.filterRuntimeDependencies(allDeps);

        // Suppress console output during bundling
        console.log = () => {};

        // Bundle dependencies
        const bundledDeps = await bundler.bundleDependencies(runtimeDeps, {
          projectRoot: absolutePath,
          outputDir: path.join(buildResult.outputDir, 'deps')
        });

        // Restore console.log
        console.log = originalLog;

        removeEntry('bundling');

        addEntry({
          type: 'success',
          content: `✓ Bundled ${bundledDeps.length} React ${bundledDeps.length === 1 ? 'dependency' : 'dependencies'}`,
          color: 'green'
        });

        // Step 5.2: Bundle detected external dependencies (Swiper, lucide-react, etc.)
        if (detectedDeps.length > 0) {
          if (isCancelled) return;

          addEntry({
            type: 'spinner',
            content: `Bundling external dependencies...`,
            color: 'cyan',
            spinnerId: 'bundling-external'
          });

          // Suppress console output during bundling
          console.log = () => {};

          await bundler.bundleDetectedDependencies(detectedDeps, {
            projectRoot: absolutePath,
            outputDir: path.join(buildResult.outputDir, 'deps')
          });

          // Restore console.log
          console.log = originalLog;

          removeEntry('bundling-external');

          addEntry({
            type: 'success',
            content: `✓ Bundled ${detectedDeps.length} external ${detectedDeps.length === 1 ? 'dependency' : 'dependencies'}`,
            color: 'green'
          });
        }

        // Step 5.5: Bundle server-side dependencies for SSR
        if (isCancelled) return;

        addEntry({
          type: 'spinner',
          content: `Bundling server dependencies for SSR...`,
          color: 'cyan',
          spinnerId: 'bundling-server'
        });

        // Suppress console output during server bundling
        console.log = () => {};

        const serverDeps = await bundler.bundleServerDependencies(runtimeDeps, {
          projectRoot: absolutePath,
          outputDir: buildResult.outputDir
        });

        // Restore console.log
        console.log = originalLog;

        removeEntry('bundling-server');

        if (serverDeps.length > 0) {
          const serverDepSize = serverDeps.reduce((sum, d) => sum + d.size, 0);
          addEntry({
            type: 'success',
            content: `✓ Bundled server dependencies (${(serverDepSize / 1024).toFixed(1)} KB)`,
            color: 'green'
          });
        }

        // Step 5.6: Generate theme manifest with framework and dependency info
        if (isCancelled) return;

        // Get React version from dependencies
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

        // Save manifest to build directory
        fs.writeFileSync(
          path.join(buildResult.outputDir, 'manifest.json'),
          JSON.stringify(themeManifest, null, 2)
        );

        addEntry({
          type: 'success',
          content: `✓ Generated theme manifest`,
          color: 'green'
        });

        // Step 6: Generate import map with R2 URLs
        if (isCancelled) return;

        // Build R2 base path for this theme
        const r2BasePath = buildR2Path(validationResult.packageJson, credentials);

        // Generate import map with R2 URLs and stylesheets (including detected deps)
        const importMapWithStyles = importMapGen.generateImportMapWithStylesheets(validationResult.packageJson, {
          r2PublicUrl: R2_PUBLIC_URL,
          r2BasePath,
          detectedDeps
        });

        // Separate imports and stylesheets for upload
        const importMap = { imports: importMapWithStyles.imports };
        const stylesheets = importMapWithStyles.stylesheets;

        // Save import map
        fs.writeFileSync(
          path.join(buildResult.outputDir, 'import-map.json'),
          JSON.stringify(importMap, null, 2)
        );

        addEntry({
          type: 'success',
          content: `✓ Generated import map (${Object.keys(importMap.imports).length} entries)`,
          color: 'green'
        });

        // Step 7: Upload individual build files to R2
        if (isCancelled) return;
        setScreen('uploading');

        addEntry({
          type: 'spinner',
          content: `Uploading to server...`,
          color: 'cyan',
          spinnerId: 'uploading'
        });

        // Extract dependencies from package.json for metadata
        const deps = validationResult.packageJson.dependencies || {};
        const dependenciesArray = Object.entries(deps).map(([name, version]) => ({
          name,
          version: version as string
        }));

        const uploadResult = await uploadBuildFilesToR2(
          buildResult.outputDir,
          validationResult.packageJson,
          (bytesUploaded, totalBytes, pct) => {
            setBytesUploaded(bytesUploaded);
            setTotalBytes(totalBytes);
            setPercentage(pct);

            // When upload reaches 100%, switch to processing state
            if (pct >= 100 && screen !== 'processing') {
              setScreen('processing');
              removeEntry('uploading');
              addEntry({
                type: 'success',
                content: `✓ Uploaded (${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`,
                color: 'green'
              });
              addEntry({
                type: 'spinner',
                content: `Processing components on server...`,
                color: 'cyan',
                spinnerId: 'server-processing'
              });
            }
          },
          {
            importMap,
            stylesheets,
            dependencies: dependenciesArray
          }
        );

        // Extract theme pack info from upload result
        setThemePackId(uploadResult.themePackId || '');
        setComponentCount(uploadResult.componentCount || 0);

        // Remove spinner from history and add completion message
        removeEntry('server-processing');

        addEntry({
          type: 'success',
          content: `✓ Published ${uploadResult.componentCount} component${uploadResult.componentCount !== 1 ? 's' : ''} to Oaysus`,
          color: 'green'
        });

        setScreen('success');

      } catch (err: any) {
        if (isCancelled) return;

        if (err instanceof UploadError) {
          setError(`Upload failed: ${err.message}`);
        } else {
          setError(err.message || 'Unknown error occurred');
        }
        setScreen('error');
      }
    };

    runUploadFlow();

    return () => {
      isCancelled = true;
    };
  }, [projectPath]);

  // Don't render until data is loaded to prevent double rendering
  if (!isLoaded) {
    return null;
  }

  // Unified rendering - works the same in both standalone and interactive modes
  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* History - shows completed steps and current spinner */}
      {displayHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {displayHistory.map((entry, index) => {
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'prompt') {
              return (
                <Box key={uniqueKey}>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'response') {
              return (
                <Box key={uniqueKey}>
                  <Text dimColor>❯ </Text>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'success') {
              // Split checkmark from text: "✓ Message" -> "✓ " + "Message"
              const hasCheckmark = entry.content.startsWith('✓ ');
              if (hasCheckmark) {
                const text = entry.content.substring(2); // Remove "✓ "
                return (
                  <Box key={uniqueKey}>
                    <Text color="green">✓ </Text>
                    <Text>{text}</Text>
                  </Box>
                );
              }
              return (
                <Box key={uniqueKey}>
                  <Text color="green">{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'spinner') {
              return (
                <Box key={uniqueKey}>
                  <Spinner type="dots" color="cyan" message={entry.content} />
                </Box>
              );
            } else if (entry.type === 'progress') {
              return (
                <Box key={uniqueKey}>
                  <Text color="cyan">{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'error') {
              return (
                <Box key={uniqueKey}>
                  <Text color="red">{entry.content}</Text>
                </Box>
              );
            } else {
              // Default info type
              const textColor = entry.color === 'dim' ? undefined : entry.color;
              const isDim = entry.color === 'dim';
              const needsTopMargin = entry.spinnerId === 'command-separator';
              return (
                <Box key={uniqueKey} marginTop={needsTopMargin ? 1 : 0}>
                  <Text color={textColor} dimColor={isDim}>{entry.content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Command Indicator - only show in interactive mode */}
      {!isStandalone && (
        <Box flexDirection="column">
          <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
          <Box>
            <Text dimColor>❯ </Text>
            <Text dimColor>/push</Text>
          </Box>
          <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {screen === 'error' && (
          <ErrorMessage
            message="Upload failed"
            details={[error]}
            suggestion="Check your internet connection and try again. If the error persists, contact support."
          />
        )}
      </Box>
    </Box>
  );
}
