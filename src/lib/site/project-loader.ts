/**
 * Website Project Loader
 * Loads project config and pages/*.json files
 * Supports both new .oaysus/ metadata and legacy oaysus.website.json
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { z } from 'zod';
import type {
  WebsiteConfig,
  PageDefinition,
  LoadedProject,
  ComponentInstance,
  PageSettings,
} from '../../types/site.js';
import {
  loadConfig as loadOaysusConfig,
  findProjectRoot as findOaysusProjectRoot,
  getWebsiteId,
} from './metadata.js';

// Zod Schemas for validation
const ComponentInstanceSchema = z.object({
  type: z.string().min(1, 'Component type is required'),
  id: z.string().optional(),
  props: z.record(z.string(), z.unknown()).default({}),
  settings: z.record(z.string(), z.unknown()).optional(),
  // Shared component fields
  shared: z.boolean().optional(),
  sharedName: z.string().optional(),
  globalId: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

const SEOSettingsSchema = z.object({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  noIndex: z.boolean().optional(),
  noFollow: z.boolean().optional(),
});

const LayoutSettingsSchema = z.object({
  maxWidth: z.enum(['full', 'container', 'narrow']).optional(),
  padding: z.enum(['none', 'small', 'medium', 'large']).optional(),
});

const ScriptSettingsSchema = z.object({
  headScripts: z.array(z.string()).optional(),
  bodyScripts: z.array(z.string()).optional(),
});

const PageSettingsSchema = z.object({
  seo: SEOSettingsSchema.optional(),
  layout: LayoutSettingsSchema.optional(),
  scripts: ScriptSettingsSchema.optional(),
});

const PageDefinitionSchema = z.object({
  slug: z.string().regex(/^\//, 'Slug must start with /'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  isHomePage: z.boolean().optional(),
  components: z.array(ComponentInstanceSchema).default([]),
  settings: PageSettingsSchema.optional(),
});

const WebsiteConfigSchema = z.object({
  websiteId: z.string().optional(),
  themePacks: z.array(z.string()).optional(),
});

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
 * Find the website project root by looking for .oaysus/ or oaysus.website.json
 * Uses the metadata module's findProjectRoot which handles both cases
 */
export async function findProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
  return findOaysusProjectRoot(startPath);
}

/**
 * Load and validate the website configuration
 * Checks .oaysus/config.json first, falls back to legacy oaysus.website.json
 */
