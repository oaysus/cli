import React from 'react';
import { Box, Text } from 'ink';

interface BuildProgressProps {
  components: Array<{
    name: string;
    status: 'pending' | 'building' | 'done' | 'error';
    size?: number;
    error?: string;
  }>;
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Build Progress Component
 * Displays build progress for each component
 */
export const BuildProgress: React.FC<BuildProgressProps> = ({ components }) => {
  return (
    <Box flexDirection="column">
      {components.map((component) => (
        <Box key={component.name} marginBottom={1}>
          {component.status === 'pending' && (
            <Text dimColor>  ⋯ {component.name}</Text>
          )}

          {component.status === 'building' && (
            <Text color="cyan">  ⚙ Building {component.name}...</Text>
          )}

          {component.status === 'done' && (
            <Text color="green">
              ✓ {component.name}
              {component.size && (
                <Text dimColor> ({formatBytes(component.size)})</Text>
              )}
            </Text>
          )}

          {component.status === 'error' && (
            <Text color="red">
              ✗ {component.name}
              {component.error && (
                <Text dimColor> - {component.error}</Text>
              )}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default BuildProgress;
