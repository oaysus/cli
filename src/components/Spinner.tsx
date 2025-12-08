import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerProps {
  message?: string;
  type?: 'dots' | 'line' | 'dots2' | 'dots3';
  color?: string;
}

/**
 * Spinner Component
 * Displays animated loading indicator with optional message
 */
export const Spinner: React.FC<SpinnerProps> = ({
  message = 'Loading...',
  type = 'dots',
  color = 'cyan',
}) => {
  return (
    <Box>
      <Text color={color}>
        <InkSpinner type={type} />
        {' '}
        {message}
      </Text>
    </Box>
  );
};

export default Spinner;
