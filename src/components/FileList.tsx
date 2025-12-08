import React from 'react';
import { Box, Text } from 'ink';

interface FileListProps {
  files: string[];
  maxDisplay?: number;
  title?: string;
}

/**
 * FileList Component
 * Displays a list of files with optional truncation
 */
export const FileList: React.FC<FileListProps> = ({
  files,
  maxDisplay = 10,
  title = 'Files'
}) => {
  const displayFiles = files.slice(0, maxDisplay);
  const remaining = files.length - displayFiles.length;

  return (
    <Box flexDirection="column">
      <Text bold>{title} ({files.length})</Text>
      {displayFiles.map((file, i) => (
        <Text key={i} dimColor>
          • {file}
        </Text>
      ))}
      {remaining > 0 && (
        <Text dimColor>
          ... and {remaining} more
        </Text>
      )}
    </Box>
  );
};

export default FileList;
