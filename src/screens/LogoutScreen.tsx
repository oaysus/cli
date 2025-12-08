import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { Logo } from '../components/Logo.js';
import { SuccessMessage } from '../components/SuccessMessage.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Spinner } from '../components/Spinner.js';
import { clearCredentials, loadCredentials } from '../lib/shared/auth.js';
import type { HistoryEntry } from '../components/App.js';

interface LogoutScreenProps {
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

/**
 * LogoutScreen Component
 * Handles user logout with visual feedback and history integration
 */
export const LogoutScreen: React.FC<LogoutScreenProps> = ({
  onExit,
  sessionHistory = [],
  addToHistory,
  removeFromHistory
}) => {
  const [email, setEmail] = useState('');
  const [websiteName, setWebsiteName] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

  // Standalone mode: maintain local history when external callbacks aren't available
  const isStandalone = !addToHistory;
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);

  // Unified history management
  const addEntry = (entry: HistoryEntry | HistoryEntry[]) => {
    if (addToHistory) {
      addToHistory(entry);
    } else {
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
      setLocalHistory(prev => prev.filter(entry => entry.spinnerId !== spinnerId));
    }
  };

  // Use appropriate history for rendering
  const displayHistory = isStandalone ? localHistory : sessionHistory;

  // Track if logout has already been initiated
  const hasLoggedOut = useRef(false);

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

  // Handle logout flow
  useEffect(() => {
    if (!isLoaded) return;
    if (hasLoggedOut.current) return;
    hasLoggedOut.current = true;

    const handleLogout = async () => {
      try {
        const credentials = await loadCredentials();

        // Log the command
        addEntry({
          type: 'info',
          content: '> /logout',
          color: 'cyan'
        });

        if (!credentials) {
          setError('Not currently logged in');
          addEntry({
            type: 'error',
            content: '✗ Not currently logged in',
            color: 'red'
          });
          setLoading(false);
          onExit?.();
          return;
        }

        setEmail(credentials.email);
        setWebsiteName(credentials.websiteName || '');

        // Clear credentials
        await clearCredentials();

        // Show success
        addEntry({
          type: 'success',
          content: `✓ Logged out from ${credentials.email}`,
          color: 'green'
        });

        setSuccess(true);
        setLoading(false);
        onExit?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Logout failed';
        setError(errorMessage);
        addEntry({
          type: 'error',
          content: `✗ ${errorMessage}`,
          color: 'red'
        });
        setLoading(false);
        onExit?.();
      }
    };

    handleLogout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Don't render until data is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* History - shows completed steps and current spinner */}
      {displayHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {displayHistory.map((entry, index) => {
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'spinner') {
              return (
                <Box key={uniqueKey}>
                  <Spinner type="dots" color="cyan" message={entry.content} />
                </Box>
              );
            } else if (entry.type === 'success') {
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
              return (
                <Box key={uniqueKey}>
                  <Text color="green">{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'error') {
              return (
                <Box key={uniqueKey}>
                  <Text color="red">{entry.content}</Text>
                </Box>
              );
            } else {
              // Info type
              const textColor = entry.color === 'dim' ? undefined : entry.color;
              const isDim = entry.color === 'dim';
              return (
                <Box key={uniqueKey}>
                  <Text color={textColor} dimColor={isDim}>{entry.content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Fallback UI for standalone mode without history */}
      {isStandalone && displayHistory.length === 0 && (
        <Box flexDirection="column" marginTop={1} paddingX={2}>
          {loading && (
            <Spinner message="Processing logout..." />
          )}

          {success && (
            <SuccessMessage
              message="Logged out successfully"
              details={[
                `Cleared credentials for ${email}`,
                ...(websiteName ? [`Session cleared for ${websiteName}`] : [])
              ]}
            />
          )}

          {error && !loading && (
            <ErrorMessage
              message={error}
              suggestion={
                error.includes('Not currently logged in')
                  ? 'No active session to clear'
                  : 'Please try again'
              }
            />
          )}
        </Box>
      )}

    </Box>
  );
};

export default LogoutScreen;
