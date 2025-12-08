import React from 'react';
import { Box, Text } from 'ink';
import { getLastCommand, formatRelativeTime } from '../lib/shared/command-history.js';

/**
 * LastCommand Component
 * Displays the last executed command with timestamp
 * Shows a helpful message about re-running or entering new commands
 */
export const LastCommand: React.FC = () => {
  const [lastCommand, setLastCommand] = React.useState<string | null>(null);
  const [timestamp, setTimestamp] = React.useState<number | null>(null);

  React.useEffect(() => {
    getLastCommand().then(entry => {
      if (entry) {
        setLastCommand(entry.command);
        setTimestamp(entry.timestamp);
      }
    });
  }, []);

  if (!lastCommand || !timestamp) {
    return null;
  }

  const relativeTime = formatRelativeTime(timestamp);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text color="yellow">💡 </Text>
        <Text dimColor>Last: </Text>
        <Text color="cyan">{lastCommand}</Text>
        <Text dimColor> ({relativeTime})</Text>
      </Box>
      <Box paddingLeft={3}>
        <Text dimColor>Press </Text>
        <Text color="cyan">↵</Text>
        <Text dimColor> to run again, or type a new command</Text>
      </Box>
    </Box>
  );
};

export default LastCommand;
