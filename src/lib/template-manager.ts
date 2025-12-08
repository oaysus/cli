/**
 * Template Manager
 * Handles template file operations and variable replacement
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Framework, TemplateVariables } from '../types/templates.js';
import { readFile, writeFile } from './shared/file-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the templates directory path
 * Templates are in src/templates, but when running from dist/,
 * we need to go up to project root and back into src/templates
 */
export function getTemplatesDir(): string {
  // From dist/lib/ -> go up to project root -> into src/templates
  return path.join(__dirname, '..', '..', 'src', 'templates');
}

/**
 * Get the template directory for a specific framework
 * All projects use theme pack structure
 */
export function getTemplateDir(framework: Framework): string {
  const templateName = `${framework}-theme-pack`;
  return path.join(getTemplatesDir(), templateName);
}

/**
 * Replace template variables in content
 */
export function replaceVariables(content: string, variables: TemplateVariables): string {
  let result = content;

  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
  });

  return result;
}

/**
 * Process a template file and write to destination
 */
export function processTemplate(
  templatePath: string,
  targetPath: string,
  variables: TemplateVariables
): void {
  const content = readFile(templatePath);
  const processedContent = replaceVariables(content, variables);
  writeFile(targetPath, processedContent);
}

/**
 * Get file extension for framework
 */
export function getComponentExtension(framework: Framework): string {
  switch (framework) {
    case 'react':
      return '.tsx';
    case 'vue':
      return '.vue';
    case 'svelte':
      return '.svelte';
    default:
      return '.tsx';
  }
}

/**
 * Get example component type based on framework
 */
export function getExampleComponentType(framework: Framework): string {
  return `${framework}-hero`;
}
