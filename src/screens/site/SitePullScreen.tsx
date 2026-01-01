import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import { Logo } from '../../components/Logo.js';
import { Spinner } from '../../components/Spinner.js';
import { ProgressBar } from '../../components/ProgressBar.js';
import { loadProject } from '../../lib/site/index.js';
import { pullPages, previewPull, PullResult, PullPreviewPage } from '../../lib/site/page-puller.js';
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

type Screen = 'loading' | 'preview' | 'pulling' | 'success' | 'error';

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
  const [error, setError] = useState<string>('');
  const [directory] = useState(path.resolve(projectPath));
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, detail: '' });

  // Preview state
  const [newPages, setNewPages] = useState<PullPreviewPage[]>([]);
  const [existingPages, setExistingPages] = useState<PullPreviewPage[]>([]);
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

        if (preview.pages.length === 0) {
          if (addToHistory) {
            addToHistory({
              type: 'info',
              content: 'No pages found on server',
              color: 'yellow'
            });
          }
          setScreen('success');
          return;
        }

        setNewPages(preview.newPages);
        setExistingPages(preview.existingPages);

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
      setScreen('pulling');

      // Progress callback
      const onProgress = (
        stage: 'fetching' | 'writing',
        current: number,
        total: number,
        detail?: string
      ) => {
        setProgress({ current, total, detail: detail || '' });
      };

      // Run pull with force since user confirmed (or force flag was set)
      const result = await pullPages({
        projectPath: projPath,
        config,
        force: true,
        dryRun,
        onProgress,
      });

      setPullResult(result);

      if (result.success) {
        if (addToHistory) {
          const successLines: HistoryEntry[] = [];

          successLines.push({
            type: 'success',
            content: dryRun
              ? `✓ Dry run complete!`
              : `✓ Pulled ${result.written} page${result.written === 1 ? '' : 's'}`
          });

          if (result.written > 0) {
            for (const page of result.pages) {
              if (page.action === 'created' || page.action === 'updated') {
                const icon = page.action === 'created' ? '+' : '~';
                successLines.push({
                  type: 'info',
                  content: `  ${icon} ${page.file} (${page.slug})`,
                  color: 'dim'
                });
              }
            }
          }

          addToHistory(successLines);
        }
        setScreen('success');
      } else {
        if (addToHistory) {
          const errorLines: HistoryEntry[] = [
            { type: 'error', content: '✗ Pull failed' }
          ];

          for (const err of result.errors) {
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

            <Box marginTop={1}>
              <Text>
                <Text color="cyan">Continue with pull?</Text>
                {' '}
                <Text dimColor>(y/n)</Text>
              </Text>
            </Box>
          </Box>
        )}

        {screen === 'pulling' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message="Writing pages to disk..." />
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
