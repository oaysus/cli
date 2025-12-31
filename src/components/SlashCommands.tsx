import React from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { COMMANDS, filterCommands, type Command } from '../lib/shared/commands.js';

interface SlashCommandsProps {
  searchQuery?: string;
  onSelect: (command: string) => void;
  onCancel: () => void;
  selectedIndex: number;
  onNavigate: (direction: 'up' | 'down') => void;
  isLoggedIn?: boolean;
}

/**
 * SlashCommands
 * Interactive command selection menu
 * Shows when user types "/" - allows arrow key navigation and filtering
 */
export const SlashCommands: React.FC<SlashCommandsProps> = ({
  searchQuery = '',
  onSelect,
  onCancel,
  selectedIndex,
  onNavigate,
  isLoggedIn = false,
}) => {
  // Filter commands based on search query and login state (limit to 10)
  const filteredCommands = React.useMemo(() => {
    let commands = filterCommands(searchQuery);

    // Filter login/logout based on auth state
    commands = commands.filter(cmd => {
      if (cmd.name === 'login') return !isLoggedIn;
      if (cmd.name === 'logout') return isLoggedIn;
      if (cmd.name === 'whoami') return isLoggedIn;
      return true;
    });

    return commands.slice(0, 15);
  }, [searchQuery, isLoggedIn]);

  // Handle Enter key to select command
  useInput((input, key) => {
    if (key.return && filteredCommands.length > 0) {
      onSelect(filteredCommands[selectedIndex].name);
    } else if (key.upArrow) {
      onNavigate('up');
    } else if (key.downArrow) {
      onNavigate('down');
    }
  });

  // Show "no results" if filtered list is empty
  if (filteredCommands.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2} paddingTop={1}>
        <Text dimColor>No commands found matching "{searchQuery}"</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {filteredCommands.map((cmd, index) => {
        const isSelected = index === selectedIndex;

        // Build command name with args (e.g., "init [name]")
        const commandWithArgs = cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name;

        // Pad command name to fixed width (30 chars) for alignment
        const paddedCommand = commandWithArgs.padEnd(30, ' ');

        return (
          <Box key={cmd.name}>
            {/* Slash indicator - always shown, cyan for selected */}
            <Text>{isSelected ? chalk.cyan('  /') : chalk.dim('  /')}</Text>

            {/* Command name with args - fixed width */}
            <Text>
              {isSelected ? chalk.cyan(paddedCommand) : chalk.white(paddedCommand)}
            </Text>

            {/* Description - aligned */}
            <Text dimColor>{cmd.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
};

export default SlashCommands;
