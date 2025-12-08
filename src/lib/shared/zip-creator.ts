/**
 * ZIP Creator
 * Creates ZIP archives with proper exclusions for component packages
 */

import archiver from 'archiver';
import { createReadStream } from 'fs';
import { glob } from 'glob';
import crypto from 'crypto';
import path from 'path';
import type { ZipResult } from '../../types/validation.js';

// Default files/patterns to exclude from ZIP
const DEFAULT_EXCLUSIONS = [
  'node_modules/**',
  '.git/**',
  '.gitignore',
  '.DS_Store',
  '**/*.log',
  'dist/**',
  'build/**',
  '.env*',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
  'coverage/**',
  '.nyc_output/**',
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/.vscode/**',
  '**/.idea/**',
  'tsconfig.json',
  'jest.config.js',
  'jest.config.ts',
  '.eslintrc*',
  '.prettierrc*',
];

/**
 * Create a ZIP archive of the project
 *
 * @param projectPath - Path to the project directory
 * @param additionalExclusions - Additional patterns to exclude (from .oaysusrc.json)
 * @returns ZipResult with buffer, size, hash, and file counts
 */
export async function createZip(
  projectPath: string,
  additionalExclusions?: string[]
): Promise<ZipResult> {
  // Combine default and additional exclusions
  const exclude = [...DEFAULT_EXCLUSIONS];

  if (additionalExclusions) {
    exclude.push(...additionalExclusions.map(pattern => {
      // Ensure patterns work with glob
      if (pattern.endsWith('/')) {
        return `${pattern}**`;
      }
      return pattern;
    }));
  }

  // Get all files to include (respecting exclusions)
  const files = await glob('**/*', {
    cwd: projectPath,
    ignore: exclude,
    nodir: true,
    dot: true, // Include dot files like .oaysusrc.json
  });

  // Get count of excluded files
  const allFiles = await glob('**/*', {
    cwd: projectPath,
    nodir: true,
    dot: true,
  });
  const excludedCount = allFiles.length - files.length;

  // Create ZIP in memory
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  const chunks: Buffer[] = [];

  // Collect chunks and wait for finalization
  const zipPromise = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') {
        console.warn('Warning:', err.message);
      }
    });

    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });

  // Add files to ZIP
  for (const file of files) {
    const filePath = path.join(projectPath, file);
    const stream = createReadStream(filePath);
    archive.append(stream, { name: file });
  }

  // Finalize and wait for completion
  await archive.finalize();
  const zipBuffer = await zipPromise;

  // Calculate SHA256 hash
  const hash = crypto.createHash('sha256');
  hash.update(zipBuffer);
  const sha256 = hash.digest('hex');

  return {
    buffer: zipBuffer,
    size: zipBuffer.length,
    sha256,
    fileCount: files.length,
    excludedCount,
    files,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
