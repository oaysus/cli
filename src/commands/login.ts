import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { requestMagicLink, initializeDevice, pollForAuth, saveCredentials } from '../lib/shared/auth';
import type { Credentials } from '../types/index.js';

// Debug toggle
const DEBUG = true;

export async function loginCommand() {
  try {
    if (DEBUG) console.log('[DEBUG] loginCommand started');

    // Step 1: Prompt for email
    if (DEBUG) console.log('[DEBUG] Prompting for email...');
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
    if (DEBUG) console.log('[DEBUG] Email entered:', email);

    // Step 2: Initialize device authorization FIRST (to get device code for magic link)
    if (DEBUG) console.log('[DEBUG] Initializing device...');
    const deviceSpinner = ora('Initializing device authorization...').start();
    const deviceResponse = await initializeDevice();
    deviceSpinner.succeed('Device code generated');
    if (DEBUG) console.log('[DEBUG] Device response:', JSON.stringify(deviceResponse));

    // Step 3: Request magic link with device code embedded
    if (DEBUG) console.log('[DEBUG] Sending magic link...');
    const spinner = ora('Sending magic link...').start();
    try {
      await requestMagicLink(email, deviceResponse.deviceCode);
      if (DEBUG) console.log('\n[DEBUG] requestMagicLink returned successfully');
    } catch (magicLinkError) {
      spinner.fail('Failed to send magic link');
      if (DEBUG) console.log('[DEBUG] requestMagicLink threw error:', magicLinkError);
      throw magicLinkError;
    }
    spinner.succeed('Magic link sent to your email');
    if (DEBUG) console.log('[DEBUG] Magic link sent successfully');

    // Force flush output
    process.stdout.write('');

    // Display instructions (no need to show user code - magic link has device code embedded)
    console.log('');
    console.log(chalk.bold.cyan('═══════════════════════════════════════'));
    console.log(chalk.bold.white('  📧 Check your email and click the link'));
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
    if (DEBUG) {
      console.error('[DEBUG] Error caught in loginCommand:');
      console.error('[DEBUG] Error type:', error?.constructor?.name);
      console.error('[DEBUG] Error:', error);
      if (error instanceof Error) {
        console.error('[DEBUG] Stack:', error.stack);
      }
    }
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
