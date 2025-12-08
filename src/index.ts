#!/usr/bin/env node

/**
 * Oaysus CLI - Main Entry Point
 * Modern CLI built with Ink (React for CLIs)
 */

import { runCli } from './cli.js';

// Start the CLI
runCli().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
