/**
 * Page Validator
 * Validates pages against installed components on a website
 */

import axios from 'axios';
import type {
  PageDefinition,
  LoadedProject,
  PageValidationResult,
  SiteValidationResult,
  InstalledComponent,
  AssetReference,
} from '../../types/site.js';
import { loadCredentials } from '../shared/auth.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';
import { findAssetsInPage, assetExists } from './asset-resolver.js';
import { loadComponentCatalog, syncComponentCatalog, isCatalogStale } from './metadata.js';

/**
 * Fetch installed components for a website
 */
export async function fetchInstalledComponents(
  websiteId: string,
  jwt: string
): Promise<InstalledComponent[]> {
  const url = `${SSO_BASE_URL}/hosting/page-builder/components/custom`;

  debug('Fetching installed components');
  debug('API URL:', url);
  debug('Website ID:', websiteId);

  try {
    const response = await axios.get(url, {
      params: { websiteId },
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (response.data.success && response.data.components) {
      return response.data.components.map((c: any) => ({
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        sourceThemePackId: c.themePackId,
        sourceThemePackName: c.themePack?.displayName,
        schema: c.schema,
      }));
    }

    return [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      debug('Fetch components failed:', error.response?.status, error.response?.data);
      throw new Error(
        error.response?.data?.error ||
        error.response?.data?.detail?.error ||
        'Failed to fetch installed components'
      );
    }
    throw error;
  }
}

/**
 * Validate a single page against installed components
 */
export async function validatePage(
  pageFile: string,
  page: PageDefinition,
  installedComponents: InstalledComponent[],
  projectPath: string
): Promise<PageValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unresolvedComponents: string[] = [];
  const localAssets: AssetReference[] = [];

  // Build lookup set for installed component names
  const installedNames = new Set(installedComponents.map(c => c.name));

  // Validate each component
  for (let i = 0; i < page.components.length; i++) {
    const component = page.components[i];

    // Check if component type is installed
    if (!installedNames.has(component.type)) {
      unresolvedComponents.push(component.type);
      errors.push(
        `Component "${component.type}" is not installed on this website`
      );
    }

    // TODO: Validate props against component schema
    // This would require fetching and parsing the component schemas
  }

  // Find local asset references
  const assets = findAssetsInPage(page, pageFile);
  localAssets.push(...assets);

  // Verify local assets exist
  for (const asset of assets) {
    const exists = await assetExists(asset, projectPath);
    if (!exists) {
      errors.push(`Asset not found: ${asset.localPath} (referenced in ${pageFile})`);
    }
  }

  // Validate slug format
  if (!page.slug.startsWith('/')) {
    errors.push(`Slug must start with "/": ${page.slug}`);
  }

  // Warn about empty descriptions
  if (!page.description) {
    warnings.push('Page is missing a description (recommended for SEO)');
  }

  // Warn if SEO settings are missing
  if (!page.settings?.seo?.metaTitle) {
    warnings.push('Page is missing metaTitle in SEO settings');
  }

  return {
    valid: errors.length === 0,
    pageFile,
    slug: page.slug,
    errors,
    warnings,
    unresolvedComponents,
    localAssets,
  };
}

/**
 * Validate an entire website project
 */
export async function validateProject(
  project: LoadedProject,
  options: {
    websiteId?: string;
    jwt?: string;
  } = {}
): Promise<SiteValidationResult> {
  // Get credentials if not provided
  let websiteId = options.websiteId;
  let jwt = options.jwt;

  if (!websiteId || !jwt) {
    const credentials = await loadCredentials();
    if (!credentials) {
      return {
        valid: false,
        pages: [],
        totalErrors: 1,
        totalWarnings: 0,
        allAssets: [],
      };
    }

    websiteId = websiteId || project.config.websiteId || credentials.websiteId;
    jwt = jwt || credentials.jwt;
  }

  if (!websiteId) {
    return {
      valid: false,
      pages: [{
        valid: false,
        pageFile: '',
        slug: '',
        errors: ['No website ID found. Set websiteId in oaysus.website.json or run "oaysus login"'],
        warnings: [],
        unresolvedComponents: [],
        localAssets: [],
      }],
      totalErrors: 1,
      totalWarnings: 0,
      allAssets: [],
    };
  }

  // Get installed components from local catalog or fetch from server
  let installedComponents: InstalledComponent[] = [];
  try {
    // Check local catalog first
    const catalog = await loadComponentCatalog(project.projectPath);
    const isStale = await isCatalogStale(project.projectPath);

    if (catalog && catalog.themePacks.length > 0 && !isStale) {
      // Use local catalog
      debug('Using local component catalog');
      for (const pack of catalog.themePacks) {
        for (const comp of pack.components) {
          installedComponents.push({
            id: `${pack.id}:${comp.type}`,
            name: comp.type,
            displayName: comp.displayName,
            sourceThemePackId: pack.id,
            sourceThemePackName: pack.name,
            schema: comp.schema as Record<string, unknown> | undefined,
          });
        }
      }
    } else {
      // Sync catalog from server
      debug('Syncing component catalog from server');
      const syncResult = await syncComponentCatalog({
        projectPath: project.projectPath,
        websiteId,
        jwt,
        force: true,
      });

      if (syncResult.success && syncResult.catalog) {
        for (const pack of syncResult.catalog.themePacks) {
          for (const comp of pack.components) {
            installedComponents.push({
              id: `${pack.id}:${comp.type}`,
              name: comp.type,
              displayName: comp.displayName,
              sourceThemePackId: pack.id,
              sourceThemePackName: pack.name,
              schema: comp.schema as Record<string, unknown> | undefined,
            });
          }
        }
      } else {
        // Fallback to direct API fetch if sync fails
        installedComponents = await fetchInstalledComponents(websiteId, jwt!);
      }
    }
  } catch (error) {
    return {
      valid: false,
      pages: [{
        valid: false,
        pageFile: '',
        slug: '',
        errors: [`Failed to fetch installed components: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        unresolvedComponents: [],
        localAssets: [],
      }],
      totalErrors: 1,
      totalWarnings: 0,
      allAssets: [],
    };
  }

  // Validate each page
  const pageResults: PageValidationResult[] = [];
  const allAssets: AssetReference[] = [];

  for (const page of project.pages) {
    const result = await validatePage(
      page.file,
      page.definition,
      installedComponents,
      project.projectPath
    );
    pageResults.push(result);
    allAssets.push(...result.localAssets);
  }

  // Calculate totals
  const totalErrors = pageResults.reduce((sum, p) => sum + p.errors.length, 0);
  const totalWarnings = pageResults.reduce((sum, p) => sum + p.warnings.length, 0);

  return {
    valid: totalErrors === 0,
    pages: pageResults,
    totalErrors,
    totalWarnings,
    allAssets,
  };
}

/**
 * Get list of missing components across all pages
 */
export function getMissingComponents(result: SiteValidationResult): string[] {
  const missing = new Set<string>();
  for (const page of result.pages) {
    for (const comp of page.unresolvedComponents) {
      missing.add(comp);
    }
  }
  return Array.from(missing);
}

/**
 * Format validation results for display
 */
export function formatValidationResults(result: SiteValidationResult): string[] {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ All pages validated successfully');
    lines.push(`  ${result.pages.length} pages, ${result.allAssets.length} assets`);
  } else {
    lines.push('✗ Validation failed');
    lines.push('');

    for (const page of result.pages) {
      if (!page.valid) {
        lines.push(`  ${page.pageFile} (${page.slug})`);
        for (const error of page.errors) {
          lines.push(`    ✗ ${error}`);
        }
      }
    }
  }

  // Show warnings even if valid
  const pagesWithWarnings = result.pages.filter(p => p.warnings.length > 0);
  if (pagesWithWarnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const page of pagesWithWarnings) {
      for (const warning of page.warnings) {
        lines.push(`  ⚠ ${page.pageFile}: ${warning}`);
      }
    }
  }

  // Show missing components summary
  const missing = getMissingComponents(result);
  if (missing.length > 0) {
    lines.push('');
    lines.push('Missing components:');
    for (const comp of missing) {
      lines.push(`  • ${comp}`);
    }
    lines.push('');
    lines.push('Install these components via theme packs or upload them with "oaysus theme push"');
  }

  return lines;
}
