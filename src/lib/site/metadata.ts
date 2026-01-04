/**
 * Metadata Manager
 * Handles the .oaysus/ directory containing project metadata:
 * - config.json: Project configuration (websiteId, etc.)
 * - components.json: Component catalog with schemas
 * - assets.json: Asset manifest for sync tracking
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import type {
  OaysusConfig,
  ComponentCatalog,
  CatalogThemePack,
  CatalogComponent,
  AssetManifest,
  ComponentCatalogSyncResult,
  MetadataInitResult,
} from '../../types/site.js';
import { loadCredentials } from '../shared/auth.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';

const OAYSUS_DIR = '.oaysus';
const CONFIG_FILE = 'config.json';
const COMPONENTS_FILE = 'components.json';
const ASSETS_FILE = 'assets.json';

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
 * Ensure the .oaysus directory exists
 */
export async function ensureOaysusDir(projectPath: string): Promise<string> {
  const oaysusDir = path.join(projectPath, OAYSUS_DIR);
  await fs.mkdir(oaysusDir, { recursive: true });
  return oaysusDir;
}

/**
 * Check if a project has .oaysus metadata
 */
export async function hasOaysusMetadata(projectPath: string): Promise<boolean> {
  const configPath = path.join(projectPath, OAYSUS_DIR, CONFIG_FILE);
  return fileExists(configPath);
}

/**
 * Find project root by looking for .oaysus/ directory
 * Falls back to oaysus.website.json for backward compatibility
 */
export async function findProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = path.resolve(startPath);

  for (let i = 0; i < 10; i++) {
    // Check for new .oaysus/ directory
    const oaysusDir = path.join(currentPath, OAYSUS_DIR);
    if (await fileExists(oaysusDir)) {
      return currentPath;
    }

    // Backward compatibility: check for oaysus.website.json
    const legacyConfig = path.join(currentPath, 'oaysus.website.json');
    if (await fileExists(legacyConfig)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) break;
    currentPath = parentPath;
  }

  return null;
}

// ============================================================================
// Config Management
// ============================================================================

/**
 * Load project config from .oaysus/config.json
 */
export async function loadConfig(projectPath: string): Promise<OaysusConfig | null> {
  const configPath = path.join(projectPath, OAYSUS_DIR, CONFIG_FILE);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as OaysusConfig;
  } catch {
    return null;
  }
}

/**
 * Save project config to .oaysus/config.json
 */
