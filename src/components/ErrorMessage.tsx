import React from 'react';
import { Box, Text } from 'ink';

interface ErrorMessageProps {
  message: string;
  details?: string[];
  suggestion?: string;
}

/**
 * ErrorMessage Component
 * Displays an error message with optional details and suggestions
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  details = [],
  suggestion,
}) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text color="red" bold>
          ✗ {message}
        </Text>
      </Box>
      {details.length > 0 && (
        <Box flexDirection="column" marginLeft={1} marginBottom={1}>
          {details.map((detail, index) => {
            // Preserve formatting for lines that look like code (start with spaces or special chars)
            if (detail.startsWith('  ') || detail.startsWith('╔') || detail.startsWith('║') || detail.startsWith('╚') || detail === '') {
              return (
                <Text key={index} color="yellow">
                  {detail}
                </Text>
              );
            }
            // Regular error messages
            return (
              <Text key={index} color="gray">
                • {detail}
              </Text>
            );
          })}
        </Box>
      )}
      {suggestion && (
        <Box marginLeft={2}>
          <Text color="yellow">
            💡 {suggestion}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ErrorMessage;
