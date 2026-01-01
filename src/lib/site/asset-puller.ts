/**
 * Asset Puller
 * Pulls assets from the Oaysus DAM to local files
 * Only downloads missing or changed assets (based on content hash)
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { WebsiteConfig } from '../../types/site.js';
import { loadCredentials } from '../shared/auth.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';

/**
 * Asset metadata stored in assets.json manifest
 */
export interface AssetManifestEntry {
  /** CDN URL for the asset */
  url: string;
  /** MIME type */
  contentType: string;
  /** File size in bytes */
  sizeInBytes: number;
  /** Image width (if applicable) */
  width?: number;
  /** Image height (if applicable) */
  height?: number;
  /** Alt text for accessibility */
  altText?: string;
  /** Title/caption */
  title?: string;
  /** SHA-256 content hash for change detection */
  contentHash: string;
}

/**
 * The assets.json manifest structure
 */
export interface AssetManifest {
  /** Version of the manifest format */
  version: 1;
  /** Map of filename to asset metadata */
  assets: Record<string, AssetManifestEntry>;
}

/**
 * Result of pulling a single asset
 */
export interface PullAssetResult {
  /** Local filename */
  filename: string;
  /** Action taken */
  action: 'downloaded' | 'skipped' | 'error';
  /** Error message if action is 'error' */
  error?: string;
}

/**
 * Result of entire asset pull operation
 */
export interface AssetPullResult {
  /** Overall success */
  success: boolean;
  /** Results per asset */
  assets: PullAssetResult[];
  /** Total assets on server */
  total: number;
  /** Number downloaded */
  downloaded: number;
  /** Number skipped (already up-to-date) */
  skipped: number;
  /** Number of errors */
  errorCount: number;
  /** Error messages */
  errors: string[];
}

/**
 * Asset from server API
 */
interface ServerAsset {
  id: string;
  websiteId: string;
  url: string;
  filename: string;
  contentType: string;
  sizeInBytes: number;
  contentHash?: string;
  width?: number;
  height?: number;
  altText?: string;
  title?: string;
}

/**
 * Progress callback for asset pulling
 */
export type AssetPullProgressCallback = (
  stage: 'fetching' | 'downloading',
  current: number,
  total: number,
  detail?: string
) => void;

/**
 * Compute SHA-256 hash of a buffer
 */
function computeHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the assets.json manifest
 */
async function loadManifest(projectPath: string): Promise<AssetManifest> {
  const manifestPath = path.join(projectPath, 'assets', 'assets.json');

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Return empty manifest if file doesn't exist
    return { version: 1, assets: {} };
  }
}

/**
 * Save the assets.json manifest
 */
async function saveManifest(projectPath: string, manifest: AssetManifest): Promise<void> {
  const manifestPath = path.join(projectPath, 'assets', 'assets.json');
  const content = JSON.stringify(manifest, null, 2);
  await fs.writeFile(manifestPath, content, 'utf-8');
}

/**
 * Fetch all assets from the server
 */
