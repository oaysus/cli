/**
 * Asset Uploader
 * Uploads local assets to the DAM (Digital Asset Manager)
 * Also maintains the local assets.json manifest for sync tracking
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as crypto from 'crypto';
import type {
  AssetReference,
  ResolvedAsset,
  UploadedAssetInfo,
  AssetManifest,
  AssetManifestEntry,
} from '../../types/site.js';
import { loadCredentials } from '../shared/auth.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';
import { resolveAssetPath, getAssetInfo } from './asset-resolver.js';
import { loadAssetManifest, saveAssetManifest } from './metadata.js';

/**
 * Compute SHA-256 hash of a buffer
 */
function computeHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Upload progress callback
 */
export type AssetUploadProgressCallback = (
  current: number,
  total: number,
  filename: string
) => void;

/**
 * Upload result for a single asset
 */
export interface AssetUploadResult {
  localPath: string;
  r2Url: string;
  /** Full asset info from DAM (includes id, width, height, etc.) */
  assetInfo?: UploadedAssetInfo;
  /** Content hash for manifest tracking */
  contentHash?: string;
  /** Content type */
  contentType?: string;
  /** File size in bytes */
  sizeInBytes?: number;
  success: boolean;
  error?: string;
}

/**
 * Upload a single asset to the DAM
 */
