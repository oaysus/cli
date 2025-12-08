import React from 'react';
import { Box, Text } from 'ink';

interface UploadProgressProps {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

/**
 * Format bytes to human-readable format (KB, MB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Upload Progress Component
 * Displays upload progress with bytes and percentage
 */
export const UploadProgress: React.FC<UploadProgressProps> = ({
  bytesUploaded,
  totalBytes,
  percentage
}) => {
  // Create progress bar (40 characters wide)
  const barWidth = 40;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return (
    <Box flexDirection="column">
      {/* Progress bar */}
      <Box>
        <Text color="cyan">{filled}</Text>
        <Text dimColor>{empty}</Text>
        <Text> </Text>
        <Text color="cyan" bold>{percentage}%</Text>
      </Box>

      {/* Bytes uploaded */}
      <Box marginTop={1}>
        <Text>
          <Text color="cyan">{formatBytes(bytesUploaded)}</Text>
          <Text dimColor> / </Text>
          <Text>{formatBytes(totalBytes)}</Text>
        </Text>
      </Box>
    </Box>
  );
};

export default UploadProgress;
