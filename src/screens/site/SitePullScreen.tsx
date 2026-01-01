import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import { Logo } from '../../components/Logo.js';
import { Spinner } from '../../components/Spinner.js';
import { ProgressBar } from '../../components/ProgressBar.js';
import { loadProject } from '../../lib/site/index.js';
import { pullPages, previewPull, PullResult, PullPreviewPage } from '../../lib/site/page-puller.js';
import { pullAssets, previewAssetPull, AssetPullResult, formatBytes } from '../../lib/site/asset-puller.js';
import { loadCredentials } from '../../lib/shared/auth.js';
import { HistoryEntry } from '../../components/App.js';
import type { WebsiteConfig } from '../../types/site.js';

interface Props {
  projectPath?: string;
  force?: boolean;
  dryRun?: boolean;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

type Screen = 'loading' | 'preview' | 'pulling-pages' | 'pulling-assets' | 'success' | 'error';

export function SitePullScreen({
  projectPath = '.',
  force = false,
  dryRun = false,
  onExit,
  sessionHistory: externalHistory,
  addToHistory: externalAddToHistory,
  removeFromHistory: externalRemoveFromHistory
}: Props) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [pullResult, setPullResult] = useState<PullResult | null>(null);
  const [assetResult, setAssetResult] = useState<AssetPullResult | null>(null);
  const [error, setError] = useState<string>('');
  const [directory] = useState(path.resolve(projectPath));
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, detail: '', stage: '' });

  // Preview state
  const [newPages, setNewPages] = useState<PullPreviewPage[]>([]);
  const [existingPages, setExistingPages] = useState<PullPreviewPage[]>([]);
  const [assetsToDownload, setAssetsToDownload] = useState<number>(0);
  const [assetsUpToDate, setAssetsUpToDate] = useState<number>(0);
  const [totalDownloadSize, setTotalDownloadSize] = useState<number>(0);
  const [loadedConfig, setLoadedConfig] = useState<WebsiteConfig | null>(null);
  const [loadedProjectPath, setLoadedProjectPath] = useState<string>('');

  // Internal history management for standalone mode
  const [internalHistory, setInternalHistory] = useState<HistoryEntry[]>([]);
  const isStandalone = !externalAddToHistory;

  const sessionHistory = isStandalone ? internalHistory : (externalHistory || []);

  const addToHistory = isStandalone
    ? (entry: HistoryEntry | HistoryEntry[]) => {
        setInternalHistory(prev => {
          const entries = Array.isArray(entry) ? entry : [entry];
          return [...prev, ...entries];
        });
      }
    : externalAddToHistory;

  const removeFromHistory = isStandalone
    ? (spinnerId: string) => {
        setInternalHistory(prev => prev.filter(e => e.spinnerId !== spinnerId));
      }
    : externalRemoveFromHistory;

  // Handle preview confirmation input
  useInput((input, key) => {
    if (screen === 'preview') {
      if (input === 'y' || input === 'Y') {
        runPull();
      } else if (input === 'n' || input === 'N' || key.escape) {
        if (addToHistory) {
          addToHistory({
            type: 'info',
            content: '  Cancelled',
            color: 'dim'
          });
        }
        if (onExit) onExit();
      }
    }
  });

  // Load project and preview pull
  useEffect(() => {
    const loadAndPreview = async () => {
      // Add command to history
      if (addToHistory) {
        const flags = [
          dryRun && '--dry-run',
          force && '--force'
        ].filter(Boolean).join(' ');
        const cmdText = `/site pull${flags ? ' ' + flags : ''}`;
        addToHistory({
          type: 'info',
          content: `❯ ${cmdText}`,
          color: 'cyan',
          spinnerId: sessionHistory.length > 0 ? 'command-separator' : undefined
        });
      }

      try {
        // Load credentials for email display
        const creds = await loadCredentials();
        if (creds?.email) {
          setUserEmail(creds.email);
        }

        // Add loading spinner
        if (addToHistory) {
          addToHistory({
            type: 'spinner',
            content: 'Fetching pages from server...',
            spinnerId: 'loading'
          });
        }

        // Load project to get config
        setScreen('loading');
        const project = await loadProject(projectPath);

        if (project.errors.length > 0 && !project.config) {
          if (removeFromHistory) {
            removeFromHistory('loading');
          }
          if (addToHistory) {
            addToHistory({
              type: 'error',
              content: `✗ ${project.errors.join(', ')}`
            });
          }
          setError(project.errors.join('\n'));
          setScreen('error');
          return;
        }

        setLoadedConfig(project.config);
        setLoadedProjectPath(project.projectPath);

        // Preview what will be pulled
        const preview = await previewPull({
          projectPath: project.projectPath,
          config: project.config,
        });

        if (removeFromHistory) {
          removeFromHistory('loading');
        }

        if (!preview.success) {
          if (addToHistory) {
            addToHistory({
              type: 'error',
              content: `✗ ${preview.error}`
            });
          }
          setError(preview.error || 'Failed to fetch pages');
          setScreen('error');
          return;
        }

        // Also preview assets
        const assetPreview = await previewAssetPull({
          projectPath: project.projectPath,
          config: project.config,
        });

        if (preview.pages.length === 0 && (!assetPreview.success || assetPreview.toDownload.length === 0)) {
          if (addToHistory) {
            addToHistory({
              type: 'info',
              content: 'No pages or assets to pull',
              color: 'yellow'
            });
          }
          setScreen('success');
          return;
        }

        setNewPages(preview.newPages);
        setExistingPages(preview.existingPages);

        // Set asset preview state
        if (assetPreview.success) {
          setAssetsToDownload(assetPreview.toDownload.length);
          setAssetsUpToDate(assetPreview.upToDate.length);
          setTotalDownloadSize(assetPreview.totalDownloadSize);
        }

        // If force flag or no existing pages, proceed directly
        if (force || preview.existingPages.length === 0) {
          await runPullWithConfig(project.projectPath, project.config);
        } else {
          // Show preview and ask for confirmation
          setScreen('preview');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';

        if (removeFromHistory) {
          removeFromHistory('loading');
        }
        if (addToHistory) {
          addToHistory({
            type: 'error',
            content: `✗ ${errorMsg}`
          });
        }

        setError(errorMsg);
        setScreen('error');
      }
    };

    loadAndPreview();
  }, [projectPath, force, dryRun]);

  // Run pull after confirmation
  const runPull = () => {
    if (loadedConfig && loadedProjectPath) {
      runPullWithConfig(loadedProjectPath, loadedConfig);
    }
  };

  // Run pull operation
  const runPullWithConfig = async (projPath: string, config: WebsiteConfig) => {
    try {
      // Phase 1: Pull pages
      setScreen('pulling-pages');

      const onPageProgress = (
        stage: 'fetching' | 'writing',
        current: number,
        total: number,
        detail?: string
      ) => {
        setProgress({ current, total, detail: detail || '', stage: 'pages' });
      };

      const result = await pullPages({
        projectPath: projPath,
        config,
        force: true,
        dryRun,
        onProgress: onPageProgress,
      });

      setPullResult(result);

      // Phase 2: Pull assets
      setScreen('pulling-assets');
      setProgress({ current: 0, total: 0, detail: '', stage: 'assets' });

      const onAssetProgress = (
        stage: 'fetching' | 'downloading',
        current: number,
        total: number,
        detail?: string
      ) => {
        setProgress({ current, total, detail: detail || '', stage: 'assets' });
      };

      const assetRes = await pullAssets({
        projectPath: projPath,
        config,
        force,
        dryRun,
        onProgress: onAssetProgress,
      });

      setAssetResult(assetRes);

      // Show results
      if (result.success || assetRes.success) {
        if (addToHistory) {
          const successLines: HistoryEntry[] = [];

          // Pages summary
          if (result.written > 0) {
            successLines.push({
              type: 'success',
              content: dryRun
                ? `✓ Dry run: ${result.written} page${result.written === 1 ? '' : 's'}`
                : `✓ Pulled ${result.written} page${result.written === 1 ? '' : 's'}`
            });

            for (const page of result.pages) {
              if (page.action === 'created' || page.action === 'updated') {
                const icon = page.action === 'created' ? '+' : '~';
                successLines.push({
                  type: 'info',
                  content: `  ${icon} ${page.file}`,
                  color: 'dim'
                });
              }
            }
          }

          // Assets summary
          if (assetRes.downloaded > 0 || assetRes.skipped > 0) {
            successLines.push({
              type: 'success',
              content: dryRun
                ? `✓ Dry run: ${assetRes.downloaded} asset${assetRes.downloaded === 1 ? '' : 's'}`
                : `✓ Downloaded ${assetRes.downloaded} asset${assetRes.downloaded === 1 ? '' : 's'}${assetRes.skipped > 0 ? `, ${assetRes.skipped} up-to-date` : ''}`
            });

            // Show downloaded assets (limit to 5)
            const downloadedAssets = assetRes.assets.filter(a => a.action === 'downloaded');
            const showCount = Math.min(downloadedAssets.length, 5);
            for (let i = 0; i < showCount; i++) {
              successLines.push({
                type: 'info',
                content: `  + assets/${downloadedAssets[i].filename}`,
                color: 'dim'
              });
            }
            if (downloadedAssets.length > 5) {
              successLines.push({
                type: 'info',
                content: `  ... and ${downloadedAssets.length - 5} more`,
                color: 'dim'
              });
            }
          } else if (assetRes.total > 0 && assetRes.downloaded === 0) {
            successLines.push({
              type: 'info',
              content: `✓ All ${assetRes.total} assets up-to-date`,
              color: 'dim'
            });
          }

          if (successLines.length === 0) {
            successLines.push({
              type: 'info',
              content: 'Nothing to pull',
              color: 'yellow'
            });
          }

          addToHistory(successLines);
        }
        setScreen('success');
      } else {
        if (addToHistory) {
          const errorLines: HistoryEntry[] = [
            { type: 'error', content: '✗ Pull failed' }
          ];

          for (const err of [...result.errors, ...assetRes.errors]) {
            errorLines.push({
              type: 'info',
              content: `  ${err}`,
              color: 'dim'
            });
          }

          addToHistory(errorLines);
        }
        setScreen('error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      if (addToHistory) {
        addToHistory({
          type: 'error',
          content: `✗ ${errorMsg}`
        });
      }

      setError(errorMsg);
      setScreen('error');
    }
  };

  // Auto-exit after showing result
  useEffect(() => {
    if (screen === 'success' || screen === 'error') {
      const timer = setTimeout(() => {
        if (onExit) onExit();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [screen, onExit]);

  const renderProgress = () => {
    if (progress.total === 0) return null;
    const percent = Math.round((progress.current / progress.total) * 100);
    return (
      <Box marginTop={1}>
        <ProgressBar progress={percent} width={40} />
        <Text dimColor> {progress.current}/{progress.total}</Text>
        {progress.detail && <Text dimColor> {progress.detail}</Text>}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Logo directory={directory} userEmail={userEmail} />

      {/* Session History */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            const uniqueKey = `history-${index}-${entry.type}-${entry.content.slice(0, 20)}`;

            if (entry.type === 'success') {
              const hasCheckmark = entry.content.startsWith('✓ ');
              if (hasCheckmark) {
                const text = entry.content.substring(2);
                return (
                  <Box key={uniqueKey}>
                    <Text color="green">✓ </Text>
                    <Text>{text}</Text>
                  </Box>
                );
              }
              return <Box key={uniqueKey}><Text color="green">{entry.content}</Text></Box>;
            } else if (entry.type === 'spinner') {
              return (
                <Box key={uniqueKey}>
                  <Spinner type="dots" color="cyan" message={entry.content} />
                </Box>
              );
            } else if (entry.type === 'error') {
              return <Box key={uniqueKey}><Text color="red">{entry.content}</Text></Box>;
            } else {
              const needsTopMargin = entry.spinnerId === 'command-separator';
              return (
                <Box key={uniqueKey} marginTop={needsTopMargin ? 1 : 0}>
                  <Text color={entry.color === 'dim' ? undefined : entry.color} dimColor={entry.color === 'dim'}>
                    {entry.content}
                  </Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Command indicator */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>❯ </Text>
          <Text dimColor>/site pull{dryRun ? ' --dry-run' : ''}{force ? ' --force' : ''}</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {dryRun && screen !== 'success' && screen !== 'error' && screen !== 'preview' && (
          <Box marginBottom={1}>
            <Text color="yellow">Dry run mode: No files will be written</Text>
          </Box>
        )}

        {screen === 'loading' && (
          <Spinner type="dots" color="cyan" message="Fetching pages from server..." />
        )}

        {screen === 'preview' && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Found <Text color="cyan">{newPages.length + existingPages.length}</Text> page{newPages.length + existingPages.length === 1 ? '' : 's'} on server:</Text>
            </Box>

            {/* Show existing pages that will be overwritten */}
            {existingPages.length > 0 && (
              <>
                <Box marginBottom={1}>
                  <Text color="yellow">Pages that will be overwritten:</Text>
                </Box>
                {existingPages.map((page, i) => (
                  <Box key={`existing-${i}`} paddingLeft={2}>
                    <Text color="yellow">~ {page.file}</Text>
                    <Text dimColor> ({page.slug})</Text>
                  </Box>
                ))}
              </>
            )}

            {/* Show new pages that will be created */}
            {newPages.length > 0 && (
              <>
                <Box marginTop={existingPages.length > 0 ? 1 : 0} marginBottom={1}>
                  <Text>New pages to create:</Text>
                </Box>
                {newPages.map((page, i) => (
                  <Box key={`new-${i}`} paddingLeft={2}>
                    <Text color="green">+ {page.file}</Text>
                    <Text dimColor> ({page.slug})</Text>
                  </Box>
                ))}
              </>
            )}

            {/* Show assets summary */}
            {(assetsToDownload > 0 || assetsUpToDate > 0) && (
              <Box marginTop={1} flexDirection="column">
                <Text>Assets:</Text>
                <Box paddingLeft={2}>
                  {assetsToDownload > 0 && (
                    <Text color="green">+ {assetsToDownload} to download ({formatBytes(totalDownloadSize)})</Text>
                  )}
                  {assetsToDownload > 0 && assetsUpToDate > 0 && <Text dimColor>, </Text>}
                  {assetsUpToDate > 0 && (
                    <Text dimColor>{assetsUpToDate} up-to-date</Text>
                  )}
                </Box>
              </Box>
            )}

            <Box marginTop={1}>
              <Text>
                <Text color="cyan">Continue with pull?</Text>
                {' '}
                <Text dimColor>(y/n)</Text>
              </Text>
            </Box>
          </Box>
        )}

        {screen === 'pulling-pages' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message="Pulling pages..." />
            {renderProgress()}
          </Box>
        )}

        {screen === 'pulling-assets' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message={progress.detail ? `Downloading ${progress.detail}...` : 'Downloading assets...'} />
            {renderProgress()}
          </Box>
        )}

        {/* Success/error shown via history, just show returning message */}
        {(screen === 'success' || screen === 'error') && (
          <Box marginTop={1}>
            <Text dimColor>Returning to menu...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
