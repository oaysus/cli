/**
 * Site Library
 * Utilities for website project management and publishing
 */

export * from './project-loader.js';
export * from './asset-resolver.js';
export * from './page-validator.js';
export * from './asset-uploader.js';
export * from './page-publisher.js';
export * from './page-puller.js';
export * from './asset-puller.js';

// Selectively export from metadata to avoid conflicts with project-loader
export {
  ensureOaysusDir,
  hasOaysusMetadata,
  loadConfig,
  saveConfig,
  getWebsiteId,
  loadComponentCatalog,
  saveComponentCatalog,
  syncComponentCatalog,
  isCatalogStale,
  componentExists,
  findComponent,
  getSuggestions,
  loadAssetManifest,
  saveAssetManifest,
  migrateLegacyConfig,
  initializeMetadata,
  formatCatalogForDisplay,
} from './metadata.js';