async function fetchAssets(
  websiteId: string,
  jwt: string
): Promise<{ success: boolean; assets: ServerAsset[]; error?: string }> {
  const url = `${SSO_BASE_URL}/hosting/dam/assets`;

  debug('Fetching assets from:', url);

  try {
    const response = await axios.get(url, {
      params: { websiteId },
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (response.data.success && response.data.assets) {
      return { success: true, assets: response.data.assets };
    }

    return { success: false, assets: [], error: response.data.error || 'Unknown error' };
  } catch (error) {
    let errorMessage = 'Failed to fetch assets';

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please run "oaysus login"';
      } else {
        errorMessage = error.response?.data?.error ||
          error.response?.data?.detail?.error ||
          error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { success: false, assets: [], error: errorMessage };
  }
}

/**
 * Download a file from URL
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000, // 60 second timeout for large files
  });
  return Buffer.from(response.data);
}

/**
 * Preview info for an asset to be pulled
 */
export interface PullAssetPreview {
  filename: string;
  url: string;
  sizeInBytes: number;
  contentType: string;
  status: 'new' | 'changed' | 'up-to-date';
}

/**
 * Result of previewing what assets will be pulled
 */
export interface AssetPullPreviewResult {
  success: boolean;
  error?: string;
  /** All assets on server */
  assets: PullAssetPreview[];
  /** Assets that will be downloaded (new or changed) */
  toDownload: PullAssetPreview[];
  /** Assets that are already up-to-date */
  upToDate: PullAssetPreview[];
  /** Total download size in bytes */
  totalDownloadSize: number;
}

/**
 * Preview what assets would be pulled without actually pulling them
 */
export async function previewAssetPull(options: {
  projectPath: string;
  config: WebsiteConfig;
  websiteId?: string;
  jwt?: string;
}): Promise<AssetPullPreviewResult> {
  const { projectPath, config } = options;

  // Get credentials if not provided
  let websiteId = options.websiteId || config.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return {
        success: false,
        error: 'Not logged in. Please run "oaysus login"',
        assets: [],
        toDownload: [],
        upToDate: [],
        totalDownloadSize: 0,
      };
    }

    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      success: false,
      error: 'No website ID found',
      assets: [],
      toDownload: [],
      upToDate: [],
      totalDownloadSize: 0,
    };
  }

  // Fetch assets from server
  const fetchResult = await fetchAssets(websiteId, jwt!);

  if (!fetchResult.success) {
    return {
      success: false,
      error: fetchResult.error || 'Failed to fetch assets',
      assets: [],
      toDownload: [],
      upToDate: [],
      totalDownloadSize: 0,
    };
  }

  // Load existing manifest
  const manifest = await loadManifest(projectPath);
  const assetsDir = path.join(projectPath, 'assets');

  const assets: PullAssetPreview[] = [];
  const toDownload: PullAssetPreview[] = [];
  const upToDate: PullAssetPreview[] = [];
  let totalDownloadSize = 0;

  for (const serverAsset of fetchResult.assets) {
    const localPath = path.join(assetsDir, serverAsset.filename);
    const manifestEntry = manifest.assets[serverAsset.filename];
    const localExists = await fileExists(localPath);

    let status: 'new' | 'changed' | 'up-to-date' = 'new';

    if (localExists && manifestEntry) {
      // Check if content hash matches (if server has hash)
      if (serverAsset.contentHash && manifestEntry.contentHash === serverAsset.contentHash) {
        status = 'up-to-date';
      } else if (serverAsset.contentHash) {
        status = 'changed';
      } else {
        // No server hash, check by computing local hash
        try {
          const localContent = await fs.readFile(localPath);
          const localHash = computeHash(localContent);
          if (localHash === manifestEntry.contentHash) {
            status = 'up-to-date';
          } else {
            status = 'changed';
          }
        } catch {
          status = 'changed';
        }
      }
    }

    const preview: PullAssetPreview = {
      filename: serverAsset.filename,
      url: serverAsset.url,
      sizeInBytes: serverAsset.sizeInBytes,
      contentType: serverAsset.contentType,
      status,
    };

    assets.push(preview);

    if (status === 'up-to-date') {
      upToDate.push(preview);
    } else {
      toDownload.push(preview);
      totalDownloadSize += serverAsset.sizeInBytes;
    }
  }

  return {
    success: true,
    assets,
    toDownload,
    upToDate,
    totalDownloadSize,
  };
}

/**
 * Pull all assets from the server to local files
 * Only downloads missing or changed assets
 */
