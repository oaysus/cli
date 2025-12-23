import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import {
  loadCredentials,
  getMyWebsites,
  updateCredentialsWebsite,
} from '../lib/shared/auth.js';
import type { Credentials, Website } from '../types/index.js';
import { HistoryEntry } from '../components/App.js';

type SwitchState =
  | 'loading'
  | 'selecting'
  | 'switching'
  | 'success'
  | 'error';

interface SwitchScreenProps {
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
}

/**
 * SwitchScreen Component
 * Allows users to switch between their websites
 */
export const SwitchScreen: React.FC<SwitchScreenProps> = ({ onExit, sessionHistory = [], addToHistory }) => {
  const [state, setState] = useState<SwitchState>('loading');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [error, setError] = useState('');
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

  // Destructure for easier access
  const { version, userEmail, isLoaded } = appData;

  // Handle escape key to cancel
  useInput((input, key) => {
    if (key.escape && state === 'selecting') {
      onExit?.();
    }
  });

  // Load version, credentials, and websites on mount
  useEffect(() => {
    const loadAllData = async () => {
      // Load version first
      let versionData = '0.1.0';
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const pkgPath = path.join(__dirname, '../../package.json');
        const pkgData = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgData);
        versionData = pkg.version;
      } catch {
        // Use default version
      }

      // Load credentials
      const credsData = await loadCredentials();

      setAppData({
        version: versionData,
        userEmail: credsData?.email || null,
        isLoaded: true
      });

      if (!credsData) {
        setError('Not authenticated');
        setState('error');
        return;
      }

      // Check if token expired
      const expiresAt = new Date(credsData.expiresAt);
      const now = new Date();
      if (expiresAt <= now) {
        setError('Token expired');
        setState('error');
        return;
      }

      setCredentials(credsData);

      // Fetch websites
      try {
        const websitesList = await getMyWebsites();

        if (!websitesList || websitesList.length === 0) {
          setError('No websites found for this account');
          setState('error');
          return;
        }

        if (websitesList.length === 1) {
          setError('You only have one website. No switch needed.');
          setState('error');
          return;
        }

        setWebsites(websitesList);
        setState('selecting');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch websites');
        setState('error');
      }
    };

    loadAllData();
  }, []);

  // Handle website selection
  const handleWebsiteSelect = async (item: { label: string; value: string }) => {
    const selected = websites.find(w => w.id === item.value);
    if (!selected) return;

    // Check if same website selected
    if (selected.id === credentials?.websiteId) {
      setError('Already on this website');
      setState('error');
      return;
    }

    setSelectedWebsite(selected);
    setState('switching');

    try {
      await updateCredentialsWebsite(
        selected.id,
        selected.name,
        selected.subdomain,
        selected.customDomain
      );

      // Add success message to history
      if (addToHistory) {
        addToHistory([
          { type: 'info', content: `Switched to: ${selected.name}` },
          { type: 'info', content: `Subdomain: ${selected.subdomain}.myoaysus.com` }
        ]);
      }

      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch website');
      setState('error');
    }
  };

  // Auto-exit after success or error
  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const timeout = setTimeout(() => {
        onExit?.();
      }, state === 'success' ? 1500 : 2000);

      return () => clearTimeout(timeout);
    }
  }, [state, onExit]);

  // Get display name for current website
  const getCurrentWebsiteDisplay = () => {
    if (!credentials) return 'Unknown';
    if (credentials.customDomain) return credentials.customDomain;
    if (credentials.subdomain) return `${credentials.subdomain}.myoaysus.com`;
    if (credentials.websiteName) return credentials.websiteName;
    return credentials.websiteId;
  };

  // Don't render until data is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* Command indicator */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>❯ </Text>
          <Text dimColor>/switch</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {/* Loading State */}
        {state === 'loading' && (
          <Box>
            <Spinner message="Loading your websites..." />
          </Box>
        )}

        {/* Selecting State */}
        {state === 'selecting' && websites.length > 0 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Current website: </Text>
              <Text color="cyan">{getCurrentWebsiteDisplay()}</Text>
            </Box>

            <Box marginBottom={1}>
              <Text>Select a website to switch to:</Text>
            </Box>

            <Box>
              <SelectInput
                items={websites.map(w => ({
                  label: w.id === credentials?.websiteId
                    ? `${w.name} (current)`
                    : w.name,
                  value: w.id
                }))}
                onSelect={handleWebsiteSelect}
              />
            </Box>

            <Box marginTop={1}>
              <Text dimColor>Use arrow keys to navigate, Enter to select, Esc to cancel</Text>
            </Box>
          </Box>
        )}

        {/* Switching State */}
        {state === 'switching' && selectedWebsite && (
          <Box>
            <Spinner message={`Switching to ${selectedWebsite.name}...`} />
          </Box>
        )}

        {/* Success State */}
        {state === 'success' && selectedWebsite && (
          <Box flexDirection="column">
            <Box>
              <Text color="green">✓ Switched to {selectedWebsite.name}</Text>
            </Box>
            <Box>
              <Text dimColor>Subdomain: {selectedWebsite.subdomain}.myoaysus.com</Text>
            </Box>
            {selectedWebsite.customDomain && (
              <Box>
                <Text dimColor>Domain: {selectedWebsite.customDomain}</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Error State */}
        {state === 'error' && (
          <ErrorMessage
            message={error}
            suggestion={error.includes('authenticated') || error.includes('expired')
              ? "Run '/login' to authenticate"
              : undefined
            }
          />
        )}
      </Box>
    </Box>
  );
};

export default SwitchScreen;
