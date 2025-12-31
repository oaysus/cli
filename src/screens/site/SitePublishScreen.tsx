import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import { Logo } from '../../components/Logo.js';
import { Spinner } from '../../components/Spinner.js';
import { ProgressBar } from '../../components/ProgressBar.js';
import {
  loadProject,
  publishProject,
  publishSinglePage,
  checkExistingPages,
} from '../../lib/site/index.js';
import type { PublishResult, LoadedProject } from '../../types/site.js';
import { loadCredentials } from '../../lib/shared/auth.js';
import { HistoryEntry } from '../../components/App.js';

interface Props {
  projectPath?: string;
  pageFile?: string;
  dryRun?: boolean;
  skipConfirm?: boolean;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

type Screen = 'loading' | 'confirm' | 'validating' | 'uploading-assets' | 'publishing' | 'success' | 'error';

export function SitePublishScreen({
  projectPath = '.',
  pageFile,
  dryRun = false,
  skipConfirm = false,
  onExit,
  sessionHistory: externalHistory,
  addToHistory: externalAddToHistory,
  removeFromHistory: externalRemoveFromHistory
}: Props) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string>('');
  const [directory] = useState(path.resolve(projectPath));
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, detail: '' });

  // Confirmation state
  const [loadedProject, setLoadedProject] = useState<LoadedProject | null>(null);
  const [existingPages, setExistingPages] = useState<string[]>([]);
  const [newPages, setNewPages] = useState<string[]>([]);

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

  // Handle confirmation input
  useInput((input, key) => {
    if (screen === 'confirm') {
      if (input === 'y' || input === 'Y') {
        runPublish();
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

  // Load project and check for existing pages
  useEffect(() => {
    const loadAndCheck = async () => {
      // Add command to history
      if (addToHistory) {
        const cmdText = dryRun ? '/site publish --dry-run' : '/site publish';
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
            content: 'Loading website project...',
            spinnerId: 'loading'
          });
        }

        // Load project
        setScreen('loading');
        const project = await loadProject(projectPath);

        if (project.errors.length > 0 && project.pages.length === 0) {
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

        setLoadedProject(project);

        // Check which pages already exist
        const { existingPages: existing, newPages: newP } = await checkExistingPages(project);

        if (removeFromHistory) {
          removeFromHistory('loading');
        }

        setExistingPages(existing);
        setNewPages(newP);

        // If there are existing pages and skipConfirm is false, show confirmation
        if (existing.length > 0 && !skipConfirm) {
          setScreen('confirm');
        } else {
          // No existing pages or skipConfirm is true, proceed directly
          runPublishWithProject(project);
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

    loadAndCheck();
  }, [projectPath, pageFile, dryRun]);

  // Run publish after confirmation
  const runPublish = () => {
    if (loadedProject) {
      runPublishWithProject(loadedProject);
    }
  };

  // Run publish with a loaded project
  const runPublishWithProject = async (project: LoadedProject) => {
    try {
      // Progress callback
      const onProgress = (
        stage: 'validating' | 'uploading-assets' | 'publishing-pages',
        current: number,
        total: number,
        detail?: string
      ) => {
        if (stage === 'validating') {
          setScreen('validating');
        } else if (stage === 'uploading-assets') {
          setScreen('uploading-assets');
        } else if (stage === 'publishing-pages') {
          setScreen('publishing');
        }
        setProgress({ current, total, detail: detail || '' });
      };

      // Publish
      let result: PublishResult;

      if (pageFile) {
        // Publish single page
        result = await publishSinglePage(project, pageFile, { onProgress });
      } else {
        // Publish all pages
        result = await publishProject(project, { dryRun, onProgress });
      }

      setPublishResult(result);

      if (result.success) {
        if (addToHistory) {
          const successLines: HistoryEntry[] = [
            {
              type: 'success',
              content: dryRun ? '✓ Dry run complete!' : '✓ Publishing complete!'
            }
          ];

          if (result.assetsUploaded > 0) {
            successLines.push({
              type: 'info',
              content: `  Assets uploaded: ${result.assetsUploaded}`,
              color: 'dim'
            });
          }

          if (result.created > 0) {
            successLines.push({
              type: 'info',
              content: `  Pages created: ${result.created}`,
              color: 'dim'
            });
          }

          if (result.updated > 0) {
            successLines.push({
              type: 'info',
              content: `  Pages updated: ${result.updated}`,
              color: 'dim'
            });
          }

          addToHistory(successLines);
        }
        setScreen('success');
      } else {
        if (addToHistory) {
          const errorLines: HistoryEntry[] = [
            { type: 'error', content: '✗ Publishing failed' }
          ];

          for (const page of result.pages) {
            if (page.error) {
              errorLines.push({
                type: 'info',
                content: `  ${page.slug}: ${page.error}`,
                color: 'dim'
              });
            }
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
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

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
          <Text dimColor>/site publish{dryRun ? ' --dry-run' : ''}</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {dryRun && screen !== 'success' && screen !== 'error' && screen !== 'confirm' && (
          <Box marginBottom={1}>
            <Text color="yellow">Dry run mode: No changes will be made</Text>
          </Box>
        )}

        {screen === 'loading' && (
          <Spinner type="dots" color="cyan" message="Loading website project..." />
        )}

        {screen === 'confirm' && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="yellow">⚠ Warning: The following pages already exist and will be overwritten:</Text>
            </Box>
            {existingPages.map((slug, i) => (
              <Box key={i} paddingLeft={2}>
                <Text color="yellow">• {slug}</Text>
              </Box>
            ))}
            {newPages.length > 0 && (
              <>
                <Box marginTop={1} marginBottom={1}>
                  <Text>New pages to create:</Text>
                </Box>
                {newPages.map((slug, i) => (
                  <Box key={i} paddingLeft={2}>
                    <Text color="green">+ {slug}</Text>
                  </Box>
                ))}
              </>
            )}
            <Box marginTop={1}>
              <Text>
                <Text color="cyan">Continue with publish?</Text>
                {' '}
                <Text dimColor>(y/n)</Text>
              </Text>
            </Box>
          </Box>
        )}

        {screen === 'validating' && (
          <Spinner type="dots" color="cyan" message="Validating pages..." />
        )}

        {screen === 'uploading-assets' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message="Uploading assets..." />
            {renderProgress()}
          </Box>
        )}

        {screen === 'publishing' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message="Publishing pages..." />
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
