#!/usr/bin/env node

/**
 * Oaysus CLI - Main Entry Point
 * Modern CLI built with Ink (React for CLIs)
 */

// Load .env.local from CLI installation directory (not current working directory)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath, quiet: true });

// Dynamic import to ensure env vars are loaded first
const { runCli } = await import('./cli.js');

// Start the CLI
runCli().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
