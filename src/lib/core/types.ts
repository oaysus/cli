/**
 * Core Types
 * Shared types and interfaces for all framework implementations
 */

import type { ValidationResult, ComponentInfo } from '../../types/validation.js';
import type { DetectedDependency } from '../shared/import-analyzer.js';

export type Framework = 'react' | 'vue' | 'svelte' | 'solid' | 'preact';

// Re-export DetectedDependency for convenience
export type { DetectedDependency };

export interface ComponentBuildOutput {
  name: string;
  displayName: string;
  jsPath: string;
  cssPath?: string;
  schemaPath: string;
  size: number;
}

export interface ServerBuildOutput {
  name: string;
  displayName: string;
  jsPath: string;
  size: number;
}

export interface BuildResult {
  success: boolean;
  outputDir: string;
  components: ComponentBuildOutput[];
  totalSize: number;
  themeCssPath?: string;
  themeCssSize?: number;
  error?: string;
}

export interface ServerBuildResult {
  success: boolean;
  outputDir: string;
  components: ServerBuildOutput[];
  totalSize: number;
  error?: string;
}

export interface BundledDependency {
  name: string;
  version: string;
  mainBundle: string;
  additionalExports?: Record<string, string>;
}

export interface BundleDependencyOptions {
  projectRoot: string;
  outputDir?: string;
}

export interface FrameworkExportConfig {
  exports: string[];
  externals?: string[];
}

export interface ImportMap {
  imports: Record<string, string>;
}

export interface ImportMapWithStylesheets extends ImportMap {
  stylesheets: Record<string, string>;
}

export interface R2ImportMapOptions {
  /** R2 public URL base (e.g., https://pub-xxx.r2.dev) */
  r2PublicUrl: string;
  /** Base path in R2 (e.g., local/chetan/websiteId/themeName/version) */
  r2BasePath: string;
  /** Detected external dependencies to include in import map */
  detectedDeps?: DetectedDependency[];
}

/**
 * Base Builder Interface
 * All framework builders must implement this interface
 */
export interface IBuilder {
  buildComponents(validationResult: ValidationResult, projectPath: string, detectedDeps?: DetectedDependency[]): Promise<BuildResult>;
  buildServerComponents(validationResult: ValidationResult, projectPath: string): Promise<ServerBuildResult>;
  buildThemeCSS(projectPath: string, outputDir: string, packageJson: any): Promise<{ cssPath: string; size: number } | null>;
}

/**
 * Server dependency bundle result
 */
export interface ServerDependencyBundle {
  depKey: string;
  path: string;
  size: number;
}

/**
 * Base Bundler Interface
 * All framework bundlers must implement this interface
 */
export interface IBundler {
  bundleDependencies(
    dependencies: Array<{ name: string; version: string }>,
    options: BundleDependencyOptions
  ): Promise<BundledDependency[]>;
  bundleServerDependencies(
    dependencies: Array<{ name: string; version: string }>,
    options: BundleDependencyOptions
  ): Promise<ServerDependencyBundle[]>;
  bundleDetectedDependencies(
    detectedDeps: DetectedDependency[],
    options: BundleDependencyOptions
  ): Promise<BundledDependency[]>;
  filterRuntimeDependencies(dependencies: Array<{ name: string; version: string }>): Array<{ name: string; version: string }>;
  getBundleSize(bundles: BundledDependency[]): number;
  formatBundleSize(bytes: number): string;
}

/**
 * Base Import Map Generator Interface
 * All framework import map generators must implement this interface
 */
export interface IImportMapGenerator {
  generateImportMapFromPackageJson(packageJson: any): ImportMap;
  generateImportMapWithR2Urls(packageJson: any, options: R2ImportMapOptions): ImportMap;
  generateImportMapWithStylesheets(packageJson: any, options: R2ImportMapOptions): ImportMapWithStylesheets;
  getDependenciesToBundle(packageJson: any): Array<{ name: string; version: string }>;
}
