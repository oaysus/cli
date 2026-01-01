import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import fs from 'fs/promises';
import { Logo } from '../../components/Logo.js';
import { Spinner } from '../../components/Spinner.js';
import { loadCredentials } from '../../lib/shared/auth.js';
import { HistoryEntry } from '../../components/App.js';
import { initializeMetadata } from '../../lib/site/metadata.js';

interface Props {
  projectName?: string;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

type Screen = 'loading' | 'confirm' | 'generating' | 'success' | 'error';

export function SiteInitScreen({
  projectName: initialName,
  onExit,
  sessionHistory: externalHistory,
  addToHistory: externalAddToHistory,
  removeFromHistory: externalRemoveFromHistory
}: Props) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [projectName, setProjectName] = useState(initialName || '');
  const [websiteName, setWebsiteName] = useState<string>('');
  const [websiteId, setWebsiteId] = useState<string>('');
  const [subdomain, setSubdomain] = useState<string>('');
  const [jwt, setJwt] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [projectPath, setProjectPath] = useState<string>('');
  const [directory] = useState(process.cwd());
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
    const loadData = async () => {
      const creds = await loadCredentials();
      if (!creds) {
        setError('Not authenticated. Run: oaysus login');
        setScreen('error');
        return;
      }

      setUserEmail(creds.email);
      setWebsiteName(creds.websiteName || '');
      setWebsiteId(creds.websiteId || '');
      setSubdomain(creds.subdomain || '');
      setJwt(creds.jwt || '');

      // Use subdomain as folder name (already URL-safe)
      const folderName = initialName || creds.subdomain || 'my-website';
      setProjectName(folderName);
      setScreen('confirm');
    };
    loadData();
  }, [initialName]);

  // Auto-exit after success
  useEffect(() => {
    if (screen === 'success') {
      const timer = setTimeout(() => {
        if (onExit) onExit();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [screen, onExit]);

  // Handle cancellation
  const handleCancel = () => {
    if (onExit) onExit();
  };

  // Confirmation and escape handling
  useInput((input, key) => {
    if (screen === 'confirm') {
      if (input === 'y' || input === 'Y') {
        handleGenerate();
      } else if (input === 'n' || input === 'N' || key.escape) {
        handleCancel();
      }
    }
  });

  // Generate Project
  const handleGenerate = async () => {
    // Add command to history
    if (addToHistory) {
      addToHistory({
        type: 'info',
        content: '❯ /site init',
        color: 'cyan',
        spinnerId: sessionHistory.length > 0 ? 'command-separator' : undefined
      });
    }

    setScreen('generating');

    // Add spinner to history
    if (addToHistory) {
      addToHistory({
        type: 'spinner',
        content: `Creating website project "${projectName}"...`,
        spinnerId: 'generating'
      });
    }

    const targetPath = path.join(process.cwd(), projectName);

    try {
      // Check if directory exists
      try {
        await fs.access(targetPath);
        if (removeFromHistory) {
          removeFromHistory('generating');
        }
        if (addToHistory) {
          addToHistory({
            type: 'error',
            content: `✗ Directory "${projectName}" already exists`
          });
        }
        setError(`Directory "${projectName}" already exists`);
        setScreen('error');
        return;
      } catch {
        // Directory doesn't exist, continue
      }

      // Create directory structure
      await fs.mkdir(targetPath, { recursive: true });
      await fs.mkdir(path.join(targetPath, 'pages'), { recursive: true });
      await fs.mkdir(path.join(targetPath, 'assets'), { recursive: true });

      // Initialize .oaysus/ metadata (config.json, components.json, assets.json)
      const initResult = await initializeMetadata({
        projectPath: targetPath,
        websiteId,
        websiteName,
        subdomain,
        syncComponents: true,
        jwt,
      });

      if (!initResult.success) {
        if (removeFromHistory) {
          removeFromHistory('generating');
        }
        if (addToHistory) {
          addToHistory({
            type: 'error',
            content: `✗ Failed to initialize project: ${initResult.error}`
          });
        }
        setError(initResult.error || 'Failed to initialize project');
        setScreen('error');
        return;
      }

      // Create sample home page (empty components - user adds their installed components)
      const homePage = {
        slug: '/',
        title: 'Home',
        description: 'Welcome to our website',
        isHomePage: true,
        components: [],
        settings: {
          seo: {
            metaTitle: `Home | ${websiteName}`,
            metaDescription: 'Welcome to our website'
          }
        }
      };
      await fs.writeFile(
        path.join(targetPath, 'pages', 'home.json'),
        JSON.stringify(homePage, null, 2)
      );

      // Create .gitkeep in assets
      await fs.writeFile(path.join(targetPath, 'assets', '.gitkeep'), '');

      // Remove spinner and add success
      if (removeFromHistory) {
        removeFromHistory('generating');
      }
      if (addToHistory) {
        addToHistory([
          {
            type: 'success',
            content: `✓ Created website project "${projectName}"`
          },
          {
            type: 'info',
            content: `  Location: ${targetPath}`,
            color: 'dim'
          },
          {
            type: 'info',
            content: `  Next: cd ${projectName} && oaysus site validate`,
            color: 'dim'
          }
        ]);
      }

      setProjectPath(targetPath);
      setScreen('success');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';

      if (removeFromHistory) {
        removeFromHistory('generating');
      }
      if (addToHistory) {
        addToHistory({
          type: 'error',
          content: `✗ Failed to create project: ${errorMsg}`
        });
      }

      setError(errorMsg);
      setScreen('error');
    }
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
          <Text dimColor>/site init</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {screen === 'loading' && (
          <Spinner type="dots" color="cyan" message="Loading website info..." />
        )}

        {screen === 'confirm' && (
          <Box flexDirection="column">
            <Text>Ready to create your website project?</Text>
            <Box marginTop={1} flexDirection="column" paddingLeft={2}>
              <Text><Text color="gray">Website:</Text> {websiteName}</Text>
              <Text><Text color="gray">Folder:</Text> {projectName}/</Text>
              <Text><Text color="gray">Location:</Text> {path.join(directory, projectName)}</Text>
            </Box>
            <Box marginTop={1} flexDirection="column" paddingLeft={2}>
              <Text dimColor>Structure:</Text>
              <Text dimColor>  {projectName}/</Text>
              <Text dimColor>  ├── .oaysus/</Text>
              <Text dimColor>  │   ├── config.json</Text>
              <Text dimColor>  │   ├── components.json</Text>
              <Text dimColor>  │   └── assets.json</Text>
              <Text dimColor>  ├── pages/</Text>
              <Text dimColor>  │   └── home.json</Text>
              <Text dimColor>  └── assets/</Text>
            </Box>
            <Box marginTop={1}>
              <Text>
                <Text color="cyan">Create project?</Text>
                {' '}
                <Text dimColor>(y/n)</Text>
              </Text>
            </Box>
          </Box>
        )}

        {/* Success/error are shown via history, just show returning message */}
        {(screen === 'success' || screen === 'error') && (
          <Box marginTop={1}>
            <Text dimColor>Returning to menu...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