export async function pullAssets(options: {
  projectPath: string;
  config: WebsiteConfig;
  websiteId?: string;
  jwt?: string;
  force?: boolean;
  dryRun?: boolean;
  onProgress?: AssetPullProgressCallback;
}): Promise<AssetPullResult> {
  const { projectPath, config, force = false, dryRun = false, onProgress } = options;

  // Get credentials if not provided
  let websiteId = options.websiteId || config.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return {
        success: false,
        assets: [],
        total: 0,
        downloaded: 0,
        skipped: 0,
        errorCount: 0,
        errors: ['Not logged in. Please run "oaysus login"'],
      };
    }

    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      success: false,
      assets: [],
      total: 0,
      downloaded: 0,
      skipped: 0,
      errorCount: 0,
      errors: ['No website ID found'],
    };
  }

  // Fetch assets from server
  if (onProgress) {
    onProgress('fetching', 0, 1);
  }

  const fetchResult = await fetchAssets(websiteId, jwt!);

  if (!fetchResult.success) {
    return {
      success: false,
      assets: [],
      total: 0,
      downloaded: 0,
      skipped: 0,
      errorCount: 0,
      errors: [fetchResult.error || 'Failed to fetch assets'],
    };
  }

  const serverAssets = fetchResult.assets;

  if (serverAssets.length === 0) {
    return {
      success: true,
      assets: [],
      total: 0,
      downloaded: 0,
      skipped: 0,
      errorCount: 0,
      errors: [],
    };
  }

  if (onProgress) {
    onProgress('fetching', 1, 1);
  }

  // Ensure assets directory exists
  const assetsDir = path.join(projectPath, 'assets');
  if (!dryRun) {
    await fs.mkdir(assetsDir, { recursive: true });
  }

  // Load existing manifest
  const manifest = await loadManifest(projectPath);

  // Process each asset
  const results: PullAssetResult[] = [];
  let downloaded = 0;
  let skipped = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < serverAssets.length; i++) {
    const serverAsset = serverAssets[i];
    const localPath = path.join(assetsDir, serverAsset.filename);
    const manifestEntry = manifest.assets[serverAsset.filename];

    if (onProgress) {
      onProgress('downloading', i + 1, serverAssets.length, serverAsset.filename);
    }

    // Determine if we need to download
    let needsDownload = force;

    if (!needsDownload) {
      const localExists = await fileExists(localPath);

      if (!localExists) {
        needsDownload = true;
      } else if (manifestEntry && serverAsset.contentHash) {
        // Compare server hash with manifest hash
        needsDownload = manifestEntry.contentHash !== serverAsset.contentHash;
      } else if (manifestEntry) {
        // No server hash, compute local hash and compare
        try {
          const localContent = await fs.readFile(localPath);
          const localHash = computeHash(localContent);
          needsDownload = localHash !== manifestEntry.contentHash;
        } catch {
          needsDownload = true;
        }
      } else {
        // File exists but not in manifest, verify by downloading
        needsDownload = true;
      }
    }

    if (!needsDownload) {
      results.push({
        filename: serverAsset.filename,
        action: 'skipped',
      });
      skipped++;
      continue;
    }

    // Download the file
    if (!dryRun) {
      try {
        const fileBuffer = await downloadFile(serverAsset.url);
        const contentHash = computeHash(fileBuffer);

        // Write file
        await fs.writeFile(localPath, fileBuffer);

        // Update manifest
        manifest.assets[serverAsset.filename] = {
          url: serverAsset.url,
          contentType: serverAsset.contentType,
          sizeInBytes: serverAsset.sizeInBytes,
          width: serverAsset.width,
          height: serverAsset.height,
          altText: serverAsset.altText,
          title: serverAsset.title,
          contentHash: serverAsset.contentHash || contentHash,
        };

        results.push({
          filename: serverAsset.filename,
          action: 'downloaded',
        });
        downloaded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          filename: serverAsset.filename,
          action: 'error',
          error: errorMessage,
        });
        errors.push(`Failed to download ${serverAsset.filename}: ${errorMessage}`);
        errorCount++;
      }
    } else {
      // Dry run - just record what would happen
      results.push({
        filename: serverAsset.filename,
        action: 'downloaded',
      });
      downloaded++;
    }
  }

  // Save updated manifest
  if (!dryRun && downloaded > 0) {
    await saveManifest(projectPath, manifest);
  }

  return {
    success: errorCount === 0,
    assets: results,
    total: serverAssets.length,
    downloaded,
    skipped,
    errorCount,
    errors,
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
