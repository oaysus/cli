/**
 * Asset Resolver
 * Finds local asset references (./assets/*) in component props
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  PageDefinition,
  ComponentInstance,
  AssetReference,
  LoadedProject,
  UploadedAssetInfo,
} from '../../types/site.js';

// Patterns that indicate a local asset path
const LOCAL_ASSET_PATTERNS = [
  /^\.\/assets\//,   // ./assets/image.jpg
  /^\.\.\/assets\//, // ../assets/image.jpg
  /^assets\//,       // assets/image.jpg (relative without dot)
];

// Common image/media extensions to help identify asset paths
const ASSET_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.mp4', '.webm', '.mov', '.avi',
  '.mp3', '.wav', '.ogg',
  '.pdf', '.doc', '.docx',
];

/**
 * Check if a value looks like a local asset path
 */
function isLocalAssetPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!value) return false;

  // Check if matches local asset patterns
  for (const pattern of LOCAL_ASSET_PATTERNS) {
    if (pattern.test(value)) return true;
  }

  // Check if it's a relative path with known extension
  if (value.startsWith('./') || value.startsWith('../')) {
    const ext = path.extname(value).toLowerCase();
    if (ASSET_EXTENSIONS.includes(ext)) return true;
  }

  return false;
}

/**
 * Recursively find asset references in an object
 */
function findAssetsInObject(
  obj: unknown,
  currentPath: (string | number)[],
  pageFile: string,
  assets: AssetReference[]
): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === 'string') {
    if (isLocalAssetPath(obj)) {
      assets.push({
        localPath: obj,
        propPath: [...currentPath],
        pageFile,
      });
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      findAssetsInObject(item, [...currentPath, index], pageFile, assets);
    });
    return;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      findAssetsInObject(value, [...currentPath, key], pageFile, assets);
    }
  }
}

/**
 * Find all asset references in a component's props
 */
export function findAssetsInComponent(
  component: ComponentInstance,
  componentIndex: number,
  pageFile: string
): AssetReference[] {
  const assets: AssetReference[] = [];

  // Search in props
  findAssetsInObject(
    component.props,
    ['components', componentIndex, 'props'],
    pageFile,
    assets
  );

  // Search in settings if present
  if (component.settings) {
    findAssetsInObject(
      component.settings,
      ['components', componentIndex, 'settings'],
      pageFile,
      assets
    );
  }

  return assets;
}

/**
 * Find all asset references in a page definition
 */
export function findAssetsInPage(
  page: PageDefinition,
  pageFile: string
): AssetReference[] {
  const assets: AssetReference[] = [];

  // Search each component
  page.components.forEach((component, index) => {
    const componentAssets = findAssetsInComponent(component, index, pageFile);
    assets.push(...componentAssets);
  });

  // Search in page settings (e.g., ogImage)
  if (page.settings) {
    findAssetsInObject(
      page.settings,
      ['settings'],
      pageFile,
      assets
    );
  }

  return assets;
}

/**
 * Find all asset references across an entire project
 */
export function findAllAssets(project: LoadedProject): AssetReference[] {
  const assets: AssetReference[] = [];

  for (const page of project.pages) {
    const pageAssets = findAssetsInPage(page.definition, page.file);
    assets.push(...pageAssets);
  }

  return assets;
}

/**
 * Resolve a local asset path to an absolute file path
 */
export function resolveAssetPath(
  assetRef: AssetReference,
  projectPath: string
): string {
  // For standalone assets (no pageFile), resolve relative to project root
  if (!assetRef.pageFile) {
    return path.resolve(projectPath, assetRef.localPath);
  }

  // Get the directory containing the page file
  const pageDir = path.dirname(path.join(projectPath, assetRef.pageFile));

  // Resolve the asset path relative to the page file
  return path.resolve(pageDir, assetRef.localPath);
}

/**
 * Check if a local asset file exists
 */
export async function assetExists(
  assetRef: AssetReference,
  projectPath: string
): Promise<boolean> {
  const absolutePath = resolveAssetPath(assetRef, projectPath);
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get asset file info (size, mime type)
 */
export async function getAssetInfo(
  assetRef: AssetReference,
  projectPath: string
): Promise<{
  absolutePath: string;
  size: number;
  contentType: string;
} | null> {
  const absolutePath = resolveAssetPath(assetRef, projectPath);

  try {
    const stats = await fs.stat(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();

    // Determine content type from extension
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
    };

    return {
      absolutePath,
      size: stats.size,
      contentType: contentTypeMap[ext] || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

/**
 * Replace asset paths in a page definition with resolved asset objects
 * Image paths are replaced with { id, url, width, height, alt } objects
 * so the dashboard can recognize them as DAM assets
 */
export function replaceAssetPaths(
  page: PageDefinition,
  assetMap: Map<string, UploadedAssetInfo>
): PageDefinition {
  // Deep clone the page to avoid mutating original
  const cloned = JSON.parse(JSON.stringify(page)) as PageDefinition;

  // Helper to replace paths in an object
  function replacePaths(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      // Check if this path has a replacement
      const assetInfo = assetMap.get(obj);
      if (assetInfo) {
        // Return the full asset object for image fields
        // The dashboard expects { id, url, alt, width, height }
        return assetInfo;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(replacePaths);
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = replacePaths(value);
      }
      return result;
    }

    return obj;
  }

  // Replace in components
  cloned.components = cloned.components.map(component => ({
    ...component,
    props: replacePaths(component.props) as Record<string, unknown>,
    settings: component.settings
      ? replacePaths(component.settings) as Record<string, unknown>
      : undefined,
  }));

  // Replace in settings
  if (cloned.settings) {
    cloned.settings = replacePaths(cloned.settings) as PageDefinition['settings'];
  }

  return cloned;
}

/**
 * Get unique asset paths from all references (deduplicated)
 */
export function getUniqueAssetPaths(assets: AssetReference[]): string[] {
  const unique = new Set(assets.map(a => a.localPath));
  return Array.from(unique);
}
