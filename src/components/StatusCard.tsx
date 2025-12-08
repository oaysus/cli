import React from 'react';
import { Box, Text } from 'ink';

interface StatusCardProps {
  title: string;
  value: string;
  color?: string;
  borderColor?: string;
}

/**
 * StatusCard Component
 * Displays information in a styled bordered box
 */
export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  color = 'white',
  borderColor = 'cyan',
}) => {
  const borderChars = {
    top: '─',
    bottom: '─',
    left: '│',
    right: '│',
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
  };

  const width = Math.max(title.length, value.length) + 4;

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={borderColor}>
        {borderChars.topLeft}
        {borderChars.top.repeat(width)}
        {borderChars.topRight}
      </Text>
      <Box>
        <Text color={borderColor}>{borderChars.left} </Text>
        <Box flexDirection="column" width={width - 2}>
          <Text bold color="gray">
            {title}
          </Text>
          <Text bold color={color}>
            {value}
          </Text>
        </Box>
        <Text color={borderColor}> {borderChars.right}</Text>
      </Box>
      <Text color={borderColor}>
        {borderChars.bottomLeft}
        {borderChars.bottom.repeat(width)}
        {borderChars.bottomRight}
      </Text>
    </Box>
  );
};

export default StatusCard;
