import ora from 'ora';
import chalk from 'chalk';
import open from 'open';
import inquirer from 'inquirer';
import { requestMagicLink, initializeDevice, pollForAuth, saveCredentials } from '../lib/shared/auth';
import type { Credentials } from '../types/index.js';

export async function loginCommand() {
  try {
    // Step 1: Prompt for email
    const { email } = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        validate: (input: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(input)) {
            return 'Please enter a valid email address';
          }
          return true;
        }
      }
    ]);

    // Step 2: Request magic link
    const spinner = ora('Sending magic link...').start();

    await requestMagicLink(email, '/device');

    spinner.succeed('Magic link sent to your email');

    // Step 3: Initialize device authorization (for later polling)
    const deviceSpinner = ora('Initializing device authorization...').start();
    const deviceResponse = await initializeDevice();
    deviceSpinner.succeed('Device code generated');

    // Display instructions
    console.log('');
    console.log(chalk.bold.cyan('═══════════════════════════════════════'));
    console.log(chalk.bold.white('  📧 Check your email and click the link'));
    console.log('');
    console.log(chalk.gray('  Then enter code:'), chalk.bold.yellow(deviceResponse.userCode));
    console.log(chalk.bold.cyan('═══════════════════════════════════════'));
    console.log('');

    // Step 4: Poll for device authorization
    const pollSpinner = ora('Waiting for you to click the magic link and approve the device...').start();

    const result = await pollForAuth(deviceResponse.deviceCode, {
      interval: 2000,  // Poll every 2 seconds
      timeout: 600000  // 10 minute timeout
    });

    // Handle two-phase auth (this old command doesn't support it properly)
    if ('needsWebsiteSelection' in result) {
      pollSpinner.fail('This command does not support website selection yet. Please use /login in the main menu.');
      process.exit(1);
    }

    const credentials = result as Credentials;
    pollSpinner.succeed('Authorization complete!');

    // Save credentials
    await saveCredentials(credentials);

    // Display success
    console.log('');
    console.log(chalk.green.bold('✓ Authenticated successfully!'));
    console.log('');
    console.log(chalk.gray('Email:   '), chalk.white(credentials.email));
    console.log(chalk.gray('Website: '), chalk.white(credentials.websiteId));
    console.log(chalk.gray('User ID: '), chalk.white(credentials.userId));
    console.log('');

  } catch (error) {
    console.error('');
    console.error(chalk.red('✗ Authentication failed'));
    console.error('');
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red('An unknown error occurred'));
    }
    process.exit(1);
  }
}
