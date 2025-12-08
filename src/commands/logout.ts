import chalk from 'chalk';
import { clearCredentials, loadCredentials } from '../lib/shared/auth';

export async function logoutCommand() {
  try {
    const credentials = await loadCredentials();

    if (!credentials) {
      console.log(chalk.yellow('⚠ Not currently logged in'));
      return;
    }

    // Clear credentials file
    await clearCredentials();

    console.log(chalk.green('✓ Logged out successfully'));
    console.log(chalk.gray(`  Cleared credentials for ${credentials.email}`));

  } catch (error) {
    console.error(chalk.red('Failed to logout'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}
