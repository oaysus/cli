import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadCredentials, getMyWebsites, updateCredentialsWebsite } from '../lib/shared/auth.js';
import type { Website } from '../types/index.js';

/**
 * Legacy switch command - switches between websites
 * Uses inquirer for interactive prompts (non-Ink mode)
 */
export async function switchCommand() {
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

    // Step 2: Fetch websites
    const spinner = ora('Fetching your websites...').start();

    let websites: Website[];
    try {
      websites = await getMyWebsites();
    } catch (error) {
      spinner.fail('Failed to fetch websites');
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }

    if (!websites || websites.length === 0) {
      spinner.fail('No websites found for this account');
      process.exit(1);
    }

    if (websites.length === 1) {
      spinner.info('You only have one website. No switch needed.');
      process.exit(0);
    }

    spinner.succeed(`Found ${websites.length} websites`);

    // Display current website
    const currentDisplay = credentials.customDomain
      || (credentials.subdomain ? `${credentials.subdomain}.myoaysus.com` : null)
      || credentials.websiteName
      || credentials.websiteId;

    console.log('');
    console.log(chalk.dim('Current website:'), chalk.cyan(currentDisplay));
    console.log('');

    // Step 3: Prompt for website selection
    const choices = websites.map(w => ({
      name: w.id === credentials.websiteId
        ? `${w.name} ${chalk.dim('(current)')}`
        : w.name,
      value: w.id,
      short: w.name
    }));

    const { websiteId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'websiteId',
        message: 'Select a website to switch to:',
        choices,
        default: credentials.websiteId
      }
    ]);

    // Check if same website selected
    if (websiteId === credentials.websiteId) {
      console.log(chalk.dim('Already on this website.'));
      process.exit(0);
    }

    // Step 4: Switch website
    const selected = websites.find(w => w.id === websiteId);
    if (!selected) {
      console.error(chalk.red('✗ Website not found'));
      process.exit(1);
    }

    const switchSpinner = ora(`Switching to ${selected.name}...`).start();

    try {
      await updateCredentialsWebsite(
        selected.id,
        selected.name,
        selected.subdomain,
        selected.customDomain
      );
      switchSpinner.succeed(`Switched to ${selected.name}`);
    } catch (error) {
      switchSpinner.fail('Failed to switch website');
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      }
      process.exit(1);
    }

    // Display success info
    console.log('');
    console.log(chalk.green.bold('✓ Website switched successfully!'));
    console.log('');
    console.log(chalk.gray('Website: '), chalk.white(selected.name));
    console.log(chalk.gray('Subdomain:'), chalk.white(`${selected.subdomain}.myoaysus.com`));
    if (selected.customDomain) {
      console.log(chalk.gray('Domain:   '), chalk.white(selected.customDomain));
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error(chalk.red('✗ Switch failed'));
    console.error('');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red('An unknown error occurred'));
    }
    process.exit(1);
  }
}
