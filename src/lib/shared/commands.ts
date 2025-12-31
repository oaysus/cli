/**
 * Command Registry
 * Central definition of all available Oaysus CLI commands
 * Used for slash command autocomplete and help text generation
 */

export interface Command {
  name: string;
  description: string;
  args?: string;
  group?: 'theme' | 'site' | 'global';
}

/**
 * All available CLI commands
 * Organized by group: theme, site, and global
 */
export const COMMANDS: Command[] = [
  // Theme Pack Commands
  {
    name: 'theme init',
    description: 'Create a new theme pack project',
    group: 'theme',
  },
  {
    name: 'theme create',
    description: 'Add a component to your theme pack',
    group: 'theme',
  },
  {
    name: 'theme validate',
    description: 'Validate theme pack structure',
    group: 'theme',
  },
  {
    name: 'theme push',
    description: 'Upload theme pack to Oaysus',
    group: 'theme',
  },
  {
    name: 'theme delete',
    description: 'Delete a theme pack from Oaysus',
    group: 'theme',
  },

  // Site/Website Commands
  {
    name: 'site init',
    description: 'Create a new website project',
    group: 'site',
  },
  {
    name: 'site validate',
    description: 'Validate pages against installed components',
    group: 'site',
  },
  {
    name: 'site publish',
    description: 'Publish pages to your website',
    group: 'site',
  },

  // Global Commands
  {
    name: 'login',
    description: 'Authenticate with your Oaysus account',
    group: 'global',
  },
  {
    name: 'whoami',
    description: 'Display current user information',
    group: 'global',
  },
  {
    name: 'switch',
    description: 'Switch between your websites',
    group: 'global',
  },
  {
    name: 'logout',
    description: 'Clear authentication tokens',
    group: 'global',
  },
  {
    name: 'exit',
    description: 'Exit the CLI',
    group: 'global',
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

/**
 * Parse a command string into group and subcommand
 * e.g., "theme init" -> { group: "theme", subCommand: "init" }
 * e.g., "login" -> { group: "global", subCommand: "login" }
 */
export function parseCommand(commandName: string): {
  group: string;
  subCommand: string;
} {
  const parts = commandName.split(' ');
  if (parts.length === 2) {
    return { group: parts[0], subCommand: parts[1] };
  }
  return { group: 'global', subCommand: parts[0] };
}
