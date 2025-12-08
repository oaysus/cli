/**
 * File System Utilities
 * Helper functions for file and directory operations
 */

import fs from 'fs';
import path from 'path';

/**
 * Check if a directory exists
 */
export function directoryExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Create a directory recursively
 */
export function createDirectory(dirPath: string): void {
  if (!directoryExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write content to a file, creating directories as needed
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  createDirectory(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read file content
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Copy file from source to destination
 */
export function copyFile(sourcePath: string, destPath: string): void {
  const content = readFile(sourcePath);
  writeFile(destPath, content);
}

/**
 * Validate project name (lowercase, hyphens only)
 */
export function isValidProjectName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

/**
 * Convert a string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert a string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Get the current year
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}