export async function saveConfig(projectPath: string, config: OaysusConfig): Promise<void> {
  await ensureOaysusDir(projectPath);
  const configPath = path.join(projectPath, OAYSUS_DIR, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get websiteId from config or credentials
 */
export async function getWebsiteId(projectPath: string): Promise<string | null> {
  // Try .oaysus/config.json first
  const config = await loadConfig(projectPath);
  if (config?.websiteId) {
    return config.websiteId;
  }

  // Try legacy oaysus.website.json
  const legacyPath = path.join(projectPath, 'oaysus.website.json');
  try {
    const content = await fs.readFile(legacyPath, 'utf-8');
    const legacy = JSON.parse(content);
    if (legacy.websiteId) {
      return legacy.websiteId;
    }
  } catch {
    // Ignore
  }

  // Fall back to credentials
  const credentials = await loadCredentials();
  return credentials?.websiteId || null;
}

// ============================================================================
// Component Catalog Management
// ============================================================================

/**
 * Load component catalog from .oaysus/components.json
 */
export async function loadComponentCatalog(projectPath: string): Promise<ComponentCatalog | null> {
  const catalogPath = path.join(projectPath, OAYSUS_DIR, COMPONENTS_FILE);

  try {
    const content = await fs.readFile(catalogPath, 'utf-8');
    return JSON.parse(content) as ComponentCatalog;
  } catch {
    return null;
  }
}

/**
 * Save component catalog to .oaysus/components.json
 */
export async function saveComponentCatalog(
  projectPath: string,
  catalog: ComponentCatalog
): Promise<void> {
  await ensureOaysusDir(projectPath);
  const catalogPath = path.join(projectPath, OAYSUS_DIR, COMPONENTS_FILE);
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
}

/**
 * Fetch components from server and build catalog
 */
export async function syncComponentCatalog(options: {
  projectPath: string;
  websiteId?: string;
  jwt?: string;
  force?: boolean;
}): Promise<ComponentCatalogSyncResult> {
  const { projectPath, force = false } = options;
  let { websiteId, jwt } = options;

  // Get credentials if not provided
  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return {
        success: false,
        error: 'Not authenticated. Run "oaysus login"',
        componentCount: 0,
        themePackCount: 0,
      };
    }
    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      success: false,
      error: 'No website ID found',
      componentCount: 0,
      themePackCount: 0,
    };
  }

  debug('Syncing component catalog for website:', websiteId);

  try {
    // Fetch installed components
    const componentsUrl = `${SSO_BASE_URL}/hosting/page-builder/components/custom`;
    const componentsResponse = await axios.get(componentsUrl, {
      params: { websiteId },
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!componentsResponse.data.success) {
      return {
        success: false,
        error: componentsResponse.data.error || 'Failed to fetch components',
        componentCount: 0,
        themePackCount: 0,
      };
    }

    const serverComponents = componentsResponse.data.components || [];

    // Group components by theme pack
    const themePackMap = new Map<string, CatalogThemePack>();
    const allComponentTypes: string[] = [];

    for (const comp of serverComponents) {
      const themePackId = comp.themePackId || 'custom';
      const themePackName = comp.themePack?.displayName || themePackId;

      if (!themePackMap.has(themePackId)) {
        themePackMap.set(themePackId, {
          id: themePackId,
          name: themePackName,
          version: comp.version,
          installed: true,
          components: [],
        });
      }

      const catalogComponent: CatalogComponent = {
        type: comp.type || comp.name,
        displayName: comp.displayName || comp.name,
        description: comp.description,
        category: comp.category,
        schema: comp.schema,
        defaultProps: comp.defaultProps,
        // defaultShared from schema - used for shared component resolution
        defaultShared: comp.defaultShared || false,
      };

      themePackMap.get(themePackId)!.components.push(catalogComponent);
      allComponentTypes.push(catalogComponent.type);
    }

    const catalog: ComponentCatalog = {
      version: 1,
      lastSyncedAt: new Date().toISOString(),
      websiteId,
      themePacks: Array.from(themePackMap.values()),
      allComponentTypes,
    };

    // Save to disk
    await saveComponentCatalog(projectPath, catalog);

    debug('Component catalog synced:', allComponentTypes.length, 'components');

    return {
      success: true,
      catalog,
      componentCount: allComponentTypes.length,
      themePackCount: themePackMap.size,
    };
  } catch (error) {
    let errorMessage = 'Failed to sync component catalog';

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please run "oaysus login"';
      } else {
        errorMessage = error.response?.data?.error || error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
      componentCount: 0,
      themePackCount: 0,
    };
  }
}

/**
 * Check if component catalog is stale (older than threshold)
 * Can take either a ComponentCatalog object or a project path
 */
