#!/usr/bin/env node

/**
 * Oaysus CLI - Main Entry Point
 * Modern CLI built with Ink (React for CLIs)
 */

// Load .env.local BEFORE any other imports (must use dynamic import)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

// Dynamic import to ensure env vars are loaded first
const { runCli } = await import('./cli.js');

// Start the CLI
runCli().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
