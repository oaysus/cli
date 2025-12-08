import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;
  color?: string;
}

/**
 * ProgressBar Component
 * Displays a horizontal progress bar with percentage
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  width = 40,
  color = 'cyan'
}) => {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;

  return (
    <Box>
      <Text color={color}>
        {'█'.repeat(filled)}
        {'░'.repeat(empty)}
      </Text>
      <Text dimColor> {progress}%</Text>
    </Box>
  );
};

export default ProgressBar;
