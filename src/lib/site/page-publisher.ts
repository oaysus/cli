/**
 * Page Publisher
 * Publishes pages to the Oaysus platform via API
 */

import axios from 'axios';
import type {
  PageDefinition,
  LoadedProject,
  PublishPageResult,
  PublishResult,
  AssetReference,
  UploadedAssetInfo,
} from '../../types/site.js';
import { loadCredentials } from '../shared/auth.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';
import { findAllAssets, replaceAssetPaths } from './asset-resolver.js';
import { uploadAssets } from './asset-uploader.js';
import { validateProject } from './page-validator.js';

/**
 * Publish progress callback
 */
export type PublishProgressCallback = (
  stage: 'validating' | 'uploading-assets' | 'publishing-pages',
  current: number,
  total: number,
  detail?: string
) => void;

/**
 * Check if a page exists by slug
 */
async function getPageBySlug(
  websiteId: string,
  slug: string,
  jwt: string
): Promise<{ id: string; exists: boolean }> {
  const url = `${SSO_BASE_URL}/hosting/page-builder/pages/by-slug`;

  try {
    const response = await axios.get(url, {
      params: { websiteId, slug },
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (response.data.success && response.data.page) {
      return { id: response.data.page.id, exists: true };
    }

    return { id: '', exists: false };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { id: '', exists: false };
    }
    throw error;
  }
}

/**
 * Check which pages from a project already exist on the server
 * Returns list of slugs that will be overwritten
 */
export async function checkExistingPages(
  project: LoadedProject,
  options: {
    websiteId?: string;
    jwt?: string;
  } = {}
): Promise<{ existingPages: string[]; newPages: string[] }> {
  // Get credentials if not provided
  let websiteId = options.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return { existingPages: [], newPages: [] };
    }

    websiteId = websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return { existingPages: [], newPages: [] };
  }

  const existingPages: string[] = [];
  const newPages: string[] = [];

  for (const page of project.pages) {
    const existing = await getPageBySlug(websiteId, page.definition.slug, jwt!);
    if (existing.exists) {
      existingPages.push(page.definition.slug);
    } else {
      newPages.push(page.definition.slug);
    }
  }

  return { existingPages, newPages };
}

/**
 * Create a new page and publish it
 */
