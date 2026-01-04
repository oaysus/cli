/**
 * Page Puller
 * Pulls pages from the Oaysus platform to local JSON files
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { PageDefinition, WebsiteConfig } from '../../types/site.js';
import { loadCredentials } from '../shared/auth.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';

/**
 * Result of pulling a single page
 */
export interface PullPageResult {
  /** Page slug */
  slug: string;
  /** Local file path written */
  file: string;
  /** Action taken */
  action: 'created' | 'updated' | 'skipped';
}

/**
 * Result of entire pull operation
 */
export interface PullResult {
  /** Overall success */
  success: boolean;
  /** Results per page */
  pages: PullPageResult[];
  /** Number of pages fetched from server */
  fetched: number;
  /** Number of files written */
  written: number;
  /** Number of files skipped */
  skipped: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * Server component definition (includes global component fields)
 */
interface ServerComponent {
  type: string;
  id?: string;
  props: Record<string, unknown>;
  settings?: Record<string, unknown>;
  // Global/shared component fields from server
  isGlobal?: boolean;
  globalId?: string;
}

/**
 * API response for a page from the server
 */
interface ServerPage {
  id: string;
  websiteId: string;
  slug: string;
  title: string;
  description?: string;
  status: string;
  isHomePage: boolean;
  components: ServerComponent[];
  settings?: Record<string, unknown>;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  lastAuthor?: string;
}

/**
 * Pull progress callback
 */
export type PullProgressCallback = (
  stage: 'fetching' | 'writing',
  current: number,
  total: number,
  detail?: string
) => void;

/**
 * Convert a slug to a local filename
 * / -> home.json (matches site init convention)
 * /about -> about.json
 * /services/training -> services-training.json
 */
export function slugToFilename(slug: string): string {
  if (slug === '/') {
    return 'home.json';
  }

  // Remove leading slash, replace remaining slashes with dashes
  const name = slug.replace(/^\//, '').replace(/\//g, '-');
  return `${name}.json`;
}

/**
 * Convert server page to local PageDefinition format
 * Strips server-only fields but preserves shared component relationships
 */
function serverPageToLocal(serverPage: ServerPage): PageDefinition {
  // Map components, preserving shared component info for round-trip
  const localComponents = (serverPage.components || []).map(comp => {
    const localComp: Record<string, unknown> = {
      type: comp.type,
      props: comp.props,
    };

    // Preserve optional fields
    if (comp.id) {
      localComp.id = comp.id;
    }
    if (comp.settings) {
      localComp.settings = comp.settings;
    }

    // Preserve shared component info for round-trip support
    if (comp.isGlobal && comp.globalId) {
      localComp.shared = true;
      localComp.globalId = comp.globalId;
    }

    return localComp;
  });

  return {
    slug: serverPage.slug,
    title: serverPage.title,
    description: serverPage.description,
    isHomePage: serverPage.isHomePage || false,
    components: localComponents as unknown as PageDefinition['components'],
    settings: serverPage.settings || {},
  };
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
 * Fetch all pages from the server
 */
async function fetchPages(
  websiteId: string,
  jwt: string
): Promise<{ success: boolean; pages: ServerPage[]; error?: string }> {
  const url = `${SSO_BASE_URL}/hosting/page-builder/pages`;

  debug('Fetching pages from:', url);

  try {
    const response = await axios.get(url, {
      params: { websiteId },
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (response.data.success && response.data.pages) {
      return { success: true, pages: response.data.pages };
    }

    return { success: false, pages: [], error: response.data.error || 'Unknown error' };
  } catch (error) {
    let errorMessage = 'Failed to fetch pages';

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

    return { success: false, pages: [], error: errorMessage };
  }
}

/**
 * Preview info for a page to be pulled
 */
export interface PullPreviewPage {
  slug: string;
  title: string;
  file: string;
  existsLocally: boolean;
}

/**
 * Result of previewing what pages will be pulled
 */
export interface PullPreviewResult {
  success: boolean;
  error?: string;
  /** All pages available on server */
  pages: PullPreviewPage[];
  /** Pages that will create new files */
  newPages: PullPreviewPage[];
  /** Pages that will overwrite existing files */
  existingPages: PullPreviewPage[];
}

/**
 * Preview what pages would be pulled without actually pulling them
 * Use this to show the user what will happen before confirming
 */
export async function previewPull(options: {
  projectPath: string;
  config: WebsiteConfig;
  websiteId?: string;
  jwt?: string;
}): Promise<PullPreviewResult> {
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
        pages: [],
        newPages: [],
        existingPages: [],
      };
    }

    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      success: false,
      error: 'No website ID found. Set websiteId in oaysus.website.json or run "oaysus login"',
      pages: [],
      newPages: [],
      existingPages: [],
    };
  }

  // Fetch pages from server
  const fetchResult = await fetchPages(websiteId, jwt!);

  if (!fetchResult.success) {
    return {
      success: false,
      error: fetchResult.error || 'Failed to fetch pages',
      pages: [],
      newPages: [],
      existingPages: [],
    };
  }

  const serverPages = fetchResult.pages;
  const pagesDir = path.join(projectPath, 'pages');

  const pages: PullPreviewPage[] = [];
  const newPages: PullPreviewPage[] = [];
  const existingPages: PullPreviewPage[] = [];

  for (const serverPage of serverPages) {
    const filename = slugToFilename(serverPage.slug);
    const filePath = path.join(pagesDir, filename);
    const relativePath = path.join('pages', filename);
    const exists = await fileExists(filePath);

    const previewPage: PullPreviewPage = {
      slug: serverPage.slug,
      title: serverPage.title,
      file: relativePath,
      existsLocally: exists,
    };

    pages.push(previewPage);

    if (exists) {
      existingPages.push(previewPage);
    } else {
      newPages.push(previewPage);
    }
  }

  return {
    success: true,
    pages,
    newPages,
    existingPages,
  };
}

/**
 * Pull all pages from the server to local files
 */
export async function pullPages(options: {
  projectPath: string;
  config: WebsiteConfig;
  websiteId?: string;
  jwt?: string;
  force?: boolean;
  dryRun?: boolean;
  onProgress?: PullProgressCallback;
}): Promise<PullResult> {
  const { projectPath, config, force = false, dryRun = false, onProgress } = options;

  // Get credentials if not provided
  let websiteId = options.websiteId || config.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return {
        success: false,
        pages: [],
        fetched: 0,
        written: 0,
        skipped: 0,
        errors: ['Not logged in. Please run "oaysus login"'],
      };
    }

    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      success: false,
      pages: [],
      fetched: 0,
      written: 0,
      skipped: 0,
      errors: ['No website ID found. Set websiteId in oaysus.website.json or run "oaysus login"'],
    };
  }

  // Fetch pages from server
  if (onProgress) {
    onProgress('fetching', 0, 1);
  }

  const fetchResult = await fetchPages(websiteId, jwt!);

  if (!fetchResult.success) {
    return {
      success: false,
      pages: [],
      fetched: 0,
      written: 0,
      skipped: 0,
      errors: [fetchResult.error || 'Failed to fetch pages'],
    };
  }

  const serverPages = fetchResult.pages;

  if (serverPages.length === 0) {
    return {
      success: true,
      pages: [],
      fetched: 0,
      written: 0,
      skipped: 0,
      errors: [],
    };
  }

  if (onProgress) {
    onProgress('fetching', 1, 1);
  }

  // Ensure pages directory exists
  const pagesDir = path.join(projectPath, 'pages');
  if (!dryRun) {
    await fs.mkdir(pagesDir, { recursive: true });
  }

  // Write pages to local files
  const results: PullPageResult[] = [];
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < serverPages.length; i++) {
    const serverPage = serverPages[i];
    const filename = slugToFilename(serverPage.slug);
    const filePath = path.join(pagesDir, filename);
    const relativePath = path.join('pages', filename);

    if (onProgress) {
      onProgress('writing', i + 1, serverPages.length, serverPage.slug);
    }

    // Check if file already exists
    const exists = await fileExists(filePath);

    if (exists && !force) {
      results.push({
        slug: serverPage.slug,
        file: relativePath,
        action: 'skipped',
      });
      skipped++;
      continue;
    }

    // Convert to local format
    const localPage = serverPageToLocal(serverPage);

    // Write file (unless dry run)
    if (!dryRun) {
      try {
        const content = JSON.stringify(localPage, null, 2);
        await fs.writeFile(filePath, content, 'utf-8');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to write ${filename}: ${errorMessage}`);
        continue;
      }
    }

    results.push({
      slug: serverPage.slug,
      file: relativePath,
      action: exists ? 'updated' : 'created',
    });
    written++;
  }

  return {
    success: errors.length === 0,
    pages: results,
    fetched: serverPages.length,
    written,
    skipped,
    errors,
  };
}

/**
 * Format pull results for display
 */
export function formatPullResults(result: PullResult): string[] {
  const lines: string[] = [];

  if (result.fetched === 0) {
    lines.push('No pages found on server');
    return lines;
  }

  lines.push(`✓ Fetched ${result.fetched} page${result.fetched === 1 ? '' : 's'} from server`);
  lines.push('');

  if (result.written > 0 || result.skipped > 0) {
    lines.push('Pages:');
    for (const page of result.pages) {
      const icon = page.action === 'created' ? '+' :
        page.action === 'updated' ? '~' :
          page.action === 'skipped' ? '-' : '?';
      const suffix = page.action === 'skipped' ? ' (skipped, use --force to overwrite)' : '';
      lines.push(`  ${icon} ${page.file} (${page.slug})${suffix}`);
    }
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ✗ ${error}`);
    }
    lines.push('');
  }

  // Summary
  const parts: string[] = [];
  if (result.written > 0) {
    parts.push(`${result.written} written`);
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} skipped`);
  }
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`);
  }

  if (parts.length > 0) {
    lines.push(`Summary: ${parts.join(', ')}`);
  }

  return lines;
}
