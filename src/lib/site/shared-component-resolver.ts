/**
 * Shared Component Resolver
 * Handles resolution of shared/global components during CLI publish workflow.
 *
 * Components can be marked as shared in two ways:
 * 1. Explicit `shared: true` in the page JSON component definition
 * 2. `defaultShared: true` in the component schema (auto-shared)
 *
 * This module:
 * - Determines if components should be shared
 * - Extracts shared components from pages
 * - Calls the API to ensure global components exist
 * - Transforms pages to use global references
 */

import axios from 'axios';
import type { ComponentInstance, PageDefinition, ComponentCatalog } from '../../types/site.js';
import { isDefaultShared } from './metadata.js';
import { SSO_BASE_URL, debug } from '../shared/config.js';

/**
 * Shared component info extracted from pages
 */
export interface SharedComponentInfo {
  /** Component type */
  type: string;
  /** Props from first occurrence */
  props: Record<string, unknown>;
  /** Optional name for the shared component */
  name?: string;
}

/**
 * Result of ensuring global components exist
 */
export interface EnsureGlobalResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Map of component type to globalId */
  typeToGlobalId: Map<string, string>;
  /** Components that were created (not existing) */
  created: string[];
  /** Components that already existed */
  existing: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Determine if a component should be shared.
 *
 * Priority:
 * 1. Explicit `shared: true` in component → shared
 * 2. Explicit `shared: false` in component → not shared
 * 3. `defaultShared: true` in catalog/schema → shared
 * 4. Otherwise → not shared
 */
export function shouldBeShared(
  component: ComponentInstance,
  catalog: ComponentCatalog | null
): boolean {
  // Explicit shared flag takes precedence
  if (component.shared === true) return true;
  if (component.shared === false) return false;

  // Fall back to catalog defaultShared
  if (catalog) {
    return isDefaultShared(catalog, component.type);
  }

  return false;
}

/**
 * Extract all shared components from pages.
 * Returns unique types with props from first occurrence.
 */
export function extractSharedComponents(
  pages: PageDefinition[],
  catalog: ComponentCatalog | null
): Map<string, SharedComponentInfo> {
  const sharedComponents = new Map<string, SharedComponentInfo>();
  const conflictingProps = new Map<string, boolean>();

  for (const page of pages) {
    for (const component of page.components) {
      if (!shouldBeShared(component, catalog)) {
        continue;
      }

      const type = component.type;

      if (sharedComponents.has(type)) {
        // Check for conflicting props (for warning)
        const existing = sharedComponents.get(type)!;
        const existingPropsJson = JSON.stringify(existing.props);
        const currentPropsJson = JSON.stringify(component.props);

        if (existingPropsJson !== currentPropsJson && !conflictingProps.has(type)) {
          conflictingProps.set(type, true);
          debug(`[SharedResolver] Warning: Conflicting props for shared component "${type}". Using props from first occurrence.`);
        }
      } else {
        // First occurrence - use these props
        sharedComponents.set(type, {
          type,
          props: component.props,
          name: component.sharedName,
        });
      }
    }
  }

  return sharedComponents;
}

/**
 * Call API to ensure global components exist.
 * Creates new globals or returns existing ones.
 */
export async function ensureGlobalComponents(
  websiteId: string,
  components: Map<string, SharedComponentInfo>,
  jwt: string
): Promise<EnsureGlobalResult> {
  if (components.size === 0) {
    return {
      success: true,
      typeToGlobalId: new Map(),
      created: [],
      existing: [],
    };
  }

  debug(`[SharedResolver] Ensuring ${components.size} global components exist`);

  try {
    const requestBody = {
      websiteId,
      components: Array.from(components.values()).map(comp => ({
        componentType: comp.type,
        props: comp.props,
        name: comp.name || comp.type,
      })),
    };

    const response = await axios.post(
      `${SSO_BASE_URL}/hosting/page-builder/globals/ensure-batch`,
      requestBody,
      {
        headers: { Authorization: `Bearer ${jwt}` },
      }
    );

    if (!response.data.success) {
      return {
        success: false,
        typeToGlobalId: new Map(),
        created: [],
        existing: [],
        error: response.data.error || 'Failed to ensure global components',
      };
    }

    // Build result maps
    const typeToGlobalId = new Map<string, string>();
    const created: string[] = [];
    const existing: string[] = [];

    for (const [type, result] of Object.entries(response.data.results)) {
      const resultData = result as { globalId: string; created: boolean };
      typeToGlobalId.set(type, resultData.globalId);

      if (resultData.created) {
        created.push(type);
        debug(`[SharedResolver] Created global component: ${type} → ${resultData.globalId}`);
      } else {
        existing.push(type);
        debug(`[SharedResolver] Using existing global: ${type} → ${resultData.globalId}`);
      }
    }

    return {
      success: true,
      typeToGlobalId,
      created,
      existing,
    };
  } catch (error) {
    let errorMessage = 'Failed to ensure global components';

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
      typeToGlobalId: new Map(),
      created: [],
      existing: [],
      error: errorMessage,
    };
  }
}

/**
 * Transform a page to use global references for shared components.
 * Replaces inline component definitions with global references.
 */
export function applyGlobalReferences(
  page: PageDefinition,
  typeToGlobalId: Map<string, string>,
  catalog: ComponentCatalog | null
): PageDefinition {
  const transformedComponents = page.components.map(component => {
    // Check if this component should be shared and has a global reference
    if (!shouldBeShared(component, catalog)) {
      return component;
    }

    const globalId = typeToGlobalId.get(component.type);
    if (!globalId) {
      return component;
    }

    // Transform to use global reference
    return {
      ...component,
      globalId,
      isGlobal: true,
      // Keep props for local override capability (server will use global props)
    };
  });

  return {
    ...page,
    components: transformedComponents,
  };
}

/**
 * Process all pages for shared components.
 * Main entry point for the publish workflow.
 */
export async function resolveSharedComponents(options: {
  pages: Array<{ file: string; definition: PageDefinition }>;
  websiteId: string;
  jwt: string;
  catalog: ComponentCatalog | null;
}): Promise<{
  success: boolean;
  pages: Array<{ file: string; definition: PageDefinition }>;
  created: string[];
  existing: string[];
  error?: string;
}> {
  const { pages, websiteId, jwt, catalog } = options;

  // Extract shared components from all pages
  const sharedComponents = extractSharedComponents(
    pages.map(p => p.definition),
    catalog
  );

  if (sharedComponents.size === 0) {
    debug('[SharedResolver] No shared components to resolve');
    return {
      success: true,
      pages,
      created: [],
      existing: [],
    };
  }

  debug(`[SharedResolver] Found ${sharedComponents.size} shared component types`);

  // Ensure global components exist on server
  const ensureResult = await ensureGlobalComponents(websiteId, sharedComponents, jwt);

  if (!ensureResult.success) {
    return {
      success: false,
      pages,
      created: [],
      existing: [],
      error: ensureResult.error,
    };
  }

  // Transform pages to use global references
  const transformedPages = pages.map(page => ({
    file: page.file,
    definition: applyGlobalReferences(page.definition, ensureResult.typeToGlobalId, catalog),
  }));

  return {
    success: true,
    pages: transformedPages,
    created: ensureResult.created,
    existing: ensureResult.existing,
  };
}
