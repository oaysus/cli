/**
 * Template Type Definitions
 * Types for project scaffolding and component generation
 */

export type Framework = 'react' | 'vue' | 'svelte';

/**
 * Options for initializing a new project
 * All projects use theme pack structure (components/ directory)
 */
export interface InitOptions {
  projectName: string;
  description: string;
  framework: Framework;
  author: string;
}

/**
 * Options for creating a new component
 */
export interface CreateComponentOptions {
  name: string;
  displayName: string;
  category?: string;
  description?: string;
}

/**
 * Template variables that can be replaced in template files
 */
export interface TemplateVariables {
  PROJECT_NAME: string;
  DISPLAY_NAME: string;
  DESCRIPTION: string;
  AUTHOR: string;
  FRAMEWORK: Framework;
  COMPONENT_NAME?: string;
  COMPONENT_TYPE?: string;
  CATEGORY?: string;
}

/**
 * Template file metadata
 */
export interface TemplateFile {
  sourcePath: string;
  targetPath: string;
  variables: TemplateVariables;
}

/**
 * Result of project generation
 */
export interface GenerationResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  error?: string;
}