async function createPage(
  websiteId: string,
  page: PageDefinition,
  jwt: string
): Promise<{ id: string; success: boolean; error?: string }> {
  const createUrl = `${SSO_BASE_URL}/hosting/page-builder/pages`;

  debug('Creating page:', page.slug);

  try {
    // First create the page (creates as DRAFT)
    const response = await axios.post(
      createUrl,
      {
        websiteId,
        title: page.title,
        slug: page.slug,
        description: page.description,
        isHomePage: page.isHomePage || false,
        components: page.components,
        settings: page.settings || {},
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.success || !response.data.page) {
      return { id: '', success: false, error: response.data.error };
    }

    const pageId = response.data.page.id;

    // Now publish the page by setting status to PUBLISHED
    // This triggers SSR + R2 upload in the FastAPI endpoint
    const publishUrl = `${SSO_BASE_URL}/hosting/page-builder/pages/${pageId}`;
    const publishResponse = await axios.put(
      publishUrl,
      {
        status: 'PUBLISHED',
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (publishResponse.data.success) {
      return { id: pageId, success: true };
    }

    // Page was created but publish failed - still return the page ID
    return { id: pageId, success: false, error: publishResponse.data.error || 'Failed to publish after creation' };
  } catch (error) {
    let errorMessage = 'Failed to create page';

    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error ||
        error.response?.data?.detail?.error ||
        error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { id: '', success: false, error: errorMessage };
  }
}

/**
 * Update an existing page and publish it
 */
async function updatePage(
  pageId: string,
  page: PageDefinition,
  jwt: string
): Promise<{ success: boolean; error?: string }> {
  const url = `${SSO_BASE_URL}/hosting/page-builder/pages/${pageId}`;

  debug('Updating page:', page.slug);

  try {
    const response = await axios.put(
      url,
      {
        title: page.title,
        slug: page.slug,
        description: page.description,
        isHomePage: page.isHomePage,
        components: page.components,
        settings: page.settings || {},
        // Set status to PUBLISHED to trigger SSR + R2 upload
        status: 'PUBLISHED',
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      return { success: true };
    }

    return { success: false, error: response.data.error };
  } catch (error) {
    let errorMessage = 'Failed to update page';

    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.error ||
        error.response?.data?.detail?.error ||
        error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Publish a single page (create or update)
 */
export async function publishPage(
  page: PageDefinition,
  options: {
    websiteId: string;
    jwt: string;
    assetMap?: Map<string, UploadedAssetInfo>;
  }
): Promise<PublishPageResult> {
  const { websiteId, jwt, assetMap } = options;

  // Replace asset paths if we have a map
  const processedPage = assetMap
    ? replaceAssetPaths(page, assetMap)
    : page;

  try {
    // Check if page exists
    const existing = await getPageBySlug(websiteId, page.slug, jwt);

    if (existing.exists) {
      // Update existing page
      const result = await updatePage(existing.id, processedPage, jwt);

      if (result.success) {
        return {
          slug: page.slug,
          action: 'updated',
          pageId: existing.id,
        };
      }

      return {
        slug: page.slug,
        action: 'failed',
        error: result.error,
      };
    }

    // Create new page
    const result = await createPage(websiteId, processedPage, jwt);

    if (result.success) {
      return {
        slug: page.slug,
        action: 'created',
        pageId: result.id,
      };
    }

    return {
      slug: page.slug,
      action: 'failed',
      error: result.error,
    };
  } catch (error) {
    return {
      slug: page.slug,
      action: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Publish an entire project
 */
export async function publishProject(
  project: LoadedProject,
  options: {
    websiteId?: string;
    jwt?: string;
    dryRun?: boolean;
    skipValidation?: boolean;
    onProgress?: PublishProgressCallback;
  } = {}
): Promise<PublishResult> {
  // Get credentials if not provided
  let websiteId = options.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return {
        success: false,
        pages: [],
        assetsUploaded: 0,
        created: 0,
        updated: 0,
        errors: 1,
      };
    }

    websiteId = websiteId || project.config.websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      success: false,
      pages: [{
        slug: '',
        action: 'failed',
        error: 'No website ID found. Set websiteId in oaysus.website.json or run "oaysus login"',
      }],
      assetsUploaded: 0,
      created: 0,
      updated: 0,
      errors: 1,
    };
  }

  // Validate if not skipped
  if (!options.skipValidation) {
    if (options.onProgress) {
      options.onProgress('validating', 0, 1);
    }

    const validation = await validateProject(project, { websiteId, jwt });

    if (!validation.valid) {
      return {
        success: false,
        pages: validation.pages.map(p => ({
          slug: p.slug,
          action: 'failed' as const,
          error: p.errors.join('; '),
        })),
        assetsUploaded: 0,
        created: 0,
        updated: 0,
        errors: validation.totalErrors,
      };
    }
  }

  // Find and upload assets
  const allAssets = findAllAssets(project);
  let assetMap = new Map<string, UploadedAssetInfo>();
  let assetsUploaded = 0;

  if (allAssets.length > 0 && !options.dryRun) {
    if (options.onProgress) {
      options.onProgress('uploading-assets', 0, allAssets.length);
    }

    const uploadResult = await uploadAssets(allAssets, project.projectPath, {
      websiteId,
      jwt,
      onProgress: (current, total) => {
        if (options.onProgress) {
          options.onProgress('uploading-assets', current, total);
        }
      },
    });

    assetMap = uploadResult.assetMap;
    assetsUploaded = uploadResult.successCount;

    if (uploadResult.errorCount > 0) {
      // Continue with publishing but note the errors
      debug(`Asset upload had ${uploadResult.errorCount} errors`);
    }
  }

  // Publish pages
  const pageResults: PublishPageResult[] = [];
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i];

    if (options.onProgress) {
      options.onProgress('publishing-pages', i + 1, project.pages.length, page.definition.slug);
    }

    if (options.dryRun) {
      // In dry run, check if page exists but don't actually publish
      const existing = await getPageBySlug(websiteId!, page.definition.slug, jwt!);
      pageResults.push({
        slug: page.definition.slug,
        action: existing.exists ? 'updated' : 'created',
        pageId: existing.id || undefined,
      });
      if (existing.exists) {
        updated++;
      } else {
        created++;
      }
    } else {
      // Actually publish
      const result = await publishPage(page.definition, {
        websiteId: websiteId!,
        jwt: jwt!,
        assetMap,
      });

      pageResults.push(result);

      if (result.action === 'created') {
        created++;
      } else if (result.action === 'updated') {
        updated++;
      } else if (result.action === 'failed') {
        errors++;
      }
    }
  }

  return {
    success: errors === 0,
    pages: pageResults,
    assetsUploaded,
    created,
    updated,
    errors,
  };
}

/**
 * Publish a single page file from a project
 */
export async function publishSinglePage(
  project: LoadedProject,
  pageIdentifier: string,
  options: {
    websiteId?: string;
    jwt?: string;
    onProgress?: PublishProgressCallback;
  } = {}
): Promise<PublishResult> {
  // Find the page
  const targetPage = project.pages.find(p =>
    p.file === pageIdentifier ||
    p.definition.slug === pageIdentifier
  );

  if (!targetPage) {
    return {
      success: false,
      pages: [{
        slug: pageIdentifier,
        action: 'failed',
        error: `Page not found: ${pageIdentifier}`,
      }],
      assetsUploaded: 0,
      created: 0,
      updated: 0,
      errors: 1,
    };
  }

  // Create a mini project with just this page
  const singlePageProject: LoadedProject = {
    ...project,
    pages: [targetPage],
  };

  return publishProject(singlePageProject, options);
}

/**
 * Format publish results for display
 */
export function formatPublishResults(result: PublishResult): string[] {
  const lines: string[] = [];

  if (result.success) {
    lines.push('✓ Publishing complete');
    lines.push('');

    if (result.assetsUploaded > 0) {
      lines.push(`  Assets uploaded: ${result.assetsUploaded}`);
    }

    if (result.created > 0) {
      lines.push(`  Pages created: ${result.created}`);
    }

    if (result.updated > 0) {
      lines.push(`  Pages updated: ${result.updated}`);
    }
  } else {
    lines.push('✗ Publishing failed');
    lines.push('');

    for (const page of result.pages) {
      if (page.action === 'failed') {
        lines.push(`  ✗ ${page.slug}: ${page.error}`);
      }
    }
  }

  // List all pages with their status
  lines.push('');
  lines.push('Pages:');
  for (const page of result.pages) {
    const icon = page.action === 'failed' ? '✗' :
      page.action === 'created' ? '+' :
        page.action === 'updated' ? '~' : '-';
    lines.push(`  ${icon} ${page.slug}`);
  }

  return lines;
}
