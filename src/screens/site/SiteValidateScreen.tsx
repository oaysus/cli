import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { Logo } from '../../components/Logo.js';
import { Spinner } from '../../components/Spinner.js';
import { loadProject, validateProject, formatValidationResults } from '../../lib/site/index.js';
import type { SiteValidationResult } from '../../types/site.js';
import { loadCredentials } from '../../lib/shared/auth.js';
import { HistoryEntry } from '../../components/App.js';

interface Props {
  projectPath?: string;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

type Screen = 'loading' | 'validating' | 'success' | 'error';

export function SiteValidateScreen({
  projectPath = '.',
  onExit,
  sessionHistory: externalHistory,
  addToHistory: externalAddToHistory,
  removeFromHistory: externalRemoveFromHistory
}: Props) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [validationResult, setValidationResult] = useState<SiteValidationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [directory] = useState(path.resolve(projectPath));
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  useEffect(() => {
    const runValidation = async () => {
      // Add command to history
      if (addToHistory) {
        addToHistory({
          type: 'info',
          content: '❯ /site validate',
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

        // Remove loading, add validating
        if (removeFromHistory) {
          removeFromHistory('loading');
        }
        if (addToHistory) {
          addToHistory({
            type: 'spinner',
            content: 'Validating pages against installed components...',
            spinnerId: 'validating'
          });
        }

        // Validate project
        setScreen('validating');
        const result = await validateProject(project);

        // Remove validating spinner
        if (removeFromHistory) {
          removeFromHistory('validating');
        }

        setValidationResult(result);

        if (result.valid) {
          if (addToHistory) {
            addToHistory([
              {
                type: 'success',
                content: `✓ All ${result.pages.length} pages validated successfully`
              },
              ...(result.allAssets.length > 0 ? [{
                type: 'info' as const,
                content: `  Assets: ${result.allAssets.length}`,
                color: 'dim' as const
              }] : []),
              ...(result.totalWarnings > 0 ? [{
                type: 'info' as const,
                content: `  Warnings: ${result.totalWarnings}`,
                color: 'yellow' as const
              }] : [])
            ]);
          }
          setScreen('success');
        } else {
          if (addToHistory) {
            const errorLines: HistoryEntry[] = [
              { type: 'error', content: '✗ Validation failed', color: undefined, spinnerId: undefined }
            ];

            // Add page errors
            for (const page of result.pages) {
              if (!page.valid) {
                for (const err of page.errors) {
                  errorLines.push({
                    type: 'info',
                    content: `  ${page.pageFile}: ${err}`,
                    color: 'dim'
                  });
                }
              }
            }

            addToHistory(errorLines);
          }
          setScreen('error');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';

        if (removeFromHistory) {
          removeFromHistory('loading');
          removeFromHistory('validating');
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

    runValidation();
  }, [projectPath]);

  // Auto-exit after showing result
  useEffect(() => {
    if (screen === 'success' || screen === 'error') {
      const timer = setTimeout(() => {
        if (onExit) onExit();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [screen, onExit]);

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
          <Text dimColor>/site validate</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      {/* Success/error shown via history, just show returning message */}
      {(screen === 'success' || screen === 'error') && (
        <Box marginTop={1} paddingX={2}>
          <Text dimColor>Returning to menu...</Text>
        </Box>
      )}
    </Box>
  );
}
