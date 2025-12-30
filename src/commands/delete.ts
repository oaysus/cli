import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import axios from 'axios';
import { loadCredentials } from '../lib/shared/auth.js';
import { SSO_BASE_URL, debug as log, debugError as logError } from '../lib/shared/config.js';
import type { ThemePack, ThemePackListResponse, ThemePackDeleteResponse } from '../types/index.js';

/**
 * Format a friendly error message for API errors
 */
function formatApiError(error: unknown, context: string): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (error.code === 'ECONNREFUSED') {
      return new Error('Cannot connect to server. Please check your internet connection.');
    }

    if (status === 401 || status === 403) {
      return new Error('Authentication failed. Please run: oaysus login');
    }

    if (status === 404) {
      return new Error('Theme pack not found');
    }

    if (status === 409) {
      const installations = data?.activeInstallations || 'unknown';
      return new Error(`Cannot delete: ${installations} active installation(s) exist. Use --force to uninstall first.`);
    }

    if (status === 503) {
      return new Error('Unable to delete theme pack files. Please try again later.');
    }

    const message = data?.message || data?.error || data?.detail
    if (message) {
      return new Error(message);
    }

    return new Error(`Request failed with status ${status || 'unknown'}`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('An unexpected error occurred');
}

/**
 * Fetch list of theme packs for the current website
 */
async function getThemePacks(jwt: string, websiteId: string): Promise<ThemePack[]> {
  const url = `${SSO_BASE_URL}/sso/cli/theme-packs`;

  log('[DEBUG] Fetching theme packs');
  log('[DEBUG] API URL:', url);

  try {
    const response = await axios.get<ThemePackListResponse>(url, {
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      params: {
        websiteId
      }
    });

    log('[DEBUG] Theme packs response:', response.data);

    if (response.data.success && response.data.themePacks) {
      return response.data.themePacks;
    }

    throw new Error(response.data.error || 'Failed to fetch theme packs');
  } catch (error) {
    logError('[ERROR] Fetch theme packs failed');
    if (axios.isAxiosError(error)) {
      logError('[ERROR] Status:', error.response?.status);
      logError('[ERROR] Response:', error.response?.data);
    }
    throw formatApiError(error, 'fetching theme packs');
  }
}

/**
 * Delete a theme pack
 */
async function deleteThemePack(
  jwt: string,
  themePackId: string,
  force: boolean = false
): Promise<ThemePackDeleteResponse> {
  const url = `${SSO_BASE_URL}/sso/cli/theme-packs/${themePackId}`;

  log('[DEBUG] Deleting theme pack');
  log('[DEBUG] API URL:', url);
  log('[DEBUG] Force:', force);

  try {
    const response = await axios.delete<ThemePackDeleteResponse>(url, {
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      params: {
        force
      }
    });

    log('[DEBUG] Delete response:', response.data);

    return response.data;
  } catch (error) {
    logError('[ERROR] Delete theme pack failed');
    if (axios.isAxiosError(error)) {
      logError('[ERROR] Status:', error.response?.status);
      logError('[ERROR] Response:', error.response?.data);
    }
    throw formatApiError(error, 'deleting theme pack');
  }
}

/**
 * Delete command - deletes a theme pack from Oaysus
 * Uses inquirer for interactive prompts (non-Ink mode)
 */
