import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { loadCredentials } from '../lib/shared/auth.js';
import { SSO_BASE_URL } from '../lib/shared/config.js';
import type { HistoryEntry } from '../components/App.js';
import type { ThemePack, ThemePackListResponse, ThemePackDeleteResponse } from '../types/index.js';

type DeleteState =
  | 'loading'
  | 'selecting'
  | 'confirming'
  | 'deleting'
  | 'success'
  | 'error';

interface DeleteScreenProps {
  themeName?: string;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

/**
 * DeleteScreen Component
 * Handles theme pack deletion with Ink UI
 */
export const DeleteScreen: React.FC<DeleteScreenProps> = ({
  themeName,
  onExit,
  sessionHistory: externalHistory,
  addToHistory: externalAddToHistory,
  removeFromHistory: externalRemoveFromHistory
}) => {
  const [state, setState] = useState<DeleteState>('loading');
  const [themePacks, setThemePacks] = useState<ThemePack[]>([]);
  const [selectedThemePack, setSelectedThemePack] = useState<ThemePack | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

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

  // Fetch theme packs on mount
  useEffect(() => {
    const fetchThemePacks = async () => {
      try {
        const credentials = await loadCredentials();
        if (!credentials) {
          setError('Not authenticated. Run: oaysus login');
          setState('error');
          return;
        }

        if (addToHistory) {
          addToHistory({
            type: 'spinner',
            content: 'Fetching your theme packs...',
            spinnerId: 'fetching'
          });
        }

        const response = await axios.get<ThemePackListResponse>(
          `${SSO_BASE_URL}/sso/cli/theme-packs`,
          {
            headers: { Authorization: `Bearer ${credentials.jwt}` },
            params: { websiteId: credentials.websiteId }
          }
        );

        if (removeFromHistory) {
          removeFromHistory('fetching');
        }

        if (response.data.success && response.data.themePacks) {
          const packs = response.data.themePacks;

          if (packs.length === 0) {
            if (addToHistory) {
              addToHistory({
                type: 'info',
                content: 'No theme packs found for this website'
              });
            }
            setTimeout(() => onExit?.(), 1500);
            return;
          }

          setThemePacks(packs);

          if (addToHistory) {
            addToHistory({
              type: 'success',
              content: `Found ${packs.length} theme pack(s)`
            });
          }

          // If theme name provided, find it
          if (themeName) {
            const found = packs.find(
              tp => tp.name.toLowerCase() === themeName.toLowerCase()
            );
            if (found) {
              setSelectedThemePack(found);
              setState('confirming');
            } else {
              setError(`Theme pack "${themeName}" not found`);
              setState('error');
            }
          } else {
            setState('selecting');
          }
        } else {
          throw new Error(response.data.error || 'Failed to fetch theme packs');
        }
      } catch (err) {
        if (removeFromHistory) {
          removeFromHistory('fetching');
        }
        const message = err instanceof Error ? err.message : 'Failed to fetch theme packs';
        setError(message);
        setState('error');
      }
    };

    if (isLoaded) {
      fetchThemePacks();
    }
  }, [isLoaded]);

  // Handle theme pack selection
  const handleSelect = (item: { value: string; label: string }) => {
    const selected = themePacks.find(tp => tp.id === item.value);
    if (selected) {
      setSelectedThemePack(selected);
      setState('confirming');
    }
  };

  // Handle confirmation text submission
  const handleConfirmSubmit = async () => {
    if (!selectedThemePack) return;

    if (confirmText !== selectedThemePack.name) {
      setError('Name does not match. Deletion cancelled.');
      if (addToHistory) {
        addToHistory({
          type: 'error',
          content: 'Deletion cancelled - name did not match'
        });
      }
      setTimeout(() => onExit?.(), 1500);
      return;
    }

    setState('deleting');

    if (addToHistory) {
      addToHistory({
        type: 'spinner',
        content: `Deleting ${selectedThemePack.name}...`,
        spinnerId: 'deleting'
      });
    }

    try {
      const credentials = await loadCredentials();
      if (!credentials) throw new Error('Not authenticated');

      const response = await axios.delete<ThemePackDeleteResponse>(
        `${SSO_BASE_URL}/sso/cli/theme-packs/${selectedThemePack.id}`,
        {
          headers: { Authorization: `Bearer ${credentials.jwt}` },
          params: { force: selectedThemePack.installationCount > 0 }
        }
      );

      if (removeFromHistory) {
        removeFromHistory('deleting');
      }

      if (response.data.success) {
        if (addToHistory) {
          addToHistory({
            type: 'success',
            content: `Deleted ${selectedThemePack.name}`
          });
        }
        setState('success');
        setTimeout(() => onExit?.(), 1500);
      } else {
        throw new Error(response.data.error || 'Failed to delete');
      }
    } catch (err) {
      if (removeFromHistory) {
        removeFromHistory('deleting');
      }
      const message = err instanceof Error ? err.message : 'Failed to delete theme pack';
      setError(message);
      if (addToHistory) {
        addToHistory({
          type: 'error',
          content: `Failed to delete: ${message}`
        });
      }
      setState('error');
      setTimeout(() => onExit?.(), 2000);
    }
  };

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (addToHistory) {
        addToHistory({
          type: 'info',
          content: 'Delete cancelled'
        });
      }
      onExit?.();
    }
  });

  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* Session History */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            const key = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'spinner') {
              return (
                <Box key={key}>
                  <Spinner type="dots" color="cyan" message={entry.content} />
                </Box>
              );
            } else if (entry.type === 'success') {
              return (
                <Box key={key}>
                  <Text color="green">{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'error') {
              return (
                <Box key={key}>
                  <Text color="red">{entry.content}</Text>
                </Box>
              );
            }
            return (
              <Box key={key}>
                <Text color={entry.color}>{entry.content}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Command indicator */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>{'>'} </Text>
          <Text dimColor>/delete</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {/* Loading State */}
        {state === 'loading' && (
          <Box>
            <Spinner type="dots" color="cyan" message="Loading..." />
          </Box>
        )}

        {/* Selection State */}
        {state === 'selecting' && themePacks.length > 0 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Select a theme pack to delete:</Text>
            </Box>
            <Box>
              <SelectInput
                items={themePacks.map(tp => ({
                  label: `${tp.displayName || tp.name} (${tp.componentCount} ${tp.componentCount === 1 ? 'component' : 'components'}, v${tp.version})${tp.installationCount > 0 ? ` [${tp.installationCount} ${tp.installationCount === 1 ? 'installation' : 'installations'}]` : ''}`,
                  value: tp.id
                }))}
                onSelect={handleSelect}
                limit={themePacks.length}
              />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Use arrow keys to navigate, Enter to select, Esc to cancel</Text>
            </Box>
          </Box>
        )}

        {/* Confirmation State */}
        {state === 'confirming' && selectedThemePack && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="red" bold>WARNING: This action cannot be undone!</Text>
            </Box>
            <Box marginBottom={1}>
              <Text>Theme Pack: </Text>
              <Text bold>{selectedThemePack.displayName || selectedThemePack.name}</Text>
            </Box>
            <Box marginBottom={1}>
              <Text dimColor>Version: {selectedThemePack.version} | Components: {selectedThemePack.componentCount}</Text>
            </Box>
            {selectedThemePack.installationCount > 0 && (
              <Box marginBottom={1}>
                <Text color="yellow">Installed on {selectedThemePack.installationCount} website(s) - will be removed</Text>
              </Box>
            )}
            <Box marginBottom={1}>
              <Text>Type "</Text>
              <Text bold color="red">{selectedThemePack.name}</Text>
              <Text>" to confirm deletion:</Text>
            </Box>
            <Box>
              <Text color="cyan">{'>'} </Text>
              <TextInput
                value={confirmText}
                onChange={setConfirmText}
                onSubmit={handleConfirmSubmit}
              />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Enter to confirm, Esc to cancel</Text>
            </Box>
          </Box>
        )}

        {/* Error State */}
        {state === 'error' && (
          <Box flexDirection="column">
            <Text color="red">{error}</Text>
            <Box marginTop={1}>
              <Text dimColor>Returning to menu...</Text>
            </Box>
          </Box>
        )}

        {/* Success State */}
        {state === 'success' && selectedThemePack && (
          <Box flexDirection="column">
            <Text color="green" bold>Theme pack deleted successfully!</Text>
            <Box marginTop={1}>
              <Text dimColor>Returning to menu...</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DeleteScreen;
