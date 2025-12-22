import chalk from 'chalk';
import { loadCredentials } from '../lib/shared/auth';

export async function whoamiCommand() {
  try {
    const credentials = await loadCredentials();

    if (!credentials) {
      console.log(chalk.red('✗ Not authenticated'));
      console.log(chalk.gray('  Run: oaysus login'));
      process.exit(1);
    }

    // Check if token expired
    const expiresAt = new Date(credentials.expiresAt);
    const now = new Date();
    const isExpired = expiresAt <= now;

    if (isExpired) {
      console.log(chalk.yellow('⚠ Token expired'));
      console.log(chalk.gray('  Run: oaysus login'));
      process.exit(1);
    }

    // Display user info
    console.log('');
    console.log(chalk.bold.white('Who am I?'));
    console.log('');
    console.log(chalk.gray('Email:      '), chalk.white(credentials.email));
    console.log(chalk.gray('User ID:    '), chalk.white(credentials.userId));
    // Display website: customDomain (preferred), subdomain, or ID as fallback
    if (credentials.customDomain) {
      console.log(chalk.gray('Website:    '), chalk.white(credentials.customDomain));
    } else if (credentials.subdomain) {
      console.log(chalk.gray('Website:    '), chalk.white(`${credentials.subdomain}.myoaysus.com`));
    } else {
      console.log(chalk.gray('Website ID: '), chalk.white(credentials.websiteId));
    }
    console.log(chalk.gray('Platforms:  '), chalk.white(credentials.platforms.join(', ')));
    console.log('');

    // Display expiry info
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60 * 24));
    const hoursUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    console.log(chalk.gray('Token expires in:'), chalk.white(`${daysUntilExpiry}d ${hoursUntilExpiry}h`));
    console.log('');

  } catch (error) {
    console.error(chalk.red('Failed to get user info'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }
}
