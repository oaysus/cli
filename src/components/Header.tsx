import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

interface HeaderProps {
  subtitle?: string;
  showLogo?: boolean;
}

/**
 * Header Component
 * Displays the Oaysus CLI branding with gradient effect
 */
export const Header: React.FC<HeaderProps> = ({ subtitle, showLogo = true }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {showLogo && (
        <Box marginBottom={1}>
          <Gradient name="rainbow">
            <BigText text="OAYSUS" font="tiny" />
          </Gradient>
        </Box>
      )}
      {subtitle && (
        <Box>
          <Text bold color="cyan">
            {subtitle}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default Header;
