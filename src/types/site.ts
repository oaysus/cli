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
