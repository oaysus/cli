import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import {
  requestMagicLink,
  initializeDevice,
  pollForAuth,
  selectWebsite,
  saveCredentials,
  loadCredentials,
} from '../lib/shared/auth.js';
import type { Credentials, Website, DeviceStatusResponse } from '../types/index.js';
import { HistoryEntry } from '../components/App.js';

type LoginState =
  | 'email-input'
  | 'sending-link'
  | 'waiting-for-approval'
  | 'website-selection'
  | 'selecting-website'
  | 'waiting-for-jwt'
  | 'success'
  | 'error';

interface LoginScreenProps {
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
  removeFromHistory?: (spinnerId: string) => void;
}

/**
 * LoginScreen Component
 * Handles authentication flow with init-style UI
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onExit, sessionHistory = [], addToHistory, removeFromHistory }) => {
  const [state, setState] = useState<LoginState>('email-input');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [userCode, setUserCode] = useState('');
  const [websites, setWebsites] = useState<Website[]>([]);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState('');
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

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
    };

    loadAllData();
  }, []);

  // Auto-exit after success (immediate)
  useEffect(() => {
    if (state === 'success') {
      if (onExit) onExit();
    }
  }, [state, onExit]);

  // Email validation
  const validateEmail = (input: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  // Handle email submission
  const handleEmailSubmit = async (value: string) => {
    const emailInput = value.trim();

    if (!emailInput) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(emailInput)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmail(emailInput);
    setEmailError('');

    if (addToHistory) {
      // Add command with spacing if needed
      addToHistory({
        type: 'info',
        content: '❯ /login',
        color: 'cyan',
        spinnerId: sessionHistory.length > 0 ? 'command-separator' : undefined
      });
    }

    setState('sending-link');

    // Add spinner to history with email context
    if (addToHistory) {
      addToHistory({
        type: 'spinner',
        content: `Sending magic link to ${emailInput}...`,
        color: 'cyan',
        spinnerId: 'sending-link'
      });
    }

    try {
      // Initialize device authorization first
      const deviceResponse = await initializeDevice();
      setDeviceCode(deviceResponse.deviceCode);
      setUserCode(deviceResponse.userCode); // Keep for reference but won't display to user

      // Send magic link with device code embedded in URL
      await requestMagicLink(emailInput, deviceResponse.deviceCode);

      // Remove spinner and add success message
      if (removeFromHistory) {
        removeFromHistory('sending-link');
      }

      if (addToHistory) {
        addToHistory([
          {
            type: 'success',
            content: `✓ Magic link sent to ${emailInput}`
          },
          {
            type: 'progress',
            content: 'Waiting for email verification...',
            color: 'cyan',
            spinnerId: 'waiting-auth'
          }
        ]);
      }

      setState('waiting-for-approval');

      // Start polling - may return credentials or website selection request
      const result = await pollForAuth(deviceResponse.deviceCode, {
        interval: 2000,
        timeout: 600000,
      });

      // Check if result is DeviceStatusResponse with website selection needed
      if ('needsWebsiteSelection' in result && result.needsWebsiteSelection) {
        // Device approved - check if user has websites
        if (!result.websites || result.websites.length === 0) {
          // No websites found
          setError('No websites found for this account. Please create a website first.');

          if (addToHistory) {
            addToHistory({
              type: 'error',
              content: '✗ No websites found for this account'
            });
          }

          setTimeout(() => {
            if (onExit) onExit();
          }, 3000);

          setState('error');
          return;
        }

        // Has websites - proceed to selection
        setWebsites(result.websites);
        setState('website-selection');

        // Remove waiting spinner
        if (removeFromHistory) {
          removeFromHistory('waiting-auth');
        }
      } else {
        // Got credentials directly (shouldn't happen in new flow, but handle it)
        if (removeFromHistory) {
          removeFromHistory('waiting-auth');
        }

        const creds = result as Credentials;
        await saveCredentials(creds);
        setCredentials(creds);
        setState('success');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);

      // Remove any active spinners
      if (removeFromHistory) {
        removeFromHistory('sending-link');
        removeFromHistory('waiting-auth');
      }

      // Add error to session history
      if (addToHistory) {
        addToHistory({
          type: 'error',
          content: `✗ Authentication failed: ${errorMessage}`
        });
      }

      // Auto-return to menu after brief delay
      setTimeout(() => {
        if (onExit) onExit();
      }, 2000);

      setState('error');
    }
  };

  // Handle website selection
  const handleWebsiteSelect = async (item: { value: string; label: string }) => {
    // Safety check - if no item selected, ignore
    if (!item || !item.value) {
      return;
    }

    setState('selecting-website');

    // Add spinner for completing authentication with website context
    if (addToHistory) {
      addToHistory({
        type: 'spinner',
        content: `Completing authentication for ${item.label}...`,
        color: 'cyan',
        spinnerId: 'completing-auth'
      });
    }

    try {
      // Submit website selection
      await selectWebsite(deviceCode, item.value);

      setState('waiting-for-jwt');

      // Continue polling for JWT
      const result = await pollForAuth(deviceCode, {
        interval: 2000,
        timeout: 600000,
      });

      // Remove spinner
      if (removeFromHistory) {
        removeFromHistory('completing-auth');
      }

      // Should now get credentials with JWT
      if ('jwt' in result && result.jwt) {
        const creds = result as Credentials;
        await saveCredentials(creds);
        setCredentials(creds);

        // Add success messages to history
        if (addToHistory) {
          addToHistory([
            {
              type: 'success',
              content: `✓ Website selected - ${creds.websiteName || item.label}`
            },
            {
              type: 'success',
              content: `✓ Authenticated as ${creds.email}`
            }
          ]);
        }

        setState('success');
      } else {
        throw new Error('Failed to receive authentication token');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);

      // Remove spinner
      if (removeFromHistory) {
        removeFromHistory('completing-auth');
      }

      if (addToHistory) {
        addToHistory({
          type: 'error',
          content: `✗ Authentication failed: ${errorMessage}`
        });
      }

      setTimeout(() => {
        if (onExit) onExit();
      }, 2000);

      setState('error');
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (addToHistory) {
      addToHistory({
        type: 'info',
        content: 'Login cancelled, returned to menu'
      });
    }
    if (onExit) onExit();
  };

  // Handle countdown timer
  useEffect(() => {
    if (state !== 'waiting-for-approval') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const timeoutError = 'Authentication timeout - please try again';
          setError(timeoutError);

          // Remove waiting spinner and add timeout error to session history
          if (removeFromHistory) {
            removeFromHistory('waiting-auth');
          }

          if (addToHistory) {
            addToHistory({
              type: 'error',
              content: `✗ Authentication timeout - please try again`
            });
          }

          // Auto-return to menu after brief delay
          setTimeout(() => {
            if (onExit) onExit();
          }, 2000);

          setState('error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, addToHistory, onExit, removeFromHistory]);

  // Format countdown as MM:SS
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape && state === 'email-input') {
      handleCancel();
    }
  });

  // Don't render until data is loaded to prevent double rendering
  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* Session History - Shows accumulated selections */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            const isLastEntry = index === sessionHistory.length - 1;
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'prompt') {
              return (
                <Box key={uniqueKey}>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'response') {
              return (
                <Box key={uniqueKey} marginBottom={isLastEntry ? 0 : 1}>
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
              // Special handling for waiting-auth spinner to show live countdown
              if (entry.spinnerId === 'waiting-auth' && state === 'waiting-for-approval') {
                return (
                  <Box key={uniqueKey}>
                    <Spinner type="dots" color="cyan" message={`${entry.content} Expires in: ${formatCountdown(countdown)}`} />
                  </Box>
                );
              }
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
              const needsTopMargin = entry.spinnerId === 'command-separator';

              if (entry.color === 'dim') {
                return (
                  <Box key={uniqueKey} marginBottom={isLastEntry ? 0 : 1} marginTop={needsTopMargin ? 1 : 0}>
                    <Text dimColor>{entry.content}</Text>
                  </Box>
                );
              }

              return (
                <Box key={uniqueKey} marginBottom={isLastEntry ? 0 : 1} marginTop={needsTopMargin ? 1 : 0}>
                  <Text color={entry.color}>{entry.content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Command indicator showing active command */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>❯ </Text>
          <Text dimColor>/login</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {/* Email Input State */}
        {state === 'email-input' && (
          <Box flexDirection="column">
            <Box>
              <Text>Enter your email address </Text>
              <Text dimColor>(We'll send you a magic link)</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="cyan">&gt; </Text>
              <Text color="cyan">
                <TextInput
                  value={email}
                  onChange={setEmail}
                  onSubmit={handleEmailSubmit}
                  placeholder="you@example.com"
                />
              </Text>
            </Box>
            {emailError && (
              <Box marginTop={1}>
                <Text color="red">✗ {emailError}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>Press Enter to continue, Esc to cancel</Text>
            </Box>
          </Box>
        )}

        {/* Website Selection State */}
        {state === 'website-selection' && websites.length > 0 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Select a website to continue</Text>
            </Box>

            <Box>
              <SelectInput
                items={websites.map(w => ({
                  label: w.name,
                  value: w.id
                }))}
                onSelect={handleWebsiteSelect}
              />
            </Box>

            <Box marginTop={1}>
              <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
            </Box>
          </Box>
        )}


        {/* Error State */}
        {state === 'error' && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="red">✗ Authentication failed</Text>
            </Box>
            <Box marginBottom={1}>
              <Text dimColor>{error}</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Returning to menu...</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default LoginScreen;
