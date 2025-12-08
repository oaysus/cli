import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface LogoProps {
  version?: string;
  directory?: string;
  userEmail?: string | null;
}

/**
 * Logo Component
 * Displays owl icon with OAYSUS branding
 * Wise mascot for the CLI
 */
export const Logo: React.FC<LogoProps> = ({ version = '0.1.0', directory, userEmail }) => {
  // Boxy Bot icon with gradient colors (3 lines tall) - fills vertical space
  const iconLine1 = chalk.hex('#A78BFA')(' ▄████▄ ');  // Top (purple)
  const iconLine2 = chalk.hex('#818CF8')('▐█') + chalk.white('●') + chalk.hex('#818CF8')('██') + chalk.white('●') + chalk.hex('#818CF8')('█▌ ');  // Eyes white with ears (light purple)
  const iconLine3 = chalk.hex('#60A5FA')(' ██▀▀██ ');  // Body (blue)

  // Format directory
  const displayDir = directory
    ? (directory.startsWith(process.env.HOME || '')
        ? `~${directory.slice((process.env.HOME || '').length)}`
        : directory)
    : '';

  // Format login status - gray like directory
  const loginStatus = userEmail
    ? chalk.dim(`✓ ${userEmail}`)
    : chalk.dim('✗ Not logged in');

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Line 1: Icon + OAYSUS v0.1.0 */}
      <Box key="logo-line-1">
        <Text>{iconLine1}</Text>
        <Text>  {chalk.white.bold('OAYSUS')} {chalk.gray(`v${version}`)}</Text>
      </Box>

      {/* Line 2: Icon + Login Status */}
      <Box key="logo-line-2">
        <Text>{iconLine2}</Text>
        <Text> {loginStatus}</Text>
      </Box>

      {/* Line 3: Icon + Directory */}
      <Box key="logo-line-3">
        <Text>{iconLine3}</Text>
        {directory && (
          <Text>  {chalk.dim(displayDir)}</Text>
        )}
      </Box>
    </Box>
  );
};

export default Logo;
