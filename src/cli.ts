#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { LoginScreen } from './screens/LoginScreen.js';
import { WhoamiScreen } from './screens/WhoamiScreen.js';
import { LogoutScreen } from './screens/LogoutScreen.js';
import { ValidateScreen } from './screens/ValidateScreen.js';
import { InitScreen } from './screens/InitScreen.js';
import { CreateScreen } from './screens/CreateScreen.js';
import { PushScreen } from './screens/PushScreen.js';
import { BuildScreen } from './screens/BuildScreen.js';
import { SwitchScreen } from './screens/SwitchScreen.js';
import { DeleteScreen } from './screens/DeleteScreen.js';
import { App } from './components/App.js';
import { saveCommandToHistory } from './lib/shared/command-history.js';
import { push } from './lib/push.js';
import { switchCommand } from './commands/switch.js';
import { checkAuthForCommand } from './lib/shared/auth-middleware.js';

// Get package version function
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getVersion(): Promise<string> {
  try {
    const pkgData = await readFile(path.join(__dirname, '../package.json'), 'utf-8');
    const pkg = JSON.parse(pkgData);
    return pkg.version;
  } catch {
    return '0.1.0';
  }
}

/**
 * CLI Entry Point
 * Parses command-line arguments and renders appropriate Ink screens
 */

/**
 * Main CLI Router
 * Routes commands to appropriate Ink screens
 */
export async function runCli() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle exit callback
  const handleExit = () => {
    process.exit(0);
  };

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    const version = await getVersion();
    console.log(`oaysus-cli v${version}`);
    process.exit(0);
  }

  // Show welcome screen when no command provided
  if (!command) {
    render(React.createElement(App, { onExit: handleExit }));
    return;
  }

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Oaysus CLI - Professional developer tool for component uploads

Usage
  $ oaysus <command> [options]

Commands
  init [name]     Create a new component project (theme pack structure)
  create          Add a component to your project
  validate        Validate component package and create ZIP
  build           Build components locally (no upload to R2)
  push            Build and upload component package to Oaysus
  delete [name]   Delete a theme pack from Oaysus
  login           Authenticate with your Oaysus account
  logout          Clear authentication tokens and log out
  whoami          Display current authenticated user information
  switch          Switch between your websites

Options
  --help, -h      Show this help message
  --version, -v   Show version number
  --dry-run       Validate without creating ZIP (validate command only)
  --force, -f     Force delete (uninstalls from all websites first)
  --yes, -y       Skip confirmation prompts (delete command only)

Examples
  $ oaysus init my-project          # Create new project with components/ structure
  $ oaysus create component Pricing # Add a new component
  $ oaysus validate                 # Validate and create ZIP (no upload)
  $ oaysus build                    # Build components to .oaysus-build/ (no upload)
  $ oaysus push                     # Build and upload to Oaysus
  $ oaysus delete                   # Interactive delete (shows list of theme packs)
  $ oaysus delete my-theme          # Delete specific theme pack
  $ oaysus delete my-theme --force  # Force delete (removes installations)
  $ oaysus login                    # Authenticate with Oaysus
  $ oaysus whoami                   # Show current user
  $ oaysus logout                   # Sign out

Project Structure
  All projects use a consistent theme pack structure:
  my-project/
  ├── components/        # Your components live here
  │   └── Hero/          # One Hero component created by default
  ├── shared/            # Shared utilities and types
  ├── package.json
  └── README.md

  Use "oaysus create component" to add more components to your project.
`);
    process.exit(0);
  }

  // Track command in history
  const commandString = `oaysus ${args.join(' ')}`;
  saveCommandToHistory(commandString).catch(() => {
    // Silently ignore history save errors
  });

  // Check authentication for commands that require it
  const authResult = await checkAuthForCommand(command);
  if (!authResult.valid) {
    console.error(`\n✗ ${authResult.error}`);
    if (authResult.suggestion) {
      console.log(`💡 ${authResult.suggestion}`);
    }
    process.exit(1);
  }

  switch (command) {
    case 'init':
      render(React.createElement(InitScreen, {
        projectName: args[1],
        onExit: handleExit
      }));
      break;

    case 'create':
      render(React.createElement(CreateScreen, {
        componentName: args[1],
        projectPath: args[2] || '.',
        onExit: handleExit
      }));
      break;

    case 'login':
      render(React.createElement(LoginScreen, { onExit: handleExit }));
      break;

    case 'whoami':
      render(React.createElement(WhoamiScreen, { onExit: handleExit }));
      break;

    case 'logout':
      render(React.createElement(LogoutScreen, { onExit: handleExit }));
      break;

    case 'validate':
      render(React.createElement(ValidateScreen, {
        projectPath: args[1] || '.',
        dryRun: args.includes('--dry-run'),
        onExit: handleExit
      }));
      break;

    case 'build':
      render(React.createElement(BuildScreen, {
        projectPath: args[1] || '.',
        onExit: handleExit
      }));
      break;

    case 'push':
      // Use non-interactive mode if no TTY (e.g., running from script/IDE)
      if (!process.stdin.isTTY) {
        push({ projectPath: args[1] || '.' }).then(result => {
          process.exit(result.success ? 0 : 1);
        });
      } else {
        render(React.createElement(PushScreen, {
          projectPath: args[1] || '.',
          onExit: handleExit
        }));
      }
      break;

    case 'switch':
      // Use non-interactive mode if no TTY
      if (!process.stdin.isTTY) {
        switchCommand().then(() => {
          process.exit(0);
        }).catch(() => {
          process.exit(1);
        });
      } else {
        render(React.createElement(SwitchScreen, { onExit: handleExit }));
      }
      break;

    case 'delete':
      // Get theme name (first non-flag argument after 'delete')
      const deleteThemeName = args.slice(1).find(arg => !arg.startsWith('-'));

      render(React.createElement(DeleteScreen, {
        themeName: deleteThemeName,
        onExit: handleExit
      }));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "oaysus --help" for usage information');
      process.exit(1);
  }
}
