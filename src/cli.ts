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
import { SiteValidateScreen } from './screens/site/SiteValidateScreen.js';
import { SitePublishScreen } from './screens/site/SitePublishScreen.js';
import { SiteInitScreen } from './screens/site/SiteInitScreen.js';
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
Oaysus CLI - Build, publish, and manage your Oaysus projects

Usage
  $ oaysus <command> [options]

Theme Pack Commands
  theme init [name]      Create a new theme pack project
  theme create           Add a component to your theme pack
  theme validate         Validate theme pack structure
  theme build            Build components locally
  theme push             Upload theme pack to Oaysus
  theme delete [name]    Delete a theme pack

Website Commands
  site init [name]       Create a new website project
  site validate          Validate pages against installed components
  site publish [file?]   Publish all or specific page

Global Commands
  login                  Authenticate with your Oaysus account
  logout                 Clear authentication tokens
  whoami                 Display current user information
  switch                 Switch between your websites

Options
  --help, -h             Show this help message
  --version, -v          Show version number
  --dry-run              Preview mode (no changes)
  --force, -f            Force operation
  --yes, -y              Skip confirmation prompts

Examples
  $ oaysus theme init my-theme      # Create theme pack project
  $ oaysus theme push               # Upload theme pack to Oaysus
  $ oaysus site init my-site        # Create website project
  $ oaysus site validate            # Validate pages
  $ oaysus site publish             # Publish all pages
  $ oaysus site publish pages/home.json  # Publish single page
  $ oaysus login                    # Authenticate with Oaysus

For more information, visit https://oaysus.com/docs/cli
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
    // =====================
    // Theme Pack Subcommand
    // =====================
    case 'theme': {
      const subCommand = args[1];
      const subArgs = args.slice(2);

      switch (subCommand) {
        case 'init':
          render(React.createElement(InitScreen, {
            projectName: subArgs[0],
            onExit: handleExit
          }));
          break;

        case 'create':
          render(React.createElement(CreateScreen, {
            componentName: subArgs[0],
            projectPath: subArgs[1] || '.',
            onExit: handleExit
          }));
          break;

        case 'validate':
          render(React.createElement(ValidateScreen, {
            projectPath: subArgs[0] || '.',
            dryRun: subArgs.includes('--dry-run'),
            onExit: handleExit
          }));
          break;

        case 'build':
          render(React.createElement(BuildScreen, {
            projectPath: subArgs[0] || '.',
            onExit: handleExit
          }));
          break;

        case 'push':
          if (!process.stdin.isTTY) {
            push({ projectPath: subArgs[0] || '.' }).then(result => {
              process.exit(result.success ? 0 : 1);
            });
          } else {
            render(React.createElement(PushScreen, {
              projectPath: subArgs[0] || '.',
              onExit: handleExit
            }));
          }
          break;

        case 'delete': {
          const themeName = subArgs.find(arg => !arg.startsWith('-'));
          render(React.createElement(DeleteScreen, {
            themeName: themeName,
            onExit: handleExit
          }));
          break;
        }

        default:
          console.error(`Unknown theme command: ${subCommand || '(none)'}`);
          console.log('Available: init, create, validate, build, push, delete');
          process.exit(1);
      }
      break;
    }

    // ===================
    // Site Subcommand
    // ===================
    case 'site': {
      const subCommand = args[1];
      const subArgs = args.slice(2);

      switch (subCommand) {
        case 'init':
          render(React.createElement(SiteInitScreen, {
            projectName: subArgs[0],
            onExit: handleExit
          }));
          break;

        case 'validate':
          render(React.createElement(SiteValidateScreen, {
            projectPath: subArgs[0] || '.',
            onExit: handleExit
          }));
          break;

        case 'publish':
          render(React.createElement(SitePublishScreen, {
            projectPath: '.',
            pageFile: subArgs.find(a => !a.startsWith('--')),
            dryRun: subArgs.includes('--dry-run'),
            skipConfirm: subArgs.includes('--yes') || subArgs.includes('-y'),
            onExit: handleExit
          }));
          break;

        default:
          console.error(`Unknown site command: ${subCommand || '(none)'}`);
          console.log('Available: init, validate, publish');
          process.exit(1);
      }
      break;
    }

    // ===================
    // Global Commands
    // ===================
    case 'login':
      render(React.createElement(LoginScreen, { onExit: handleExit }));
      break;

    case 'whoami':
      render(React.createElement(WhoamiScreen, { onExit: handleExit }));
      break;

    case 'logout':
      render(React.createElement(LogoutScreen, { onExit: handleExit }));
      break;

    case 'switch':
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

    default:
      console.error(`Unknown command: ${command}`);
      console.log('');
      console.log('Available commands:');
      console.log('  oaysus theme <command>  Theme pack commands (init, create, validate, build, push, delete)');
      console.log('  oaysus site <command>   Website commands (init, validate, publish)');
      console.log('  oaysus login            Authenticate with Oaysus');
      console.log('  oaysus logout           Clear authentication');
      console.log('  oaysus whoami           Display current user');
      console.log('  oaysus switch           Switch websites');
      console.log('');
      console.log('Run "oaysus --help" for more information');
      process.exit(1);
  }
}
