/**
 * Command Registry
 * Central definition of all available Oaysus CLI commands
 * Used for slash command autocomplete and help text generation
 */

export interface Command {
  name: string;
  description: string;
  args?: string;
}

/**
 * All available CLI commands
 * Ordered by importance/usage frequency
 */
export const COMMANDS: Command[] = [
  // Project workflow
  {
    name: 'init',
    description: 'Create a new component project',
  },
  {
    name: 'create',
    description: 'Add a component to your project',
  },
  {
    name: 'validate',
    description: 'Validate component package structure',
  },
  {
    name: 'push',
    description: 'Upload component package to Oaysus',
  },
  // Authentication
  {
    name: 'login',
    description: 'Authenticate with your Oaysus account',
  },
  {
    name: 'whoami',
    description: 'Display current user information',
  },
  {
    name: 'switch',
    description: 'Switch between your websites',
  },
  {
    name: 'logout',
    description: 'Clear authentication tokens',
  },
  // System
  {
    name: 'exit',
    description: 'Exit the CLI',
  },
];

/**
 * Get command by name
 */
export function getCommand(name: string): Command | undefined {
  return COMMANDS.find(cmd => cmd.name === name);
}

/**
 * Filter commands by search query (command name only)
 */
export function filterCommands(query: string): Command[] {
  const normalized = query.toLowerCase().trim();

  if (!normalized) {
    return COMMANDS;
  }

  return COMMANDS.filter(cmd =>
    cmd.name.toLowerCase().includes(normalized)
  );
}
