/**
 * Package Validator
 * Validates component packages before upload
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { z } from 'zod';
import type {
  ValidationResult,
  ComponentInfo,
  PackageJson,
  ComponentSchema,
} from '../types/validation.js';

// Zod Schemas for validation
const PackageJsonSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Package name must be lowercase letters, numbers, and hyphens only'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver format (e.g., 1.0.0)'),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  dependencies: z.record(z.string(), z.unknown()).optional(),
  devDependencies: z.record(z.string(), z.unknown()).optional(),
  oaysus: z.object({
    theme: z.object({
      name: z.string(),
      displayName: z.string(),
      category: z.string().optional(),
      isPremium: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
});

const ComponentSchemaSchema = z.object({
  type: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  props: z.record(z.string(), z.object({
    type: z.string(),
    default: z.any().optional(),
    required: z.boolean().optional(),
    description: z.string().optional(),
  })),
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
 * Detect framework from package.json dependencies
 */
function detectFramework(packageJson: PackageJson): 'react' | 'vue' | 'svelte' | null {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (allDeps?.react) return 'react';
  if (allDeps?.vue) return 'vue';
  if (allDeps?.svelte) return 'svelte';

  return null;
}

/**
 * Detect project type from directory structure
 */
async function detectType(projectPath: string, framework: 'react' | 'vue' | 'svelte'): Promise<'component' | 'theme-pack' | null> {
  const extension = framework === 'react' ? '.tsx' : framework === 'vue' ? '.vue' : '.svelte';

  // Check for root index file (single component)
  const hasRootIndex = await fileExists(path.join(projectPath, `index${extension}`));

  // Check for components directory (theme pack)
  const hasComponentsDir = await fileExists(path.join(projectPath, 'components'));

  if (hasRootIndex && !hasComponentsDir) {
    return 'component';
  } else if (hasComponentsDir) {
    return 'theme-pack';
  }

  return null;
}

/**
 * Validate a component package
 */
