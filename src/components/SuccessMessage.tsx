import React from 'react';
import { Box, Text } from 'ink';

interface SuccessMessageProps {
  message: string;
  details?: string[];
}

/**
 * SuccessMessage Component
 * Displays a success message with checkmark
 */
export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  details = [],
}) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text color="green" bold>
          ✓ {message}
        </Text>
      </Box>
      {details.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {details.map((detail, index) => (
            <Text key={index} color="gray">
              • {detail}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default SuccessMessage;
