/**
 * Validation Types
 * Type definitions for package validation and ZIP creation
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  components: ComponentInfo[];
  packageJson: PackageJson;
  inferredConfig: InferredConfig;
}

export interface InferredConfig {
  framework: 'react' | 'vue' | 'svelte';
  type: 'component' | 'theme-pack';
  componentCount: number;
  version: string;
  name: string;
  theme?: {
    name: string;
    displayName: string;
    description?: string;
    category?: string;
    isPremium?: boolean;
    tags?: string[];
  };
}

export interface ComponentInfo {
  name: string;
  displayName: string;
  path: string;
  schema: ComponentSchema;
  entryPoint: string;
}

export interface ComponentSchema {
  type: string;
  displayName: string;
  description?: string;
  category?: string;
  props: Record<string, PropDefinition>;
}

export interface PropDefinition {
  type: string;
  default?: any;
  required?: boolean;
  description?: string;
}

export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  oaysus?: {
    theme?: {
      name: string;
      displayName: string;
      description?: string;
      category?: string;
      isPremium?: boolean;
      tags?: string[];
    };
  };
}

export interface OaysusConfig {
  name: string;
  version: string;
  type: 'component' | 'theme-pack';
  framework: 'react' | 'vue' | 'svelte';
  entryPoint?: string;
  components?: string[];
  exclude?: string[];
  build?: {
    target?: string;
    minify?: boolean;
    sourcemap?: boolean;
    external?: string[];
  };
}

export interface ZipResult {
  buffer: Buffer;
  size: number;
  sha256: string;
  fileCount: number;
  excludedCount: number;
  files: string[];
}

export interface UploadInfo {
  packageId: string;
  uploadUrl: string;
  expiresIn: number;
  maxSize: number;
}

export interface BuildResult {
  buildId: string;
  status: 'BUILDING' | 'SUCCESS' | 'FAILED';
  taskArn: string;
  components: Array<{
    id: string;
    name: string;
    displayName: string;
    framework: string;
  }>;
  dashboardUrl: string;
}
