/**
 * Component Package Uploader
 * Handles uploading validated ZIP packages to Oaysus API/R2
 */

import axios, { AxiosProgressEvent } from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { loadCredentials } from './auth.js';
import { buildUploadMetadata } from './path-builder.js';
import type { ValidationResult, PackageJson } from '../../types/validation.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from monorepo env file
const envPath = path.join(__dirname, '../../../config/env/.env.personal.oaysus');
dotenv.config({ path: envPath });

const SSO_BASE_URL = process.env.NEXT_PUBLIC_OAYSUS_SSO_URL || 'https://auth.oaysus.com';

/**
 * Upload result from server
 */
export interface UploadResult {
  // Database IDs
  themePackId?: string;
  componentId?: string;
  componentIds?: string[];
  packageId?: string; // Legacy field, use themePackId instead

  // Component info
  componentCount?: number;
  componentBundles?: Record<string, string>;
  themeName?: string;

  // File URLs
  cdnUrl: string;
  clientBundleUrl?: string;
  files?: Record<string, string>;

  // Upload metadata
  size: number;
  hash: string;
  filename?: string;
  uploadedAt: string;
  userId: string;
}

/**
 * File to upload with content type
 */
export interface FileToUpload {
  relativePath: string;
  absolutePath: string;
  contentType: string;
  size: number;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (bytesUploaded: number, totalBytes: number, percentage: number) => void;

/**
 * Upload error with specific error codes
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Upload options including import map, stylesheets, and dependencies
 */
export interface UploadOptions {
  importMap?: Record<string, any>;
  stylesheets?: Record<string, string>;
  dependencies?: Array<{ name: string; version: string }>;
}

/**
 * Upload a component package ZIP file to R2
 *
 * @param zipPath - Absolute path to ZIP file
 * @param hash - SHA256 hash of the ZIP file
 * @param packageJson - Package.json data for metadata
 * @param onProgress - Optional progress callback
 * @param options - Optional import map and dependencies
 * @returns Upload result with packageId and CDN URL
 */
export async function uploadPackageToR2(
  zipPath: string,
  hash: string,
  packageJson: PackageJson,
  onProgress?: ProgressCallback,
  options?: UploadOptions
): Promise<UploadResult> {
  // 1. Load credentials
  const credentials = await loadCredentials();

  if (!credentials || !credentials.jwt) {
    throw new UploadError(
      'Not authenticated. Please run "oaysus login" first',
      'NOT_AUTHENTICATED'
    );
  }

  // 2. Check if file exists
  if (!fs.existsSync(zipPath)) {
    throw new UploadError(
      `ZIP file not found: ${zipPath}`,
      'FILE_NOT_FOUND'
    );
  }

  // 3. Get file stats
  const stats = fs.statSync(zipPath);
  const fileSize = stats.size;

  // 4. Check file size (max 50MB)
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (fileSize > MAX_SIZE) {
    throw new UploadError(
      `File size (${fileSize} bytes) exceeds maximum allowed size (${MAX_SIZE} bytes)`,
      'FILE_TOO_LARGE'
    );
  }

  // 5. Build upload metadata with environment-aware R2 path
  const uploadMetadata = buildUploadMetadata(packageJson, credentials, {
    importMap: options?.importMap,
    dependencies: options?.dependencies
  });

  // 6. Create form data
  const form = new FormData();
  const fileStream = fs.createReadStream(zipPath);
  form.append('file', fileStream);
  form.append('packageJson', JSON.stringify(packageJson));
  form.append('r2Path', uploadMetadata.r2Path);
  // Detect framework from dependencies
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  let framework = 'react';
  if (allDeps['vue']) framework = 'vue';
  else if (allDeps['svelte']) framework = 'svelte';
  else if (allDeps['solid-js']) framework = 'solid';

  form.append('metadata', JSON.stringify({
    environment: uploadMetadata.environment,
    developer: uploadMetadata.developer,
    themeName: uploadMetadata.themeName,
    componentName: uploadMetadata.themeName, // Component name for DB storage
    displayName: uploadMetadata.displayName,
    version: uploadMetadata.version,
    framework,
    category: packageJson.oaysus?.theme?.category || 'custom',
    description: packageJson.description || '',
    importMap: uploadMetadata.importMap,
    dependencies: uploadMetadata.dependencies,
    tags: packageJson.oaysus?.theme?.tags || []
  }));

  // 7. Prepare request config
  const uploadUrl = `${SSO_BASE_URL}/sso/cli/component/upload?hash=${hash}`;

  // Debug logging to file
  const debugInfo = `
=== UPLOAD DEBUG ===
Time: ${new Date().toISOString()}
Upload URL: ${uploadUrl}
SSO_BASE_URL: ${SSO_BASE_URL}
File size: ${fileSize} bytes
File path: ${zipPath}
Hash: ${hash}
R2 Path: ${uploadMetadata.r2Path}
Environment: ${uploadMetadata.environment}
Developer: ${uploadMetadata.developer || 'N/A'}
Theme: ${uploadMetadata.themeName} v${uploadMetadata.version}
==================
`;
  fs.writeFileSync('/tmp/oaysus-cli-upload-debug.log', debugInfo, { flag: 'a' });

  const config = {
    method: 'POST',
    url: uploadUrl,
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${credentials.jwt}`
    },
    data: form,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (onProgress && progressEvent.total) {
        const bytesUploaded = progressEvent.loaded;
        const totalBytes = progressEvent.total;
        const percentage = Math.round((bytesUploaded / totalBytes) * 100);
        onProgress(bytesUploaded, totalBytes, percentage);
      }
    }
  };

  // 8. Upload file
  try {
    const response = await axios(config);

    // Debug log successful response
    const successDebug = `
=== UPLOAD SUCCESS ===
Time: ${new Date().toISOString()}
Status: ${response.status}
Response data: ${JSON.stringify(response.data, null, 2)}
=====================
`;
    fs.writeFileSync('/tmp/oaysus-cli-upload-debug.log', successDebug, { flag: 'a' });

    return response.data as UploadResult;
  } catch (error: any) {
    // Debug log error details
    if (axios.isAxiosError(error)) {
      const errorDebug = `
=== UPLOAD ERROR ===
Time: ${new Date().toISOString()}
Status: ${error.response?.status}
Error data: ${JSON.stringify(error.response?.data, null, 2)}
Error message: ${error.message}
Error code: ${error.code}
====================
`;
      fs.writeFileSync('/tmp/oaysus-cli-upload-debug.log', errorDebug, { flag: 'a' });
    }

    // Handle specific error cases
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 401) {
        throw new UploadError(
          'Authentication failed. Please run "oaysus login" again',
          'UNAUTHORIZED',
          401
        );
      } else if (status === 403) {
        throw new UploadError(
          'Access forbidden. Your authentication may have expired. Try: oaysus logout && oaysus login',
          'FORBIDDEN',
          403
        );
      } else if (status === 413) {
        throw new UploadError(
          errorData?.error || 'File too large',
          'FILE_TOO_LARGE',
          413
        );
      } else if (status === 415) {
        throw new UploadError(
          `Unsupported media type. The server may not be properly configured for file uploads. Error: ${errorData?.error || 'No details'}`,
          'UNSUPPORTED_MEDIA_TYPE',
          415
        );
      } else if (status === 404) {
        throw new UploadError(
          'Upload endpoint not found. Make sure the backend API is running and deployed.',
          'NOT_FOUND',
          404
        );
      } else if (status === 400) {
        throw new UploadError(
          errorData?.error || 'Bad request',
          'BAD_REQUEST',
          400
        );
      } else if (status === 500) {
        // Check for detailed error message first (from safe_async_handler decorator)
        const errorMessage = errorData?.details || errorData?.error || 'Server error occurred';
        throw new UploadError(
          errorMessage,
          'SERVER_ERROR',
          500
        );
      } else if (error.code === 'ECONNABORTED') {
        throw new UploadError(
          'Upload timed out. Please check your connection and try again',
          'TIMEOUT'
        );
      } else if (error.code === 'ECONNREFUSED') {
        throw new UploadError(
          'Could not connect to server. Please check your internet connection',
          'CONNECTION_REFUSED'
        );
      }
    }

    // Generic error
    throw new UploadError(
      error.message || 'Upload failed',
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Get content type for a file based on extension
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.map': 'application/json',
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Recursively collect all files from a directory
 */
function collectFilesFromDir(dir: string, baseDir: string = dir): FileToUpload[] {
  const files: FileToUpload[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFilesFromDir(absolutePath, baseDir));
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, absolutePath);
      const stats = fs.statSync(absolutePath);
      files.push({
        relativePath,
        absolutePath,
        contentType: getContentType(absolutePath),
        size: stats.size
      });
    }
  }

  return files;
}

/**
 * Upload individual build files to R2 (Task 2 compliant)
 *
 * @param buildDir - Path to .oaysus-build directory
 * @param packageJson - Package.json data for metadata
 * @param onProgress - Optional progress callback
 * @param options - Optional import map and dependencies
 * @returns Upload result with individual file URLs
 */
export async function uploadBuildFilesToR2(
  buildDir: string,
  packageJson: PackageJson,
  onProgress?: ProgressCallback,
  options?: UploadOptions
): Promise<UploadResult> {
  // 1. Load credentials
  const credentials = await loadCredentials();

  if (!credentials || !credentials.jwt) {
    throw new UploadError(
      'Not authenticated. Please run "oaysus login" first',
      'NOT_AUTHENTICATED'
    );
  }

  // 2. Check if build directory exists
  if (!fs.existsSync(buildDir)) {
    throw new UploadError(
      `Build directory not found: ${buildDir}`,
      'DIRECTORY_NOT_FOUND'
    );
  }

  // 3. Collect all files from build directory
  const files = collectFilesFromDir(buildDir);

  if (files.length === 0) {
    throw new UploadError(
      'No files found in build directory',
      'NO_FILES'
    );
  }

  // 4. Calculate total size and hash
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    const content = fs.readFileSync(file.absolutePath);
    hash.update(content);
  }
  const hashString = hash.digest('hex');

  // 5. Build upload metadata
  const uploadMetadata = buildUploadMetadata(packageJson, credentials, {
    importMap: options?.importMap,
    stylesheets: options?.stylesheets,
    dependencies: options?.dependencies
  });

  // 6. Detect framework
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  let framework = 'react';
  if (allDeps['vue']) framework = 'vue';
  else if (allDeps['svelte']) framework = 'svelte';
  else if (allDeps['solid-js']) framework = 'solid';

  // 7. Build file contents object
  const fileContents: Record<string, { content: string; contentType: string }> = {};
  for (const file of files) {
    const content = fs.readFileSync(file.absolutePath);
    fileContents[file.relativePath] = {
      content: content.toString('base64'),
      contentType: file.contentType
    };
  }

  // 8. Prepare request body (JSON instead of FormData)
  // Use oaysus.theme.description first, then fall back to root description
  const themeDescription = packageJson.oaysus?.theme?.description || packageJson.description || '';

  const requestBody = {
    files: fileContents,
    packageJson,
    r2Path: uploadMetadata.r2Path,
    metadata: {
      environment: uploadMetadata.environment,
      developer: uploadMetadata.developer,
      themeName: uploadMetadata.themeName,
      componentName: uploadMetadata.themeName,
      themeDisplayName: uploadMetadata.displayName,
      displayName: uploadMetadata.displayName,
      version: uploadMetadata.version,
      framework,
      category: packageJson.oaysus?.theme?.category || 'custom',
      themeDescription: themeDescription,
      description: themeDescription,
      importMap: uploadMetadata.importMap,
      stylesheets: uploadMetadata.stylesheets,
      dependencies: uploadMetadata.dependencies,
      tags: packageJson.oaysus?.theme?.tags || []
    },
    hash: hashString,
    totalSize
  };

  // 9. Upload URL
  const uploadUrl = `${SSO_BASE_URL}/sso/cli/component/upload-files`;

  // Debug logging
  const debugInfo = `
=== UPLOAD FILES DEBUG ===
Time: ${new Date().toISOString()}
Upload URL: ${uploadUrl}
Files: ${files.length}
Total size: ${totalSize} bytes
R2 Path: ${uploadMetadata.r2Path}
Environment: ${uploadMetadata.environment}
Theme: ${uploadMetadata.themeName} v${uploadMetadata.version}
==========================
`;
  fs.writeFileSync('/tmp/oaysus-cli-upload-debug.log', debugInfo, { flag: 'a' });

  // 10. Upload
  try {
    const response = await axios({
      method: 'POST',
      url: uploadUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.jwt}`
      },
      data: requestBody,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (onProgress && progressEvent.total) {
          const bytesUploaded = progressEvent.loaded;
          const totalBytes = progressEvent.total;
          const percentage = Math.round((bytesUploaded / totalBytes) * 100);
          onProgress(bytesUploaded, totalBytes, percentage);
        }
      }
    });

    // Debug log successful response
    const successDebug = `
=== UPLOAD FILES SUCCESS ===
Time: ${new Date().toISOString()}
Status: ${response.status}
Response data: ${JSON.stringify(response.data, null, 2)}
============================
`;
    fs.writeFileSync('/tmp/oaysus-cli-upload-debug.log', successDebug, { flag: 'a' });

    return response.data as UploadResult;
  } catch (error: any) {
    // Debug log error details
    if (axios.isAxiosError(error)) {
      const errorDebug = `
=== UPLOAD ERROR ===
Time: ${new Date().toISOString()}
Status: ${error.response?.status}
Error data: ${JSON.stringify(error.response?.data, null, 2)}
Error message: ${error.message}
Error code: ${error.code}
====================
`;
      fs.writeFileSync('/tmp/oaysus-cli-upload-debug.log', errorDebug, { flag: 'a' });
    }

    // Handle specific error cases
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;

      if (status === 401) {
        throw new UploadError(
          'Authentication failed. Please run "oaysus login" again',
          'UNAUTHORIZED',
          401
        );
      } else if (status === 403) {
        throw new UploadError(
          'Access forbidden. Your authentication may have expired. Try: oaysus logout && oaysus login',
          'FORBIDDEN',
          403
        );
      } else if (status === 413) {
        throw new UploadError(
          errorData?.error || 'Payload too large',
          'PAYLOAD_TOO_LARGE',
          413
        );
      } else if (status === 404) {
        throw new UploadError(
          'Upload endpoint not found. The new upload-files endpoint may not be deployed yet.',
          'NOT_FOUND',
          404
        );
      } else if (status === 400) {
        throw new UploadError(
          errorData?.error || 'Bad request',
          'BAD_REQUEST',
          400
        );
      } else if (status === 500) {
        // Check for detailed error message first (from safe_async_handler decorator)
        const errorMessage = errorData?.details || errorData?.error || 'Server error occurred';
        throw new UploadError(
          errorMessage,
          'SERVER_ERROR',
          500
        );
      }
    }

    throw new UploadError(
      error.message || 'Upload failed',
      'UNKNOWN_ERROR'
    );
  }
}