export async function isCatalogStale(
  catalogOrPath: ComponentCatalog | string,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<boolean> {
  let catalog: ComponentCatalog | null;

  if (typeof catalogOrPath === 'string') {
    catalog = await loadComponentCatalog(catalogOrPath);
    if (!catalog) {
      return true; // No catalog = stale
    }
  } else {
    catalog = catalogOrPath;
  }

  const lastSynced = new Date(catalog.lastSyncedAt).getTime();
  const now = Date.now();
  return now - lastSynced > maxAgeMs;
}

/**
 * Check if a component type exists in the catalog
 */
export function componentExists(catalog: ComponentCatalog, componentType: string): boolean {
  return catalog.allComponentTypes.includes(componentType);
}

/**
 * Find a component in the catalog by type
 */
export function findComponent(catalog: ComponentCatalog, componentType: string): CatalogComponent | null {
  for (const themePack of catalog.themePacks) {
    const component = themePack.components.find(c => c.type === componentType);
    if (component) {
      return component;
    }
  }
  return null;
}

/**
 * Check if a component type should be shared by default
 */
export function isDefaultShared(catalog: ComponentCatalog, componentType: string): boolean {
  const component = findComponent(catalog, componentType);
  return component?.defaultShared === true;
}

/**
 * Get suggestions for a misspelled component type
 */
export function getSuggestions(catalog: ComponentCatalog, componentType: string, maxSuggestions: number = 3): string[] {
  const input = componentType.toLowerCase();
  const scored = catalog.allComponentTypes.map(type => {
    const target = type.toLowerCase();
    // Simple similarity: count matching characters
    let matches = 0;
    for (const char of input) {
      if (target.includes(char)) matches++;
    }
    // Bonus for prefix match
    if (target.startsWith(input.slice(0, 3))) matches += 5;
    return { type, score: matches };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxSuggestions).map(s => s.type);
}

// ============================================================================
// Asset Manifest Management
// ============================================================================

/**
 * Load asset manifest from .oaysus/assets.json
 */
export async function loadAssetManifest(projectPath: string): Promise<AssetManifest> {
  // Try new location first
  const newPath = path.join(projectPath, OAYSUS_DIR, ASSETS_FILE);
  try {
    const content = await fs.readFile(newPath, 'utf-8');
    return JSON.parse(content) as AssetManifest;
  } catch {
    // Fall back to legacy location
    const legacyPath = path.join(projectPath, 'assets', 'assets.json');
    try {
      const content = await fs.readFile(legacyPath, 'utf-8');
      return JSON.parse(content) as AssetManifest;
    } catch {
      // Return empty manifest
      return { version: 1, assets: {} };
    }
  }
}

/**
 * Save asset manifest to .oaysus/assets.json
 */
export async function saveAssetManifest(projectPath: string, manifest: AssetManifest): Promise<void> {
  await ensureOaysusDir(projectPath);
  const manifestPath = path.join(projectPath, OAYSUS_DIR, ASSETS_FILE);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

// ============================================================================
// Migration from legacy oaysus.website.json
// ============================================================================

/**
 * Migrate from legacy oaysus.website.json to .oaysus/
 */
export async function migrateLegacyConfig(projectPath: string): Promise<boolean> {
  const legacyPath = path.join(projectPath, 'oaysus.website.json');

  try {
    const content = await fs.readFile(legacyPath, 'utf-8');
    const legacy = JSON.parse(content);

    // Get websiteId from legacy or credentials
    let websiteId = legacy.websiteId;
    if (!websiteId) {
      const credentials = await loadCredentials();
      websiteId = credentials?.websiteId;
    }

    if (!websiteId) {
      return false;
    }

    // Create new config
    const config: OaysusConfig = {
      version: 1,
      websiteId,
    };

    await saveConfig(projectPath, config);

    // Migrate assets.json if it exists in legacy location
    const legacyAssetsPath = path.join(projectPath, 'assets', 'assets.json');
    if (await fileExists(legacyAssetsPath)) {
      const assetsContent = await fs.readFile(legacyAssetsPath, 'utf-8');
      const manifest = JSON.parse(assetsContent) as AssetManifest;
      await saveAssetManifest(projectPath, manifest);
    }

    debug('Migrated legacy config to .oaysus/');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize .oaysus/ metadata for a project
 */
export async function initializeMetadata(options: {
  projectPath: string;
  websiteId: string;
  websiteName?: string;
  subdomain?: string;
  syncComponents?: boolean;
  jwt?: string;
}): Promise<MetadataInitResult> {
  const { projectPath, websiteId, websiteName, subdomain, syncComponents = true } = options;

  try {
    // Create config
    const config: OaysusConfig = {
      version: 1,
      websiteId,
      websiteName,
      subdomain,
      lastSyncedAt: new Date().toISOString(),
    };

    await saveConfig(projectPath, config);

    // Sync component catalog if requested
    if (syncComponents) {
      let jwt = options.jwt;
      if (!jwt) {
        const credentials = await loadCredentials();
        jwt = credentials?.jwt;
      }

      if (jwt) {
        const syncResult = await syncComponentCatalog({
          projectPath,
          websiteId,
          jwt,
        });

        if (!syncResult.success) {
          return {
            success: false,
            error: `Created config but failed to sync components: ${syncResult.error}`,
          };
        }
      }
    }

    // Create empty asset manifest
    await saveAssetManifest(projectPath, { version: 1, assets: {} });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format component catalog for display
 */
export function formatCatalogForDisplay(catalog: ComponentCatalog): string[] {
  const lines: string[] = [];

  lines.push(`Component Catalog (synced ${new Date(catalog.lastSyncedAt).toLocaleString()})`);
  lines.push(`Website: ${catalog.websiteId}`);
  lines.push('');

  if (catalog.themePacks.length === 0) {
    lines.push('No components installed. Upload a theme pack first.');
    return lines;
  }

  for (const themePack of catalog.themePacks) {
    lines.push(`Theme Pack: ${themePack.name}${themePack.version ? ` v${themePack.version}` : ''}`);

    for (let i = 0; i < themePack.components.length; i++) {
      const comp = themePack.components[i];
      const isLast = i === themePack.components.length - 1;
      const prefix = isLast ? '└──' : '├──';

      let line = `  ${prefix} ${comp.type}`;
      if (comp.description) {
        line += ` - ${comp.description}`;
      }
      lines.push(line);
    }

    lines.push('');
  }

  lines.push(`Total: ${catalog.allComponentTypes.length} components`);

  return lines;
}