export async function deleteCommand(themeName?: string, options: { force?: boolean; yes?: boolean } = {}) {
  try {
    // Step 1: Check authentication
    const credentials = await loadCredentials();

    if (!credentials) {
      console.error(chalk.red('✗ Not authenticated'));
      console.log(chalk.dim('Run: oaysus login'));
      process.exit(1);
    }

    // Check token expiry
    const expiresAt = new Date(credentials.expiresAt);
    const now = new Date();
    if (expiresAt <= now) {
      console.error(chalk.red('✗ Token expired'));
      console.log(chalk.dim('Run: oaysus login'));
      process.exit(1);
    }

    // Step 2: Fetch theme packs
    const spinner = ora('Fetching your theme packs...').start();

    let themePacks: ThemePack[];
    try {
      themePacks = await getThemePacks(credentials.jwt, credentials.websiteId);
    } catch (error) {
      spinner.fail('Failed to fetch theme packs');
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }

    if (!themePacks || themePacks.length === 0) {
      spinner.info('No theme packs found for this website');
      process.exit(0);
    }

    spinner.succeed(`Found ${themePacks.length} theme pack(s)`);

    // Step 3: Find or select theme pack to delete
    let selectedThemePack: ThemePack | undefined;

    if (themeName) {
      // Find by name
      selectedThemePack = themePacks.find(
        tp => tp.name.toLowerCase() === themeName.toLowerCase()
      );

      if (!selectedThemePack) {
        console.error(chalk.red(`\n✗ Theme pack "${themeName}" not found`));
        console.log(chalk.dim('\nAvailable theme packs:'));
        themePacks.forEach(tp => {
          console.log(chalk.dim(`  - ${tp.name} (${tp.componentCount} components)`));
        });
        process.exit(1);
      }
    } else {
      // Interactive selection
      console.log('');

      const choices = themePacks.map(tp => ({
        name: `${tp.displayName || tp.name} ${chalk.dim(`(${tp.componentCount} components, v${tp.version})`)}${tp.installationCount > 0 ? chalk.yellow(` [${tp.installationCount} installation(s)]`) : ''}`,
        value: tp.id,
        short: tp.name
      }));

      const { themePackId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'themePackId',
          message: 'Select a theme pack to delete:',
          choices
        }
      ]);

      selectedThemePack = themePacks.find(tp => tp.id === themePackId);
    }

    if (!selectedThemePack) {
      console.error(chalk.red('✗ Theme pack not found'));
      process.exit(1);
    }

    // Step 4: Show theme pack details and confirm
    console.log('');
    console.log(chalk.white.bold('Theme Pack Details:'));
    console.log(chalk.gray('  Name:       '), chalk.white(selectedThemePack.name));
    console.log(chalk.gray('  Display:    '), chalk.white(selectedThemePack.displayName));
    console.log(chalk.gray('  Version:    '), chalk.white(selectedThemePack.version));
    console.log(chalk.gray('  Components: '), chalk.white(selectedThemePack.componentCount.toString()));

    if (selectedThemePack.installationCount > 0) {
      console.log(chalk.gray('  Installed:  '), chalk.yellow(`${selectedThemePack.installationCount} website(s)`));
    }
    console.log('');

    // Check for active installations
    if (selectedThemePack.installationCount > 0 && !options.force) {
      console.log(chalk.yellow('⚠ This theme pack is installed on websites.'));
      console.log(chalk.dim('  Deleting will remove it from all installations.'));
      console.log('');

      const { confirmForce } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmForce',
          message: 'Do you want to proceed with force deletion?',
          default: false
        }
      ]);

      if (!confirmForce) {
        console.log(chalk.dim('\nDeletion cancelled.'));
        process.exit(0);
      }

      options.force = true;
    }

    // Confirmation prompt (unless --yes flag)
    if (!options.yes) {
      console.log(chalk.red.bold('⚠ WARNING: This action cannot be undone!'));
      console.log(chalk.dim('  All component files will be permanently deleted.'));
      console.log('');

      const { confirmDelete } = await inquirer.prompt([
        {
          type: 'input',
          name: 'confirmDelete',
          message: `Type "${selectedThemePack.name}" to confirm deletion:`,
        }
      ]);

      if (confirmDelete !== selectedThemePack.name) {
        console.log(chalk.dim('\nDeletion cancelled - name did not match.'));
        process.exit(0);
      }
    }

    // Step 5: Delete the theme pack
    const deleteSpinner = ora(`Deleting ${selectedThemePack.name}...`).start();

    try {
      const result = await deleteThemePack(
        credentials.jwt,
        selectedThemePack.id,
        options.force || false
      );

      if (result.success) {
        deleteSpinner.succeed(`Deleted ${selectedThemePack.name}`);
      } else {
        deleteSpinner.fail(`Failed to delete: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      deleteSpinner.fail('Failed to delete theme pack');
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }

    // Display success
    console.log('');
    console.log(chalk.green.bold('✓ Theme pack deleted successfully!'));
    console.log('');
    console.log(chalk.gray('Deleted: '), chalk.white(selectedThemePack.name));
    console.log(chalk.gray('Version: '), chalk.white(selectedThemePack.version));
    console.log('');

  } catch (error) {
    console.error('');
    console.error(chalk.red('✗ Delete failed'));
    console.error('');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red('An unknown error occurred'));
    }
    process.exit(1);
  }
}