export async function validatePackage(projectPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const components: ComponentInfo[] = [];

  try {
    // 1. Check package.json exists
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!await fileExists(packageJsonPath)) {
      errors.push('Missing package.json');
      return {
        valid: false,
        errors,
        warnings,
        components,
        packageJson: {} as PackageJson,
        inferredConfig: {} as any
      };
    }

    // 2. Validate package.json
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    const packageValidation = PackageJsonSchema.safeParse(packageJson);
    if (!packageValidation.success) {
      const zodError = packageValidation.error;
      zodError.issues.forEach((issue) => {
        const pathStr = issue.path.map(String).join('.');
        errors.push(`Invalid package.json: ${pathStr}: ${issue.message}`);
      });
      return {
        valid: false,
        errors,
        warnings,
        components,
        packageJson,
        inferredConfig: {} as any
      };
    }

    // 3. Detect framework from dependencies
    const framework = detectFramework(packageJson);
    if (!framework) {
      errors.push('Cannot detect framework - add react, vue, or svelte to package.json dependencies');
      return {
        valid: false,
        errors,
        warnings,
        components,
        packageJson,
        inferredConfig: {} as any
      };
    }

    // 4. Detect project type from structure
    const type = await detectType(projectPath, framework);
    if (!type) {
      errors.push('Cannot determine project type - need index.tsx in root (single component) OR components/ directory (theme pack)');
      return {
        valid: false,
        errors,
        warnings,
        components,
        packageJson,
        inferredConfig: {} as any
      };
    }

    // 5. Validate theme metadata (REQUIRED for theme-pack)
    if (type === 'theme-pack') {
      if (!packageJson.oaysus?.theme) {
        errors.push('');
        errors.push('╔════════════════════════════════════════════════════════════════╗');
        errors.push('║  Missing Required Theme Metadata                              ║');
        errors.push('╚════════════════════════════════════════════════════════════════╝');
        errors.push('');
        errors.push('Theme packs require theme metadata in package.json');
        errors.push('');
        errors.push('Add this to your package.json:');
        errors.push('');
        errors.push('  "oaysus": {');
        errors.push('    "theme": {');
        errors.push('      "name": "your-theme-name",');
        errors.push('      "displayName": "Your Theme Name",');
        errors.push('      "description": "Description of your theme",');
        errors.push('      "category": "marketing",');
        errors.push('      "isPremium": false,');
        errors.push('      "tags": ["marketing", "components"]');
        errors.push('    }');
        errors.push('  }');
        errors.push('');
        return {
          valid: false,
          errors,
          warnings,
          components,
          packageJson,
          inferredConfig: {
            framework,
            type,
            componentCount: 0,
            version: packageJson.version,
            name: packageJson.name
          }
        };
      }

      // Validate theme has required fields
      if (!packageJson.oaysus.theme.name || !packageJson.oaysus.theme.displayName) {
        errors.push('Theme must have "name" and "displayName" fields');
        return {
          valid: false,
          errors,
          warnings,
          components,
          packageJson,
          inferredConfig: {
            framework,
            type,
            componentCount: 0,
            version: packageJson.version,
            name: packageJson.name
          }
        };
      }
    }

    // 6. Determine component entry point extension
    const extension = framework === 'react' ? '.tsx' : framework === 'vue' ? '.vue' : '.svelte';

    // 7. Discover components based on inferred type
    let schemaFiles: string[] = [];

    if (type === 'component') {
      // Single component: look for schema.json in root
      if (await fileExists(path.join(projectPath, 'schema.json'))) {
        schemaFiles = ['schema.json'];
      }
    } else {
      // Theme pack: search for schema.json files in components/
      schemaFiles = await glob('components/**/schema.json', {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
      });
    }

    if (schemaFiles.length === 0) {
      errors.push('No components found (no schema.json files detected)');
      return {
        valid: false,
        errors,
        warnings,
        components,
        packageJson,
        inferredConfig: {
          framework,
          type,
          componentCount: 0,
          version: packageJson.version,
          name: packageJson.name
        }
      };
    }

    // 8. Validate each component
    for (const schemaFile of schemaFiles) {
      const schemaPath = path.join(projectPath, schemaFile);
      const componentDir = path.dirname(schemaPath);

      try {
        // Validate schema file
        const schemaContent = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);

        const schemaValidation = ComponentSchemaSchema.safeParse(schema);
        if (!schemaValidation.success) {
          const zodError = schemaValidation.error;
          zodError.issues.forEach((issue) => {
            const pathStr = issue.path.map(String).join('.');
            errors.push(`Invalid schema in ${schemaFile}: ${pathStr}: ${issue.message}`);
          });
          continue;
        }

        // Check entry point exists
        let entryPoint: string;
        if (type === 'component') {
          // Single component: index.tsx/vue/svelte in root
          entryPoint = path.join(projectPath, `index${extension}`);
        } else {
          // Theme pack: index.tsx/vue/svelte in component directory
          entryPoint = path.join(componentDir, `index${extension}`);
        }

        if (!await fileExists(entryPoint)) {
          errors.push(`Missing entry point: ${path.relative(projectPath, entryPoint)}`);
          continue;
        }

        // Add to components list
        components.push({
          name: schema.type,
          displayName: schema.displayName,
          path: componentDir,
          schema: schema as ComponentSchema,
          entryPoint: entryPoint,
        });
      } catch (err) {
        errors.push(`Failed to process ${schemaFile}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    if (components.length === 0) {
      errors.push('No valid components found');
      return {
        valid: false,
        errors,
        warnings,
        components,
        packageJson,
        inferredConfig: {
          framework,
          type,
          componentCount: 0,
          version: packageJson.version,
          name: packageJson.name
        }
      };
    }

    // 8. Check for node_modules (should not be committed)
    if (await fileExists(path.join(projectPath, 'node_modules'))) {
      warnings.push('node_modules directory found (will be automatically excluded from ZIP)');
    }

    // 9. Check for common unnecessary files
    const unnecessaryFiles = ['.git', '.DS_Store', 'dist', 'build', 'coverage'];
    for (const file of unnecessaryFiles) {
      if (await fileExists(path.join(projectPath, file))) {
        warnings.push(`${file} found (will be automatically excluded from ZIP)`);
      }
    }

    // Success - return with inferred configuration
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      components,
      packageJson,
      inferredConfig: {
        framework,
        type,
        componentCount: components.length,
        version: packageJson.version,
        name: packageJson.name,
        theme: packageJson.oaysus?.theme
      }
    };

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      valid: false,
      errors,
      warnings,
      components,
      packageJson: {} as PackageJson,
      inferredConfig: {} as any
    };
  }
}