export async function uploadAsset(
  assetRef: AssetReference,
  projectPath: string,
  options: {
    websiteId: string;
    jwt: string;
  }
): Promise<AssetUploadResult> {
  const { websiteId, jwt } = options;

  // Get asset info
  const assetInfo = await getAssetInfo(assetRef, projectPath);

  if (!assetInfo) {
    return {
      localPath: assetRef.localPath,
      r2Url: '',
      success: false,
      error: `Asset file not found: ${assetRef.localPath}`,
    };
  }

  // Read file and encode as base64
  let fileData: string;
  let contentHash: string;
  try {
    const buffer = await fs.readFile(assetInfo.absolutePath);
    fileData = buffer.toString('base64');
    contentHash = computeHash(buffer);
  } catch (error) {
    return {
      localPath: assetRef.localPath,
      r2Url: '',
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  // Extract filename from path
  const filename = path.basename(assetInfo.absolutePath);

  // Upload to DAM
  const url = `${SSO_BASE_URL}/hosting/dam/assets/upload`;

  debug('Uploading asset:', filename);
  debug('API URL:', url);
  debug('Content-Type:', assetInfo.contentType);
  debug('Size:', assetInfo.size);

  try {
    const response = await axios.post(
      url,
      {
        websiteId,
        filename,
        fileData,
        contentType: assetInfo.contentType,
        title: filename,
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success && response.data.asset) {
      const damAsset = response.data.asset;
      return {
        localPath: assetRef.localPath,
        r2Url: damAsset.url,
        assetInfo: {
          id: damAsset.id,
          url: damAsset.url,
          width: damAsset.width,
          height: damAsset.height,
          alt: damAsset.altText || '',
          assetAlt: damAsset.altText || '',
        },
        contentHash: damAsset.contentHash || contentHash,
        contentType: assetInfo.contentType,
        sizeInBytes: assetInfo.size,
        success: true,
      };
    }

    return {
      localPath: assetRef.localPath,
      r2Url: '',
      success: false,
      error: response.data.error || 'Upload failed',
    };
  } catch (error) {
    let errorMessage = 'Upload failed';

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 403) {
        errorMessage = data?.error || 'Storage limit exceeded';
      } else if (status === 413) {
        errorMessage = 'File too large (max 10MB)';
      } else if (status === 401) {
        errorMessage = 'Authentication failed. Please run "oaysus login"';
      } else {
        errorMessage = data?.error || data?.detail?.error || error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      localPath: assetRef.localPath,
      r2Url: '',
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Upload multiple assets and return a mapping of local paths to R2 URLs
 * Also updates the local assets.json manifest to track uploaded assets
 */
export async function uploadAssets(
  assets: AssetReference[],
  projectPath: string,
  options: {
    websiteId?: string;
    jwt?: string;
    onProgress?: AssetUploadProgressCallback;
    updateManifest?: boolean;
  } = {}
): Promise<{
  assetMap: Map<string, UploadedAssetInfo>;
  results: AssetUploadResult[];
  successCount: number;
  errorCount: number;
}> {
  const { updateManifest = true } = options;

  // Get credentials if not provided
  let websiteId = options.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      throw new Error('Not authenticated. Run "oaysus login" first.');
    }
    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    throw new Error('No website ID found. Set websiteId in oaysus.website.json or run "oaysus login"');
  }

  // Deduplicate assets by local path
  const uniquePaths = new Set<string>();
  const uniqueAssets: AssetReference[] = [];

  for (const asset of assets) {
    if (!uniquePaths.has(asset.localPath)) {
      uniquePaths.add(asset.localPath);
      uniqueAssets.push(asset);
    }
  }

  // Load existing manifest for updates
  let manifest: AssetManifest | null = null;
  if (updateManifest) {
    manifest = await loadAssetManifest(projectPath);
  }

  // Upload each asset
  const results: AssetUploadResult[] = [];
  const assetMap = new Map<string, UploadedAssetInfo>();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < uniqueAssets.length; i++) {
    const asset = uniqueAssets[i];
    const filename = path.basename(asset.localPath);

    // Report progress
    if (options.onProgress) {
      options.onProgress(i + 1, uniqueAssets.length, filename);
    }

    // Upload
    const result = await uploadAsset(asset, projectPath, {
      websiteId: websiteId!,
      jwt: jwt!,
    });

    results.push(result);

    if (result.success && result.assetInfo) {
      assetMap.set(asset.localPath, result.assetInfo);
      successCount++;

      // Update manifest with uploaded asset
      if (manifest && result.contentHash) {
        manifest.assets[filename] = {
          url: result.r2Url,
          contentType: result.contentType || 'application/octet-stream',
          sizeInBytes: result.sizeInBytes || 0,
          width: result.assetInfo.width,
          height: result.assetInfo.height,
          altText: result.assetInfo.alt || undefined,
          contentHash: result.contentHash,
        };
      }
    } else {
      errorCount++;
    }
  }

  // Save updated manifest
  if (manifest && successCount > 0) {
    await saveAssetManifest(projectPath, manifest);
  }

  return {
    assetMap,
    results,
    successCount,
    errorCount,
  };
}

/**
 * Convert AssetReferences to ResolvedAssets after upload
 */
export function resolveAssets(
  assets: AssetReference[],
  uploadResults: AssetUploadResult[],
  projectPath: string
): ResolvedAsset[] {
  const resolved: ResolvedAsset[] = [];
  const resultMap = new Map(
    uploadResults
      .filter(r => r.success)
      .map(r => [r.localPath, r.r2Url])
  );

  for (const asset of assets) {
    const r2Url = resultMap.get(asset.localPath);
    if (!r2Url) continue;

    // Get asset info synchronously (we already validated these exist)
    const absolutePath = resolveAssetPath(asset, projectPath);
    const ext = path.extname(absolutePath).toLowerCase();

    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    resolved.push({
      ...asset,
      r2Url,
      contentType: contentTypeMap[ext] || 'application/octet-stream',
      size: 0, // Size is captured during upload
    });
  }

  return resolved;
}

/**
 * Format upload results for display
 */
export function formatUploadResults(results: AssetUploadResult[]): string[] {
  const lines: string[] = [];

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    lines.push(`✓ Uploaded ${successful.length} assets`);
  }

  if (failed.length > 0) {
    lines.push('');
    lines.push('Failed uploads:');
    for (const result of failed) {
      lines.push(`  ✗ ${result.localPath}: ${result.error}`);
    }
  }

  return lines;
}
