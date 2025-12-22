import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { Logo } from '../components/Logo.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { loadCredentials } from '../lib/shared/auth.js';
import type { Credentials } from '../types/index.js';
import { HistoryEntry } from '../components/App.js';

interface WhoamiScreenProps {
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
}

/**
 * WhoamiScreen Component
 * Displays current user information in chat history format
 */
export const WhoamiScreen: React.FC<WhoamiScreenProps> = ({ onExit, sessionHistory = [], addToHistory }) => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusDisplayed, setStatusDisplayed] = useState(false);
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());
  const hasAddedToHistory = React.useRef(false);

  // Destructure for easier access
  const { version, userEmail, isLoaded } = appData;

  // Load version and credentials on mount
  useEffect(() => {
    const loadAllData = async () => {
      // Load all data in parallel
      const [versionData, credsData] = await Promise.all([
        // Load version
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
        // Load credentials
        loadCredentials()
      ]);

      // Single state update to prevent multiple renders
      setAppData({
        version: versionData,
        userEmail: credsData?.email || null,
        isLoaded: true
      });

      try {
        if (!credsData) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        // Check if token expired
        const expiresAt = new Date(credsData.expiresAt);
        const now = new Date();
        const isExpired = expiresAt <= now;

        if (isExpired) {
          setError('Token expired');
          setLoading(false);
          return;
        }

        // Calculate time until expiry
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const daysUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24));
        const hoursUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const expiryInfo = `${daysUntilExpiry}d ${hoursUntilExpiry}h`;

        setCredentials(credsData);

        // Add status information to history immediately (only once)
        if (addToHistory && !hasAddedToHistory.current) {
          hasAddedToHistory.current = true;
          const statusEntries: HistoryEntry[] = [
            { type: 'info', content: '✓ Authenticated' },
            { type: 'info', content: `Email: ${credsData.email}` }
          ];

          // Add website: customDomain (preferred), subdomain, name, or ID as fallback
          if (credsData.customDomain) {
            statusEntries.push({ type: 'info', content: `Website: ${credsData.customDomain}` });
          } else if (credsData.subdomain) {
            statusEntries.push({ type: 'info', content: `Website: ${credsData.subdomain}.myoaysus.com` });
          } else if (credsData.websiteName) {
            statusEntries.push({ type: 'info', content: `Website: ${credsData.websiteName}` });
          } else {
            statusEntries.push({ type: 'info', content: `Website ID: ${credsData.websiteId}` });
          }

          // Add token expiry
          statusEntries.push({ type: 'info', content: `Token expires in: ${expiryInfo}` });

          addToHistory(statusEntries);
        }

        // Mark status as displayed and loading as complete
        setLoading(false);
        setStatusDisplayed(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load credentials'
        );
        setLoading(false);
      }
    };

    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-exit after displaying info
  useEffect(() => {
    if (statusDisplayed || error) {
      const timeout = setTimeout(() => {
        onExit?.();
      }, 2000); // 2 seconds to allow user to read the info

      return () => clearTimeout(timeout);
    }
  }, [statusDisplayed, error, onExit]);

  // Calculate expiry info for display
  const getExpiryDisplay = () => {
    if (!credentials) return '';
    const expiresAt = new Date(credentials.expiresAt);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24));
    const hoursUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${daysUntilExpiry}d ${hoursUntilExpiry}h`;
  };

  // Don't render until data is loaded to prevent double rendering
  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* Session History - Shows status information (for interactive mode) */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            if (entry.type === 'info') {
              return (
                <Box key={index}>
                  <Text dimColor>{entry.content}</Text>
                </Box>
              );
            }
            return null;
          })}
        </Box>
      )}

      {/* Command indicator showing active command */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>❯ </Text>
          <Text dimColor>/whoami</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {loading && (
          <Box>
            <Text dimColor>Loading user information...</Text>
          </Box>
        )}

        {error && (
          <ErrorMessage
            message={error}
            suggestion="Run '/login' to authenticate"
          />
        )}

        {/* Display status info directly (for standalone mode) */}
        {!loading && !error && credentials && sessionHistory.length === 0 && (
          <Box flexDirection="column">
            <Box>
              <Text dimColor>✓ Authenticated</Text>
            </Box>
            <Box>
              <Text dimColor>Email: {credentials.email}</Text>
            </Box>
            {/* Show customDomain (preferred), subdomain, then name, then ID */}
            {credentials.customDomain && (
              <Box>
                <Text dimColor>Website: {credentials.customDomain}</Text>
              </Box>
            )}
            {!credentials.customDomain && credentials.subdomain && (
              <Box>
                <Text dimColor>Website: {credentials.subdomain}.myoaysus.com</Text>
              </Box>
            )}
            {!credentials.customDomain && !credentials.subdomain && credentials.websiteName && (
              <Box>
                <Text dimColor>Website: {credentials.websiteName}</Text>
              </Box>
            )}
            {!credentials.customDomain && !credentials.subdomain && !credentials.websiteName && (
              <Box>
                <Text dimColor>Website ID: {credentials.websiteId}</Text>
              </Box>
            )}
            <Box>
              <Text dimColor>Token expires in: {getExpiryDisplay()}</Text>
            </Box>
          </Box>
        )}

        {!loading && !error && credentials && sessionHistory.length > 0 && (
          <Box>
            <Text dimColor>Returning to menu...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default WhoamiScreen;
