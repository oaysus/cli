/**
 * Site Types
 * Type definitions for website projects and page publishing
 */

/**
 * Website project configuration (oaysus.website.json)
 */
export interface WebsiteConfig {
  /** Optional website ID. Falls back to CLI credentials if not specified */
  websiteId?: string;
  /** Theme pack names installed on this website (for validation hints) */
  themePacks?: string[];
}

/**
 * Page definition format (pages/*.json)
 */
export interface PageDefinition {
  /** URL slug (e.g., '/', '/about', '/pricing') */
  slug: string;
  /** Page title */
  title: string;
  /** Page description for SEO */
  description?: string;
  /** Whether this is the homepage */
  isHomePage?: boolean;
  /** Array of component instances */
  components: ComponentInstance[];
  /** Page settings (SEO, layout, etc.) */
  settings?: PageSettings;
}

/**
 * Component instance within a page
 */
export interface ComponentInstance {
  /** Component type/name (must match installed component) */
  type: string;
  /** Optional unique ID for this instance */
  id?: string;
  /** Component props */
  props: Record<string, unknown>;
  /** Component-level settings */
  settings?: Record<string, unknown>;
}

/**
 * Page settings
 */
export interface PageSettings {
  seo?: SEOSettings;
  layout?: LayoutSettings;
  scripts?: ScriptSettings;
}

/**
 * SEO settings for a page
 */
export interface SEOSettings {
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

/**
 * Layout settings for a page
 */
export interface LayoutSettings {
  maxWidth?: 'full' | 'container' | 'narrow';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

/**
 * Script settings for a page
 */
export interface ScriptSettings {
  headScripts?: string[];
  bodyScripts?: string[];
}

/**
 * Reference to a local asset found in component props
 */
export interface AssetReference {
  /** Local path (e.g., './assets/hero.jpg') */
  localPath: string;
  /** JSON path to the property (e.g., ['components', 0, 'props', 'backgroundImage']) */
  propPath: (string | number)[];
  /** Page file this asset is referenced in */
  pageFile: string;
}

/**
 * Resolved asset with R2 URL
 */
export interface ResolvedAsset extends AssetReference {
  /** R2 public URL after upload */
  r2Url: string;
  /** MIME type */
  contentType: string;
  /** File size in bytes */
  size: number;
}

/**
 * Uploaded asset info from DAM
 * This is what gets stored in component props for image fields
 */
export interface UploadedAssetInfo {
  /** Asset ID in DAM */
  id: string;
  /** R2 public URL */
  url: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Alt text */
  alt?: string;
  /** Original alt text from DAM */
  assetAlt?: string;
}

/**
 * Validation result for a single page
 */
export interface PageValidationResult {
  /** Whether the page is valid */
  valid: boolean;
  /** Page file name */
  pageFile: string;
  /** Page slug */
  slug: string;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Components that could not be found */
  unresolvedComponents: string[];
  /** Local asset references found */
  localAssets: AssetReference[];
}

/**
 * Validation result for entire site
 */
export interface SiteValidationResult {
  /** Whether all pages are valid */
  valid: boolean;
  /** Validation results per page */
  pages: PageValidationResult[];
  /** Total error count */
  totalErrors: number;
  /** Total warning count */
  totalWarnings: number;
  /** All local assets across all pages */
  allAssets: AssetReference[];
}

/**
 * Result of publishing a single page
 */
export interface PublishPageResult {
  /** Page slug */
  slug: string;
  /** Action taken */
  action: 'created' | 'updated' | 'skipped' | 'failed';
  /** Page ID (if created/updated) */
  pageId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Result of entire publish operation
 */
export interface PublishResult {
  /** Overall success */
  success: boolean;
  /** Results per page */
  pages: PublishPageResult[];
  /** Number of assets uploaded */
  assetsUploaded: number;
  /** Number of pages created */
  created: number;
  /** Number of pages updated */
  updated: number;
  /** Number of errors */
  errors: number;
}

/**
 * Installed component info from API
 */
export interface InstalledComponent {
  id: string;
  name: string;
  displayName: string;
  sourceThemePackId: string;
  sourceThemePackName?: string;
  schema?: Record<string, unknown>;
}

/**
 * Loaded website project
 */
export interface LoadedProject {
  /** Project root directory */
  projectPath: string;
  /** Website configuration */
  config: WebsiteConfig;
  /** Loaded page definitions */
  pages: Array<{
    file: string;
    definition: PageDefinition;
  }>;
  /** Load errors */
  errors: string[];
}

// ============================================================================
// .oaysus/ Metadata Types
// ============================================================================

/**
 * Project configuration stored in .oaysus/config.json
 */
export interface OaysusConfig {
  /** Version of config format */
  version: 1;
  /** Website ID this project is linked to */
  websiteId: string;
  /** Website name for display */
  websiteName?: string;
  /** Website subdomain */
  subdomain?: string;
  /** Last time metadata was synced from server */
  lastSyncedAt?: string;
}

/**
 * Component schema property definition
 */
export interface ComponentSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: ComponentSchemaProperty;
  properties?: Record<string, ComponentSchemaProperty>;
}

/**
 * Component schema definition
 */
export interface ComponentSchema {
  type?: string;
  properties?: Record<string, ComponentSchemaProperty>;
  required?: string[];
}

/**
 * Component definition in the catalog
 */
export interface CatalogComponent {
  /** Full component type name (e.g., "fitness-starter_GymHero") */
  type: string;
  /** Display name for humans */
  displayName: string;
  /** Component description */
  description?: string;
  /** Category for organization */
  category?: string;
  /** Component prop schema */
  schema?: ComponentSchema;
  /** Default prop values */
  defaultProps?: Record<string, unknown>;
}

/**
 * Theme pack in the catalog
 */
export interface CatalogThemePack {
  /** Theme pack ID */
  id: string;
  /** Theme pack name */
  name: string;
  /** Installed version */
  version?: string;
  /** Whether currently installed on the website */
  installed: boolean;
  /** Components in this theme pack */
  components: CatalogComponent[];
}

/**
 * Component catalog stored in .oaysus/components.json
 */
export interface ComponentCatalog {
  /** Version of catalog format */
  version: 1;
  /** When the catalog was last synced */
  lastSyncedAt: string;
  /** Website ID this catalog is for */
  websiteId: string;
  /** Theme packs and their components */
  themePacks: CatalogThemePack[];
  /** Quick lookup: all component types available */
  allComponentTypes: string[];
}

/**
 * Result of syncing component catalog
 */
export interface ComponentCatalogSyncResult {
  success: boolean;
  catalog?: ComponentCatalog;
  error?: string;
  /** Number of components synced */
  componentCount: number;
  /** Number of theme packs synced */
  themePackCount: number;
}

/**
 * Result of initializing metadata
 */
export interface MetadataInitResult {
  success: boolean;
  error?: string;
}

/**
 * Asset manifest stored in .oaysus/assets.json
 */
export interface AssetManifest {
  /** Version of manifest format */
  version: 1;
  /** Map of filename to asset metadata */
  assets: Record<string, AssetManifestEntry>;
}

/**
 * Single asset entry in the manifest
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
