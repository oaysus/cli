import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { SlashCommands } from '../components/SlashCommands.js';
import { getLastCommand } from '../lib/shared/command-history.js';
import { loadCredentials } from '../lib/shared/auth.js';
import { filterCommands } from '../lib/shared/commands.js';
import chalk from 'chalk';
import { HistoryEntry } from '../components/App.js';

type Screen =
  | { type: 'welcome' }
  // Theme pack commands
  | { type: 'theme-init'; projectName?: string }
  | { type: 'theme-create'; componentName?: string; projectPath?: string }
  | { type: 'theme-validate'; projectPath?: string; dryRun?: boolean }
  | { type: 'theme-push'; projectPath?: string }
  | { type: 'theme-delete'; themeName?: string }
  // Site commands
  | { type: 'site-init'; projectName?: string }
  | { type: 'site-validate'; projectPath?: string }
  | { type: 'site-publish'; projectPath?: string; pageFile?: string; dryRun?: boolean }
  | { type: 'site-pull'; projectPath?: string; force?: boolean; dryRun?: boolean }
  // Global commands
  | { type: 'login' }
  | { type: 'whoami' }
  | { type: 'logout' }
  | { type: 'switch' };

interface WelcomeScreenProps {
  onNavigate?: (screen: Screen) => void;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
}