export async function loadWebsiteConfig(projectPath: string): Promise<{
  config: WebsiteConfig | null;
  error: string | null;
}> {
  // Try new .oaysus/config.json first
  const oaysusConfig = await loadOaysusConfig(projectPath);
  if (oaysusConfig) {
    return {
      config: {
        websiteId: oaysusConfig.websiteId,
      },
      error: null,
    };
  }

  // Fall back to legacy oaysus.website.json
  const legacyPath = path.join(projectPath, 'oaysus.website.json');

  if (!await fileExists(legacyPath)) {
    // Check if we can get websiteId from credentials
    const websiteId = await getWebsiteId(projectPath);
    if (websiteId) {
      return {
        config: { websiteId },
        error: null,
      };
    }

    return {
      config: null,
      error: 'No project configuration found. Run "oaysus site init" to set up this project.',
    };
  }

  try {
    const content = await fs.readFile(legacyPath, 'utf-8');
    const parsed = JSON.parse(content);

    const validation = WebsiteConfigSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      return {
        config: null,
        error: `Invalid oaysus.website.json: ${issues}`,
      };
    }

    return { config: validation.data, error: null };
  } catch (err) {
    return {
      config: null,
      error: `Failed to parse oaysus.website.json: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Load and validate a single page definition
 */
export async function loadPageDefinition(filePath: string): Promise<{
  definition: PageDefinition | null;
  error: string | null;
}> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    const validation = PageDefinitionSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      return {
        definition: null,
        error: `Invalid page definition: ${issues}`,
      };
    }

    return { definition: validation.data as PageDefinition, error: null };
  } catch (err) {
    return {
      definition: null,
      error: `Failed to parse page file: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Discover all page files in the pages directory
 */
export async function discoverPageFiles(projectPath: string): Promise<string[]> {
  const pagesDir = path.join(projectPath, 'pages');

  if (!await fileExists(pagesDir)) {
    return [];
  }

  const pageFiles = await glob('**/*.json', {
    cwd: pagesDir,
    ignore: ['node_modules/**'],
  });

  return pageFiles.map(f => path.join(pagesDir, f));
}

/**
 * Load an entire website project
 */
export async function loadProject(projectPath?: string): Promise<LoadedProject> {
  const errors: string[] = [];
  const pages: LoadedProject['pages'] = [];

  // Find project root if not specified
  const resolvedPath = projectPath
    ? path.resolve(projectPath)
    : await findProjectRoot();

  if (!resolvedPath) {
    return {
      projectPath: projectPath || process.cwd(),
      config: {},
      pages: [],
      errors: ['Could not find oaysus.website.json. Run "oaysus site init" to create a website project.'],
    };
  }

  // Load website config
  const { config, error: configError } = await loadWebsiteConfig(resolvedPath);
  if (configError) {
    errors.push(configError);
  }

  // Discover and load pages
  const pageFiles = await discoverPageFiles(resolvedPath);

  if (pageFiles.length === 0) {
    errors.push('No page files found in pages/ directory');
  }

  for (const pageFile of pageFiles) {
    const { definition, error: pageError } = await loadPageDefinition(pageFile);

    if (pageError) {
      errors.push(`${path.relative(resolvedPath, pageFile)}: ${pageError}`);
      continue;
    }

    if (definition) {
      pages.push({
        file: path.relative(resolvedPath, pageFile),
        definition,
      });
    }
  }

  // Check for duplicate slugs
  const slugs = new Map<string, string[]>();
  for (const page of pages) {
    const slug = page.definition.slug;
    if (!slugs.has(slug)) {
      slugs.set(slug, []);
    }
    slugs.get(slug)!.push(page.file);
  }

  for (const [slug, files] of slugs) {
    if (files.length > 1) {
      errors.push(`Duplicate slug "${slug}" found in: ${files.join(', ')}`);
    }
  }

  // Check for multiple home pages
  const homePages = pages.filter(p => p.definition.isHomePage);
  if (homePages.length > 1) {
    errors.push(`Multiple home pages found: ${homePages.map(p => p.file).join(', ')}`);
  }

  return {
    projectPath: resolvedPath,
    config: config || {},
    pages,
    errors,
  };
}

/**
 * Load a single page by file path or slug
 */
export async function loadSinglePage(
  projectPath: string,
  identifier: string
): Promise<{
  page: { file: string; definition: PageDefinition } | null;
  error: string | null;
}> {
  // Check if identifier is a file path
  if (identifier.endsWith('.json')) {
    const filePath = path.isAbsolute(identifier)
      ? identifier
      : path.join(projectPath, identifier);

    if (!await fileExists(filePath)) {
      return { page: null, error: `Page file not found: ${identifier}` };
    }

    const { definition, error } = await loadPageDefinition(filePath);
    if (error) {
      return { page: null, error };
    }

    return {
      page: {
        file: path.relative(projectPath, filePath),
        definition: definition!,
      },
      error: null,
    };
  }

  // Otherwise, treat as a slug and search for matching page
  const pageFiles = await discoverPageFiles(projectPath);

  for (const pageFile of pageFiles) {
    const { definition } = await loadPageDefinition(pageFile);
    if (definition && definition.slug === identifier) {
      return {
        page: {
          file: path.relative(projectPath, pageFile),
          definition,
        },
        error: null,
      };
    }
  }

  return { page: null, error: `No page found with slug: ${identifier}` };
}