/**
 * WelcomeScreen
 * Interactive CLI welcome screen displayed when running `oaysus` with no arguments
 * Shows logo, system info, persistent session history, command prompt, and accepts user input
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate, onExit, sessionHistory = [], addToHistory }) => {
  const [commandInput, setCommandInput] = React.useState('');
  const [lastCmd, setLastCmd] = React.useState<string | null>(null);
  const [showInput, setShowInput] = React.useState(true);
  const [slashMode, setSlashMode] = React.useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = React.useState(0);
  const [appData, setAppData] = React.useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = React.useState(process.cwd());

  // Destructure for easier access
  const { version, userEmail, isLoaded } = appData;

  // Load version, credentials, and last command on mount
  React.useEffect(() => {
    const loadAllData = async () => {
      // Load all data in parallel
      const [versionData, credsData, cmdData] = await Promise.all([
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
        loadCredentials(),
        // Load last command
        getLastCommand()
      ]);

      // Single state update to prevent multiple renders
      setAppData({
        version: versionData,
        userEmail: credsData?.email || null,
        isLoaded: true
      });

      if (cmdData) {
        setLastCmd(cmdData.command);
      }
    };

    loadAllData();
  }, []);

  // Watch for "/" input to enter slash mode
  React.useEffect(() => {
    if (commandInput === '/') {
      setSlashMode(true);
      setSelectedCommandIndex(0);
    } else if (slashMode && !commandInput.startsWith('/')) {
      setSlashMode(false);
      setSelectedCommandIndex(0);
    }
  }, [commandInput, slashMode]);

  // Reset selected index when search query changes
  React.useEffect(() => {
    if (slashMode) {
      setSelectedCommandIndex(0);
    }
  }, [commandInput]);

  // Handle command submission
  const handleSubmit = (value: string) => {
    // Ignore submit when in slash mode - selection handled by SlashCommands
    if (slashMode) {
      return;
    }

    const trimmed = value.trim();

    // If empty, just ignore
    if (!trimmed) {
      return;
    }

    // Commands must start with /
    if (!trimmed.startsWith('/')) {
      // Add error to history
      if (addToHistory) {
        addToHistory({
          type: 'info',
          content: `Unknown command: "${trimmed}". Type / to see available commands.`
        });
      }
      setCommandInput('');
      return;
    }

    // Build full command name (may include space for subcommands like "theme init")
    const parts = trimmed.slice(1).split(' ');
    const fullCommandName = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];

    // Check if it's a valid command
    const validCommands = [
      // Theme commands
      'theme init', 'theme create', 'theme validate', 'theme push', 'theme delete',
      // Site commands
      'site init', 'site validate', 'site publish', 'site pull',
      // Global commands
      'login', 'whoami', 'logout', 'switch', 'exit'
    ];
    if (!validCommands.includes(fullCommandName)) {
      if (addToHistory) {
        addToHistory({
          type: 'info',
          content: `Unknown command: "/${fullCommandName}". Type / to see available commands.`
        });
      }
      setCommandInput('');
      return;
    }

    // Handle the command via slash select
    handleSlashSelect(fullCommandName);
  };

  // Handle slash command selection
  const handleSlashSelect = (commandName: string) => {
    setSlashMode(false);
    setCommandInput('');

    // Handle exit command
    if (commandName === 'exit') {
      if (onExit) {
        onExit();
      } else {
        process.exit(0);
      }
      return;
    }

    // Navigate to command screen
    if (onNavigate) {
      switch (commandName) {
        // Theme commands
        case 'theme init':
          onNavigate({ type: 'theme-init' });
          break;
        case 'theme create':
          onNavigate({ type: 'theme-create' });
          break;
        case 'theme validate':
          onNavigate({ type: 'theme-validate' });
          break;
        case 'theme push':
          onNavigate({ type: 'theme-push' });
          break;
        case 'theme delete':
          onNavigate({ type: 'theme-delete' });
          break;
        // Site commands
        case 'site init':
          onNavigate({ type: 'site-init' });
          break;
        case 'site validate':
          onNavigate({ type: 'site-validate' });
          break;
        case 'site publish':
          onNavigate({ type: 'site-publish' });
          break;
        case 'site pull':
          onNavigate({ type: 'site-pull' });
          break;
        // Global commands
        case 'login':
          onNavigate({ type: 'login' });
          break;
        case 'whoami':
          onNavigate({ type: 'whoami' });
          break;
        case 'logout':
          onNavigate({ type: 'logout' });
          break;
        case 'switch':
          onNavigate({ type: 'switch' });
          break;
        default:
          break;
      }
    }
  };

  // Handle slash mode cancel
  const handleSlashCancel = () => {
    setSlashMode(false);
    setCommandInput('');
    setSelectedCommandIndex(0);
  };

  // Handle command list navigation
  const handleCommandNavigation = (direction: 'up' | 'down') => {
    const searchQuery = commandInput.slice(1); // Remove "/" prefix
    const isLoggedIn = !!userEmail;

    // Apply same filtering logic as SlashCommands
    let commands = filterCommands(searchQuery);
    commands = commands.filter(cmd => {
      if (cmd.name === 'login') return !isLoggedIn;
      if (cmd.name === 'logout') return isLoggedIn;
      if (cmd.name === 'whoami') return isLoggedIn;
      return true;
    });

    const filteredCount = Math.min(commands.length, 15);

    if (direction === 'up') {
      setSelectedCommandIndex(prev => (prev > 0 ? prev - 1 : filteredCount - 1));
    } else {
      setSelectedCommandIndex(prev => (prev < filteredCount - 1 ? prev + 1 : 0));
    }
  };

  // Handle Ctrl+C to exit and Escape to close slash mode
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (onExit) {
        onExit();
      } else {
        process.exit(0);
      }
    }

    // Close slash mode with Escape key
    if (key.escape && slashMode) {
      handleSlashCancel();
    }

    // Tab autocomplete in slash mode
    if (key.tab && slashMode) {
      const searchQuery = commandInput.slice(1); // Remove "/" prefix
      const isLoggedIn = !!userEmail;

      // Apply same filtering logic as SlashCommands
      let commands = filterCommands(searchQuery);
      commands = commands.filter(cmd => {
        if (cmd.name === 'login') return !isLoggedIn;
        if (cmd.name === 'logout') return isLoggedIn;
        if (cmd.name === 'whoami') return isLoggedIn;
        return true;
      });

      const filteredCmds = commands.slice(0, 15);

      if (filteredCmds.length > 0 && filteredCmds[selectedCommandIndex]) {
        const selectedCommand = filteredCmds[selectedCommandIndex].name;
        setCommandInput(`/${selectedCommand}`);
      }
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

      {/* Session History - Persistent log of all interactions */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'prompt') {
              return (
                <Box key={uniqueKey}>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'response') {
              return (
                <Box key={uniqueKey}>
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
              const textColor = entry.color === 'dim' ? undefined : entry.color;
              const isDim = entry.color === 'dim';
              const needsTopMargin = entry.spinnerId === 'command-separator';
              return (
                <Box key={uniqueKey} marginTop={needsTopMargin ? 1 : 0}>
                  <Text color={textColor} dimColor={isDim}>{entry.content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Input and Commands View */}
      {showInput && (
        <Box key="input-view" flexDirection="column">
          {/* Input box - always visible */}
          <Box flexDirection="column">
            {/* Top border - full width */}
            <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>

            {/* Input area with white chevron */}
            <Box>
              <Text>{chalk.white('❯')} </Text>
              <TextInput
                value={commandInput}
                onChange={setCommandInput}
                onSubmit={handleSubmit}
                placeholder="Type / for commands..."
              />
            </Box>

            {/* Bottom border - full width */}
            <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
          </Box>

          {/* Slash Commands - shown below input when in slash mode */}
          {slashMode && (
            <Box key="slash-commands-list">
              <SlashCommands
                searchQuery={commandInput.slice(1)} // Remove "/" prefix
                onSelect={handleSlashSelect}
                onCancel={handleSlashCancel}
                selectedIndex={selectedCommandIndex}
                onNavigate={handleCommandNavigation}
                isLoggedIn={!!userEmail}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WelcomeScreen;
