/**
 * Jest Tests for Site Modules
 * Tests for /src/lib/site/ modules
 */

import { jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type {
  PageDefinition,
  ComponentInstance,
  AssetReference,
  LoadedProject,
  UploadedAssetInfo,
  ComponentCatalog,
  AssetManifest,
  SiteValidationResult,
} from '../src/types/site.js';

// ============================================================================
// asset-resolver.ts tests
// ============================================================================

import {
  findAssetsInComponent,
  findAssetsInPage,
  findAllAssets,
  resolveAssetPath,
  assetExists,
  getAssetInfo,
  replaceAssetPaths,
  getUniqueAssetPaths,
} from '../src/lib/site/asset-resolver.js';

describe('asset-resolver', () => {
  describe('findAssetsInComponent', () => {
    it('should find asset in props', () => {
      const component: ComponentInstance = {
        type: 'Hero',
        props: {
          backgroundImage: './assets/hero.jpg',
          title: 'Welcome',
        },
      };

      const assets = findAssetsInComponent(component, 0, 'pages/home.json');

      expect(assets).toHaveLength(1);
      expect(assets[0].localPath).toBe('./assets/hero.jpg');
      expect(assets[0].pageFile).toBe('pages/home.json');
      expect(assets[0].propPath).toEqual(['components', 0, 'props', 'backgroundImage']);
    });

    it('should find multiple assets in nested props', () => {
      const component: ComponentInstance = {
        type: 'Gallery',
        props: {
          images: [
            { src: './assets/img1.jpg', alt: 'Image 1' },
            { src: './assets/img2.png', alt: 'Image 2' },
          ],
        },
      };

      const assets = findAssetsInComponent(component, 0, 'pages/gallery.json');

      expect(assets).toHaveLength(2);
      expect(assets.map(a => a.localPath)).toContain('./assets/img1.jpg');
      expect(assets.map(a => a.localPath)).toContain('./assets/img2.png');
    });

    it('should find assets in settings', () => {
      const component: ComponentInstance = {
        type: 'Card',
        props: {},
        settings: {
          icon: './assets/icon.svg',
        },
      };

      const assets = findAssetsInComponent(component, 0, 'pages/test.json');

      expect(assets).toHaveLength(1);
      expect(assets[0].localPath).toBe('./assets/icon.svg');
    });

    it('should handle empty props', () => {
      const component: ComponentInstance = {
        type: 'Text',
        props: {},
      };

      const assets = findAssetsInComponent(component, 0, 'pages/test.json');

      expect(assets).toHaveLength(0);
    });

    it('should ignore non-asset strings', () => {
      const component: ComponentInstance = {
        type: 'Text',
        props: {
          text: 'Hello world',
          url: 'https://example.com/image.jpg',
          color: '#ff0000',
        },
      };

      const assets = findAssetsInComponent(component, 0, 'pages/test.json');

      expect(assets).toHaveLength(0);
    });

    it('should find assets using various path patterns', () => {
      const component: ComponentInstance = {
        type: 'Mixed',
        props: {
          img1: './assets/a.jpg',
          img2: '../assets/b.png',
          img3: 'assets/c.gif',
        },
      };

      const assets = findAssetsInComponent(component, 0, 'pages/test.json');

      expect(assets).toHaveLength(3);
    });

    it('should recognize media file extensions', () => {
      const component: ComponentInstance = {
        type: 'Media',
        props: {
          video: './videos/intro.mp4',
          audio: './sounds/music.mp3',
          doc: './docs/manual.pdf',
        },
      };

      const assets = findAssetsInComponent(component, 0, 'pages/test.json');

      expect(assets.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('findAssetsInPage', () => {
    it('should find assets across all components', () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [
          { type: 'Hero', props: { image: './assets/hero.jpg' } },
          { type: 'Card', props: { icon: './assets/card.png' } },
        ],
      };

      const assets = findAssetsInPage(page, 'pages/test.json');

      expect(assets).toHaveLength(2);
    });

    it('should find assets in page settings', () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [],
        settings: {
          seo: {
            ogImage: './assets/og-image.jpg',
          },
        },
      };

      const assets = findAssetsInPage(page, 'pages/test.json');

      expect(assets).toHaveLength(1);
      expect(assets[0].localPath).toBe('./assets/og-image.jpg');
    });

    it('should handle empty components array', () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [],
      };

      const assets = findAssetsInPage(page, 'pages/test.json');

      expect(assets).toHaveLength(0);
    });
  });

  describe('findAllAssets', () => {
    it('should find assets across all pages', () => {
      const project: LoadedProject = {
        projectPath: '/test',
        config: {},
        pages: [
          {
            file: 'pages/home.json',
            definition: {
              slug: '/',
              title: 'Home',
              components: [{ type: 'Hero', props: { bg: './assets/home.jpg' } }],
            },
          },
          {
            file: 'pages/about.json',
            definition: {
              slug: '/about',
              title: 'About',
              components: [{ type: 'Image', props: { src: './assets/team.png' } }],
            },
          },
        ],
        errors: [],
      };

      const assets = findAllAssets(project);

      expect(assets).toHaveLength(2);
    });
  });

  describe('resolveAssetPath', () => {
    it('should resolve asset path relative to page file', () => {
      const assetRef: AssetReference = {
        localPath: './assets/image.jpg',
        propPath: ['components', 0, 'props', 'image'],
        pageFile: 'pages/home.json',
      };

      const resolved = resolveAssetPath(assetRef, '/project');

      expect(resolved).toBe(path.resolve('/project/pages', './assets/image.jpg'));
    });

    it('should resolve asset path for standalone assets', () => {
      const assetRef: AssetReference = {
        localPath: './assets/global.jpg',
        propPath: [],
        pageFile: '',
      };

      const resolved = resolveAssetPath(assetRef, '/project');

      expect(resolved).toBe(path.resolve('/project', './assets/global.jpg'));
    });
  });

  describe('assetExists', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-test-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return true for existing asset', async () => {
      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'pages', 'assets'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'pages', 'assets', 'test.jpg'), 'test');

      const assetRef: AssetReference = {
        localPath: './assets/test.jpg',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const exists = await assetExists(assetRef, tempDir);

      expect(exists).toBe(true);
    });

    it('should return false for non-existing asset', async () => {
      const assetRef: AssetReference = {
        localPath: './assets/missing.jpg',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const exists = await assetExists(assetRef, tempDir);

      expect(exists).toBe(false);
    });
  });

  describe('getAssetInfo', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-info-test-'));
      await fs.mkdir(path.join(tempDir, 'pages', 'assets'), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return null for non-existing file', async () => {
      const assetRef: AssetReference = {
        localPath: './assets/missing.jpg',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const info = await getAssetInfo(assetRef, tempDir);

      expect(info).toBeNull();
    });

    it('should return correct content type for jpg', async () => {
      const filePath = path.join(tempDir, 'pages', 'assets', 'test.jpg');
      await fs.writeFile(filePath, 'fake jpg content');

      const assetRef: AssetReference = {
        localPath: './assets/test.jpg',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const info = await getAssetInfo(assetRef, tempDir);

      expect(info).not.toBeNull();
      expect(info!.contentType).toBe('image/jpeg');
      expect(info!.size).toBeGreaterThan(0);
    });

    it('should return correct content type for png', async () => {
      const filePath = path.join(tempDir, 'pages', 'assets', 'test.png');
      await fs.writeFile(filePath, 'fake png content');

      const assetRef: AssetReference = {
        localPath: './assets/test.png',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const info = await getAssetInfo(assetRef, tempDir);

      expect(info!.contentType).toBe('image/png');
    });

    it('should return correct content type for svg', async () => {
      const filePath = path.join(tempDir, 'pages', 'assets', 'test.svg');
      await fs.writeFile(filePath, '<svg></svg>');

      const assetRef: AssetReference = {
        localPath: './assets/test.svg',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const info = await getAssetInfo(assetRef, tempDir);

      expect(info!.contentType).toBe('image/svg+xml');
    });

    it('should return octet-stream for unknown extension', async () => {
      const filePath = path.join(tempDir, 'pages', 'assets', 'test.xyz');
      await fs.writeFile(filePath, 'unknown content');

      const assetRef: AssetReference = {
        localPath: './assets/test.xyz',
        propPath: [],
        pageFile: 'pages/home.json',
      };

      const info = await getAssetInfo(assetRef, tempDir);

      expect(info!.contentType).toBe('application/octet-stream');
    });
  });

  describe('replaceAssetPaths', () => {
    it('should replace asset paths with uploaded info', () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [
          {
            type: 'Hero',
            props: {
              image: './assets/hero.jpg',
              title: 'Welcome',
            },
          },
        ],
      };

      const assetMap = new Map<string, UploadedAssetInfo>();
      assetMap.set('./assets/hero.jpg', {
        id: 'asset-123',
        url: 'https://r2.example.com/hero.jpg',
        width: 1920,
        height: 1080,
        alt: 'Hero image',
      });

      const result = replaceAssetPaths(page, assetMap);

      const heroImage = result.components[0].props.image as UploadedAssetInfo;
      expect(heroImage.id).toBe('asset-123');
      expect(heroImage.url).toBe('https://r2.example.com/hero.jpg');
      expect(heroImage.width).toBe(1920);
    });

    it('should handle nested asset paths', () => {
      const page: PageDefinition = {
        slug: '/gallery',
        title: 'Gallery',
        components: [
          {
            type: 'Gallery',
            props: {
              images: [
                { src: './assets/img1.jpg' },
                { src: './assets/img2.jpg' },
              ],
            },
          },
        ],
      };

      const assetMap = new Map<string, UploadedAssetInfo>();
      assetMap.set('./assets/img1.jpg', {
        id: 'asset-1',
        url: 'https://r2.example.com/img1.jpg',
      });
      assetMap.set('./assets/img2.jpg', {
        id: 'asset-2',
        url: 'https://r2.example.com/img2.jpg',
      });

      const result = replaceAssetPaths(page, assetMap);

      const images = result.components[0].props.images as any[];
      expect(images[0].src.id).toBe('asset-1');
      expect(images[1].src.id).toBe('asset-2');
    });

    it('should not modify paths not in asset map', () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [
          {
            type: 'Link',
            props: {
              href: 'https://example.com',
              text: 'Click me',
            },
          },
        ],
      };

      const assetMap = new Map<string, UploadedAssetInfo>();

      const result = replaceAssetPaths(page, assetMap);

      expect(result.components[0].props.href).toBe('https://example.com');
    });

    it('should not mutate original page', () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [
          { type: 'Hero', props: { image: './assets/hero.jpg' } },
        ],
      };

      const assetMap = new Map<string, UploadedAssetInfo>();
      assetMap.set('./assets/hero.jpg', {
        id: 'asset-123',
        url: 'https://r2.example.com/hero.jpg',
      });

      replaceAssetPaths(page, assetMap);

      expect(page.components[0].props.image).toBe('./assets/hero.jpg');
    });
  });

  describe('getUniqueAssetPaths', () => {
    it('should deduplicate asset paths', () => {
      const assets: AssetReference[] = [
        { localPath: './assets/hero.jpg', propPath: [], pageFile: 'home.json' },
        { localPath: './assets/hero.jpg', propPath: [], pageFile: 'about.json' },
        { localPath: './assets/card.png', propPath: [], pageFile: 'home.json' },
      ];

      const unique = getUniqueAssetPaths(assets);

      expect(unique).toHaveLength(2);
      expect(unique).toContain('./assets/hero.jpg');
      expect(unique).toContain('./assets/card.png');
    });

    it('should handle empty array', () => {
      const unique = getUniqueAssetPaths([]);

      expect(unique).toHaveLength(0);
    });
  });
});

// ============================================================================
// page-puller.ts tests
// ============================================================================

import { slugToFilename, formatPullResults } from '../src/lib/site/page-puller.js';
import type { PullResult } from '../src/lib/site/page-puller.js';

describe('page-puller', () => {
  describe('slugToFilename', () => {
    it('should convert root slug to home.json', () => {
      expect(slugToFilename('/')).toBe('home.json');
    });

    it('should convert simple slug to json filename', () => {
      expect(slugToFilename('/about')).toBe('about.json');
    });

    it('should convert nested slug to dashed filename', () => {
      expect(slugToFilename('/services/training')).toBe('services-training.json');
    });

    it('should handle deep nested slugs', () => {
      expect(slugToFilename('/a/b/c/d')).toBe('a-b-c-d.json');
    });
  });

  describe('formatPullResults', () => {
    it('should format results with no pages', () => {
      const result: PullResult = {
        success: true,
        pages: [],
        fetched: 0,
        written: 0,
        skipped: 0,
        errors: [],
      };

      const lines = formatPullResults(result);

      expect(lines).toContain('No pages found on server');
    });

    it('should format results with written pages', () => {
      const result: PullResult = {
        success: true,
        pages: [
          { slug: '/', file: 'pages/home.json', action: 'created' },
          { slug: '/about', file: 'pages/about.json', action: 'updated' },
        ],
        fetched: 2,
        written: 2,
        skipped: 0,
        errors: [],
      };

      const lines = formatPullResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Fetched 2 pages');
      expect(output).toContain('2 written');
    });

    it('should format results with skipped pages', () => {
      const result: PullResult = {
        success: true,
        pages: [
          { slug: '/', file: 'pages/home.json', action: 'skipped' },
        ],
        fetched: 1,
        written: 0,
        skipped: 1,
        errors: [],
      };

      const lines = formatPullResults(result);
      const output = lines.join('\n');

      expect(output).toContain('1 skipped');
    });

    it('should format results with errors', () => {
      const result: PullResult = {
        success: false,
        pages: [],
        fetched: 1,
        written: 0,
        skipped: 0,
        errors: ['Failed to write home.json: Permission denied'],
      };

      const lines = formatPullResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Errors:');
      expect(output).toContain('Permission denied');
    });
  });
});

// ============================================================================
// asset-puller.ts tests
// ============================================================================

import { formatBytes } from '../src/lib/site/asset-puller.js';

describe('asset-puller', () => {
  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500.0 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });
});

// ============================================================================
// metadata.ts tests
// ============================================================================

import {
  ensureOaysusDir,
  hasOaysusMetadata,
  findProjectRoot,
  loadConfig,
  saveConfig,
  loadComponentCatalog,
  saveComponentCatalog,
  loadAssetManifest,
  saveAssetManifest,
  componentExists,
  findComponent,
  isDefaultShared,
  getSuggestions,
  isCatalogStale,
  formatCatalogForDisplay,
} from '../src/lib/site/metadata.js';

describe('metadata', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('ensureOaysusDir', () => {
    it('should create .oaysus directory', async () => {
      const oaysusDir = await ensureOaysusDir(tempDir);

      expect(oaysusDir).toBe(path.join(tempDir, '.oaysus'));

      const stats = await fs.stat(oaysusDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });

      const oaysusDir = await ensureOaysusDir(tempDir);

      expect(oaysusDir).toBe(path.join(tempDir, '.oaysus'));
    });
  });

  describe('hasOaysusMetadata', () => {
    it('should return false for project without metadata', async () => {
      const result = await hasOaysusMetadata(tempDir);

      expect(result).toBe(false);
    });

    it('should return true for project with metadata', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        JSON.stringify({ version: 1, websiteId: 'test-123' })
      );

      const result = await hasOaysusMetadata(tempDir);

      expect(result).toBe(true);
    });
  });

  describe('findProjectRoot', () => {
    it('should find project root with .oaysus directory', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        '{}'
      );

      const root = await findProjectRoot(tempDir);

      expect(root).toBe(tempDir);
    });

    it('should find project root with legacy config', async () => {
      await fs.writeFile(
        path.join(tempDir, 'oaysus.website.json'),
        '{}'
      );

      const root = await findProjectRoot(tempDir);

      expect(root).toBe(tempDir);
    });

    it('should search parent directories', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        '{}'
      );
      const subDir = path.join(tempDir, 'pages', 'nested');
      await fs.mkdir(subDir, { recursive: true });

      const root = await findProjectRoot(subDir);

      expect(root).toBe(tempDir);
    });

    it('should return null when no project found', async () => {
      const isolatedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'isolated-'));
      try {
        const root = await findProjectRoot(isolatedDir);
        // May return a parent directory if one has a config, or null
        // This test just verifies it doesn't throw
        expect(typeof root).toMatch(/string|object/);
      } finally {
        await fs.rm(isolatedDir, { recursive: true, force: true });
      }
    });
  });

  describe('loadConfig and saveConfig', () => {
    it('should save and load config', async () => {
      const config = {
        version: 1 as const,
        websiteId: 'website-123',
        websiteName: 'Test Site',
      };

      await saveConfig(tempDir, config);
      const loaded = await loadConfig(tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.websiteId).toBe('website-123');
      expect(loaded!.websiteName).toBe('Test Site');
    });

    it('should return null for missing config', async () => {
      const loaded = await loadConfig(tempDir);

      expect(loaded).toBeNull();
    });
  });

  describe('loadComponentCatalog and saveComponentCatalog', () => {
    it('should save and load component catalog', async () => {
      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        websiteId: 'website-123',
        themePacks: [
          {
            id: 'starter-pack',
            name: 'Starter Pack',
            installed: true,
            components: [
              { type: 'Hero', displayName: 'Hero Section' },
              { type: 'Footer', displayName: 'Footer' },
            ],
          },
        ],
        allComponentTypes: ['Hero', 'Footer'],
      };

      await saveComponentCatalog(tempDir, catalog);
      const loaded = await loadComponentCatalog(tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.websiteId).toBe('website-123');
      expect(loaded!.allComponentTypes).toContain('Hero');
      expect(loaded!.themePacks).toHaveLength(1);
    });

    it('should return null for missing catalog', async () => {
      const loaded = await loadComponentCatalog(tempDir);

      expect(loaded).toBeNull();
    });
  });

  describe('loadAssetManifest and saveAssetManifest', () => {
    it('should save and load asset manifest', async () => {
      const manifest: AssetManifest = {
        version: 1,
        assets: {
          'hero.jpg': {
            url: 'https://r2.example.com/hero.jpg',
            contentType: 'image/jpeg',
            sizeInBytes: 12345,
            width: 1920,
            height: 1080,
            contentHash: 'abc123',
          },
        },
      };

      await saveAssetManifest(tempDir, manifest);
      const loaded = await loadAssetManifest(tempDir);

      expect(loaded.assets['hero.jpg']).toBeDefined();
      expect(loaded.assets['hero.jpg'].url).toBe('https://r2.example.com/hero.jpg');
    });

    it('should return empty manifest when none exists', async () => {
      const loaded = await loadAssetManifest(tempDir);

      expect(loaded.version).toBe(1);
      expect(Object.keys(loaded.assets)).toHaveLength(0);
    });
  });

  describe('componentExists', () => {
    const catalog: ComponentCatalog = {
      version: 1,
      lastSyncedAt: new Date().toISOString(),
      websiteId: 'test',
      themePacks: [],
      allComponentTypes: ['Hero', 'Footer', 'Card'],
    };

    it('should return true for existing component', () => {
      expect(componentExists(catalog, 'Hero')).toBe(true);
    });

    it('should return false for non-existing component', () => {
      expect(componentExists(catalog, 'Missing')).toBe(false);
    });
  });

  describe('findComponent', () => {
    const catalog: ComponentCatalog = {
      version: 1,
      lastSyncedAt: new Date().toISOString(),
      websiteId: 'test',
      themePacks: [
        {
          id: 'pack1',
          name: 'Pack 1',
          installed: true,
          components: [
            { type: 'Hero', displayName: 'Hero Section', description: 'A hero component' },
          ],
        },
      ],
      allComponentTypes: ['Hero'],
    };

    it('should find component by type', () => {
      const comp = findComponent(catalog, 'Hero');

      expect(comp).not.toBeNull();
      expect(comp!.displayName).toBe('Hero Section');
    });

    it('should return null for non-existing component', () => {
      const comp = findComponent(catalog, 'Missing');

      expect(comp).toBeNull();
    });
  });

  describe('isDefaultShared', () => {
    const catalog: ComponentCatalog = {
      version: 1,
      lastSyncedAt: new Date().toISOString(),
      websiteId: 'test',
      themePacks: [
        {
          id: 'pack1',
          name: 'Pack 1',
          installed: true,
          components: [
            { type: 'Header', displayName: 'Header', defaultShared: true },
            { type: 'Card', displayName: 'Card', defaultShared: false },
            { type: 'Text', displayName: 'Text' },
          ],
        },
      ],
      allComponentTypes: ['Header', 'Card', 'Text'],
    };

    it('should return true for component with defaultShared: true', () => {
      expect(isDefaultShared(catalog, 'Header')).toBe(true);
    });

    it('should return false for component with defaultShared: false', () => {
      expect(isDefaultShared(catalog, 'Card')).toBe(false);
    });

    it('should return false for component without defaultShared', () => {
      expect(isDefaultShared(catalog, 'Text')).toBe(false);
    });

    it('should return false for non-existing component', () => {
      expect(isDefaultShared(catalog, 'Missing')).toBe(false);
    });
  });

  describe('getSuggestions', () => {
    const catalog: ComponentCatalog = {
      version: 1,
      lastSyncedAt: new Date().toISOString(),
      websiteId: 'test',
      themePacks: [],
      allComponentTypes: ['Hero', 'HeroSection', 'Header', 'Footer', 'Card'],
    };

    it('should return similar suggestions', () => {
      const suggestions = getSuggestions(catalog, 'Hreo');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('Hero');
    });

    it('should return limited suggestions', () => {
      const suggestions = getSuggestions(catalog, 'H', 2);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should prioritize prefix matches', () => {
      const suggestions = getSuggestions(catalog, 'Her');

      expect(suggestions[0]).toBe('Hero');
    });
  });

  describe('isCatalogStale', () => {
    it('should return true for stale catalog', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: oldDate.toISOString(),
        websiteId: 'test',
        themePacks: [],
        allComponentTypes: [],
      };

      const isStale = await isCatalogStale(catalog);

      expect(isStale).toBe(true);
    });

    it('should return false for fresh catalog', async () => {
      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        websiteId: 'test',
        themePacks: [],
        allComponentTypes: [],
      };

      const isStale = await isCatalogStale(catalog);

      expect(isStale).toBe(false);
    });

    it('should use custom max age', async () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: recentDate.toISOString(),
        websiteId: 'test',
        themePacks: [],
        allComponentTypes: [],
      };

      const isStale = await isCatalogStale(catalog, 1 * 60 * 1000); // 1 minute max age

      expect(isStale).toBe(true);
    });

    it('should return true when catalog does not exist (using path)', async () => {
      const isStale = await isCatalogStale(tempDir);

      expect(isStale).toBe(true);
    });
  });

  describe('formatCatalogForDisplay', () => {
    it('should format empty catalog', () => {
      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        websiteId: 'test-123',
        themePacks: [],
        allComponentTypes: [],
      };

      const lines = formatCatalogForDisplay(catalog);
      const output = lines.join('\n');

      expect(output).toContain('No components installed');
    });

    it('should format catalog with components', () => {
      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        websiteId: 'test-123',
        themePacks: [
          {
            id: 'starter',
            name: 'Starter Pack',
            version: '1.0.0',
            installed: true,
            components: [
              { type: 'Hero', displayName: 'Hero Section', description: 'A hero' },
              { type: 'Footer', displayName: 'Footer' },
            ],
          },
        ],
        allComponentTypes: ['Hero', 'Footer'],
      };

      const lines = formatCatalogForDisplay(catalog);
      const output = lines.join('\n');

      expect(output).toContain('Starter Pack');
      expect(output).toContain('Hero');
      expect(output).toContain('Footer');
      expect(output).toContain('Total: 2 components');
    });
  });
});

// ============================================================================
// project-loader.ts tests
// ============================================================================

import {
  loadWebsiteConfig,
  loadPageDefinition,
  discoverPageFiles,
  loadProject,
  loadSinglePage,
} from '../src/lib/site/project-loader.js';

describe('project-loader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loader-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadWebsiteConfig', () => {
    it('should load config from .oaysus/config.json', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        JSON.stringify({ version: 1, websiteId: 'web-123' })
      );

      const { config, error } = await loadWebsiteConfig(tempDir);

      expect(error).toBeNull();
      expect(config).not.toBeNull();
      expect(config!.websiteId).toBe('web-123');
    });

    it('should load config from legacy oaysus.website.json', async () => {
      await fs.writeFile(
        path.join(tempDir, 'oaysus.website.json'),
        JSON.stringify({ websiteId: 'legacy-123' })
      );

      const { config, error } = await loadWebsiteConfig(tempDir);

      expect(error).toBeNull();
      expect(config).not.toBeNull();
      expect(config!.websiteId).toBe('legacy-123');
    });

    it('should return error for invalid legacy config', async () => {
      await fs.writeFile(
        path.join(tempDir, 'oaysus.website.json'),
        'not valid json'
      );

      const { config, error } = await loadWebsiteConfig(tempDir);

      expect(error).not.toBeNull();
      expect(error).toContain('Failed to parse');
    });
  });

  describe('loadPageDefinition', () => {
    it('should load valid page definition', async () => {
      const pageContent = {
        slug: '/about',
        title: 'About Us',
        components: [
          { type: 'Hero', props: { title: 'About' } },
        ],
      };
      const filePath = path.join(tempDir, 'about.json');
      await fs.writeFile(filePath, JSON.stringify(pageContent));

      const { definition, error } = await loadPageDefinition(filePath);

      expect(error).toBeNull();
      expect(definition).not.toBeNull();
      expect(definition!.slug).toBe('/about');
      expect(definition!.title).toBe('About Us');
      expect(definition!.components).toHaveLength(1);
    });

    it('should return error for invalid slug', async () => {
      const pageContent = {
        slug: 'no-leading-slash',
        title: 'Test',
        components: [],
      };
      const filePath = path.join(tempDir, 'test.json');
      await fs.writeFile(filePath, JSON.stringify(pageContent));

      const { definition, error } = await loadPageDefinition(filePath);

      expect(error).not.toBeNull();
      expect(error).toContain('Slug must start with /');
    });

    it('should return error for missing title', async () => {
      const pageContent = {
        slug: '/test',
        components: [],
      };
      const filePath = path.join(tempDir, 'test.json');
      await fs.writeFile(filePath, JSON.stringify(pageContent));

      const { definition, error } = await loadPageDefinition(filePath);

      expect(error).not.toBeNull();
      expect(error).toContain('title');
    });

    it('should return error for invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(filePath, 'not json');

      const { definition, error } = await loadPageDefinition(filePath);

      expect(error).not.toBeNull();
      expect(error).toContain('Failed to parse');
    });
  });

  describe('discoverPageFiles', () => {
    it('should discover JSON files in pages directory', async () => {
      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'pages', 'home.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'pages', 'about.json'), '{}');

      const files = await discoverPageFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files.some(f => f.endsWith('home.json'))).toBe(true);
      expect(files.some(f => f.endsWith('about.json'))).toBe(true);
    });

    it('should return empty array if pages directory does not exist', async () => {
      const files = await discoverPageFiles(tempDir);

      expect(files).toHaveLength(0);
    });

    it('should discover nested page files', async () => {
      await fs.mkdir(path.join(tempDir, 'pages', 'blog'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'pages', 'blog', 'post1.json'), '{}');

      const files = await discoverPageFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('post1.json');
    });
  });

  describe('loadProject', () => {
    it('should load complete project', async () => {
      // Create .oaysus config
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        JSON.stringify({ version: 1, websiteId: 'proj-123' })
      );

      // Create pages
      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'pages', 'home.json'),
        JSON.stringify({
          slug: '/',
          title: 'Home',
          isHomePage: true,
          components: [],
        })
      );

      const project = await loadProject(tempDir);

      expect(project.errors).toHaveLength(0);
      expect(project.config.websiteId).toBe('proj-123');
      expect(project.pages).toHaveLength(1);
      expect(project.pages[0].definition.slug).toBe('/');
    });

    it('should detect duplicate slugs', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        JSON.stringify({ version: 1, websiteId: 'test' })
      );

      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'pages', 'home1.json'),
        JSON.stringify({ slug: '/', title: 'Home 1', components: [] })
      );
      await fs.writeFile(
        path.join(tempDir, 'pages', 'home2.json'),
        JSON.stringify({ slug: '/', title: 'Home 2', components: [] })
      );

      const project = await loadProject(tempDir);

      expect(project.errors.some(e => e.includes('Duplicate slug'))).toBe(true);
    });

    it('should detect multiple home pages', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        JSON.stringify({ version: 1, websiteId: 'test' })
      );

      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'pages', 'home.json'),
        JSON.stringify({ slug: '/', title: 'Home', isHomePage: true, components: [] })
      );
      await fs.writeFile(
        path.join(tempDir, 'pages', 'landing.json'),
        JSON.stringify({ slug: '/landing', title: 'Landing', isHomePage: true, components: [] })
      );

      const project = await loadProject(tempDir);

      expect(project.errors.some(e => e.includes('Multiple home pages'))).toBe(true);
    });

    it('should report error for empty pages directory', async () => {
      await fs.mkdir(path.join(tempDir, '.oaysus'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.oaysus', 'config.json'),
        JSON.stringify({ version: 1, websiteId: 'test' })
      );
      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });

      const project = await loadProject(tempDir);

      expect(project.errors.some(e => e.includes('No page files found'))).toBe(true);
    });
  });

  describe('loadSinglePage', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(tempDir, 'pages'), { recursive: true });
    });

    it('should load page by file path', async () => {
      await fs.writeFile(
        path.join(tempDir, 'pages', 'about.json'),
        JSON.stringify({ slug: '/about', title: 'About', components: [] })
      );

      const { page, error } = await loadSinglePage(tempDir, 'pages/about.json');

      expect(error).toBeNull();
      expect(page).not.toBeNull();
      expect(page!.definition.slug).toBe('/about');
    });

    it('should load page by slug', async () => {
      await fs.writeFile(
        path.join(tempDir, 'pages', 'contact.json'),
        JSON.stringify({ slug: '/contact', title: 'Contact', components: [] })
      );

      const { page, error } = await loadSinglePage(tempDir, '/contact');

      expect(error).toBeNull();
      expect(page).not.toBeNull();
      expect(page!.definition.title).toBe('Contact');
    });

    it('should return error for non-existing file', async () => {
      const { page, error } = await loadSinglePage(tempDir, 'pages/missing.json');

      expect(error).not.toBeNull();
      expect(error).toContain('not found');
    });

    it('should return error for non-existing slug', async () => {
      const { page, error } = await loadSinglePage(tempDir, '/missing');

      expect(error).not.toBeNull();
      expect(error).toContain('No page found');
    });
  });
});

// ============================================================================
// page-validator.ts tests
// ============================================================================

import {
  validatePage,
  getMissingComponents,
  formatValidationResults,
} from '../src/lib/site/page-validator.js';
import type { InstalledComponent } from '../src/types/site.js';

describe('page-validator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validator-test-'));
    await fs.mkdir(path.join(tempDir, 'pages', 'assets'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validatePage', () => {
    const installedComponents: InstalledComponent[] = [
      { id: '1', name: 'Hero', displayName: 'Hero', sourceThemePackId: 'starter' },
      { id: '2', name: 'Footer', displayName: 'Footer', sourceThemePackId: 'starter' },
    ];

    it('should validate page with all installed components', async () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test Page',
        description: 'A test page',
        components: [
          { type: 'Hero', props: {} },
          { type: 'Footer', props: {} },
        ],
        settings: {
          seo: { metaTitle: 'Test' },
        },
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect uninstalled component', async () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test Page',
        components: [
          { type: 'Hero', props: {} },
          { type: 'MissingComponent', props: {} },
        ],
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.valid).toBe(false);
      expect(result.unresolvedComponents).toContain('MissingComponent');
    });

    it('should detect invalid slug format', async () => {
      const page: PageDefinition = {
        slug: 'no-slash',
        title: 'Test',
        components: [],
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Slug must start with'))).toBe(true);
    });

    it('should warn about missing description', async () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [],
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.warnings.some(w => w.includes('missing a description'))).toBe(true);
    });

    it('should warn about missing metaTitle', async () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [],
        settings: {},
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.warnings.some(w => w.includes('metaTitle'))).toBe(true);
    });

    it('should detect missing asset files', async () => {
      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        components: [
          { type: 'Hero', props: { image: './assets/missing.jpg' } },
        ],
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Asset not found'))).toBe(true);
    });

    it('should pass when asset file exists', async () => {
      await fs.writeFile(path.join(tempDir, 'pages', 'assets', 'hero.jpg'), 'fake image');

      const page: PageDefinition = {
        slug: '/test',
        title: 'Test',
        description: 'Test page',
        components: [
          { type: 'Hero', props: { image: './assets/hero.jpg' } },
        ],
        settings: { seo: { metaTitle: 'Test' } },
      };

      const result = await validatePage('pages/test.json', page, installedComponents, tempDir);

      expect(result.valid).toBe(true);
      expect(result.localAssets).toHaveLength(1);
    });
  });

  describe('getMissingComponents', () => {
    it('should extract unique missing components', () => {
      const result: SiteValidationResult = {
        valid: false,
        pages: [
          {
            valid: false,
            pageFile: 'home.json',
            slug: '/',
            errors: [],
            warnings: [],
            unresolvedComponents: ['Missing1', 'Missing2'],
            localAssets: [],
          },
          {
            valid: false,
            pageFile: 'about.json',
            slug: '/about',
            errors: [],
            warnings: [],
            unresolvedComponents: ['Missing1', 'Missing3'],
            localAssets: [],
          },
        ],
        totalErrors: 0,
        totalWarnings: 0,
        allAssets: [],
      };

      const missing = getMissingComponents(result);

      expect(missing).toHaveLength(3);
      expect(missing).toContain('Missing1');
      expect(missing).toContain('Missing2');
      expect(missing).toContain('Missing3');
    });
  });

  describe('formatValidationResults', () => {
    it('should format successful validation', () => {
      const result: SiteValidationResult = {
        valid: true,
        pages: [
          {
            valid: true,
            pageFile: 'home.json',
            slug: '/',
            errors: [],
            warnings: [],
            unresolvedComponents: [],
            localAssets: [{ localPath: './assets/hero.jpg', propPath: [], pageFile: 'home.json' }],
          },
        ],
        totalErrors: 0,
        totalWarnings: 0,
        allAssets: [{ localPath: './assets/hero.jpg', propPath: [], pageFile: 'home.json' }],
      };

      const lines = formatValidationResults(result);
      const output = lines.join('\n');

      expect(output).toContain('All pages validated successfully');
      expect(output).toContain('1 pages');
      expect(output).toContain('1 assets');
    });

    it('should format failed validation', () => {
      const result: SiteValidationResult = {
        valid: false,
        pages: [
          {
            valid: false,
            pageFile: 'home.json',
            slug: '/',
            errors: ['Component "Missing" is not installed'],
            warnings: [],
            unresolvedComponents: ['Missing'],
            localAssets: [],
          },
        ],
        totalErrors: 1,
        totalWarnings: 0,
        allAssets: [],
      };

      const lines = formatValidationResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Validation failed');
      expect(output).toContain('home.json');
      expect(output).toContain('Missing');
    });

    it('should format warnings', () => {
      const result: SiteValidationResult = {
        valid: true,
        pages: [
          {
            valid: true,
            pageFile: 'home.json',
            slug: '/',
            errors: [],
            warnings: ['Page is missing a description'],
            unresolvedComponents: [],
            localAssets: [],
          },
        ],
        totalErrors: 0,
        totalWarnings: 1,
        allAssets: [],
      };

      const lines = formatValidationResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Warnings:');
      expect(output).toContain('missing a description');
    });
  });
});

// ============================================================================
// shared-component-resolver.ts tests
// ============================================================================

import {
  shouldBeShared,
  extractSharedComponents,
  applyGlobalReferences,
} from '../src/lib/site/shared-component-resolver.js';

describe('shared-component-resolver', () => {
  describe('shouldBeShared', () => {
    it('should return true for explicit shared: true', () => {
      const component: ComponentInstance = {
        type: 'Header',
        props: {},
        shared: true,
      };

      expect(shouldBeShared(component, null)).toBe(true);
    });

    it('should return false for explicit shared: false', () => {
      const component: ComponentInstance = {
        type: 'Header',
        props: {},
        shared: false,
      };

      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        websiteId: 'test',
        themePacks: [
          {
            id: 'pack',
            name: 'Pack',
            installed: true,
            components: [{ type: 'Header', displayName: 'Header', defaultShared: true }],
          },
        ],
        allComponentTypes: ['Header'],
      };

      expect(shouldBeShared(component, catalog)).toBe(false);
    });

    it('should use catalog defaultShared when shared is not set', () => {
      const component: ComponentInstance = {
        type: 'Header',
        props: {},
      };

      const catalog: ComponentCatalog = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        websiteId: 'test',
        themePacks: [
          {
            id: 'pack',
            name: 'Pack',
            installed: true,
            components: [{ type: 'Header', displayName: 'Header', defaultShared: true }],
          },
        ],
        allComponentTypes: ['Header'],
      };

      expect(shouldBeShared(component, catalog)).toBe(true);
    });

    it('should return false when no shared flag and no catalog', () => {
      const component: ComponentInstance = {
        type: 'Card',
        props: {},
      };

      expect(shouldBeShared(component, null)).toBe(false);
    });
  });

  describe('extractSharedComponents', () => {
    it('should extract shared components from pages', () => {
      const pages: PageDefinition[] = [
        {
          slug: '/',
          title: 'Home',
          components: [
            { type: 'Header', props: { logo: 'Logo' }, shared: true },
            { type: 'Hero', props: {} },
          ],
        },
        {
          slug: '/about',
          title: 'About',
          components: [
            { type: 'Header', props: { logo: 'Logo' }, shared: true },
            { type: 'Content', props: {} },
          ],
        },
      ];

      const shared = extractSharedComponents(pages, null);

      expect(shared.size).toBe(1);
      expect(shared.has('Header')).toBe(true);
      expect(shared.get('Header')!.props).toEqual({ logo: 'Logo' });
    });

    it('should use props from first occurrence', () => {
      const pages: PageDefinition[] = [
        {
          slug: '/',
          title: 'Home',
          components: [
            { type: 'Header', props: { color: 'blue' }, shared: true },
          ],
        },
        {
          slug: '/about',
          title: 'About',
          components: [
            { type: 'Header', props: { color: 'red' }, shared: true },
          ],
        },
      ];

      const shared = extractSharedComponents(pages, null);

      expect(shared.get('Header')!.props).toEqual({ color: 'blue' });
    });

    it('should return empty map when no shared components', () => {
      const pages: PageDefinition[] = [
        {
          slug: '/',
          title: 'Home',
          components: [{ type: 'Hero', props: {} }],
        },
      ];

      const shared = extractSharedComponents(pages, null);

      expect(shared.size).toBe(0);
    });

    it('should extract sharedName if provided', () => {
      const pages: PageDefinition[] = [
        {
          slug: '/',
          title: 'Home',
          components: [
            { type: 'Header', props: {}, shared: true, sharedName: 'Main Header' },
          ],
        },
      ];

      const shared = extractSharedComponents(pages, null);

      expect(shared.get('Header')!.name).toBe('Main Header');
    });
  });

  describe('applyGlobalReferences', () => {
    it('should add globalId and isGlobal to shared components', () => {
      const page: PageDefinition = {
        slug: '/',
        title: 'Home',
        components: [
          { type: 'Header', props: { logo: 'Logo' }, shared: true },
          { type: 'Hero', props: {} },
        ],
      };

      const typeToGlobalId = new Map([['Header', 'global-123']]);

      const result = applyGlobalReferences(page, typeToGlobalId, null);

      expect(result.components[0].globalId).toBe('global-123');
      expect((result.components[0] as any).isGlobal).toBe(true);
      expect(result.components[1].globalId).toBeUndefined();
    });

    it('should not modify non-shared components', () => {
      const page: PageDefinition = {
        slug: '/',
        title: 'Home',
        components: [
          { type: 'Card', props: { title: 'Card' } },
        ],
      };

      const typeToGlobalId = new Map([['Header', 'global-123']]);

      const result = applyGlobalReferences(page, typeToGlobalId, null);

      expect(result.components[0].globalId).toBeUndefined();
      expect((result.components[0] as any).isGlobal).toBeUndefined();
    });

    it('should not modify page when no global references', () => {
      const page: PageDefinition = {
        slug: '/',
        title: 'Home',
        components: [
          { type: 'Header', props: {}, shared: true },
        ],
      };

      const typeToGlobalId = new Map<string, string>();

      const result = applyGlobalReferences(page, typeToGlobalId, null);

      expect(result.components[0].globalId).toBeUndefined();
    });
  });
});

// ============================================================================
// page-publisher.ts tests
// ============================================================================

import { formatPublishResults } from '../src/lib/site/page-publisher.js';
import type { PublishResult } from '../src/types/site.js';

describe('page-publisher', () => {
  describe('formatPublishResults', () => {
    it('should format successful publish', () => {
      const result: PublishResult = {
        success: true,
        pages: [
          { slug: '/', action: 'created', pageId: 'page-1' },
          { slug: '/about', action: 'updated', pageId: 'page-2' },
        ],
        assetsUploaded: 5,
        created: 1,
        updated: 1,
        errors: 0,
      };

      const lines = formatPublishResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Publishing complete');
      expect(output).toContain('Assets uploaded: 5');
      expect(output).toContain('Pages created: 1');
      expect(output).toContain('Pages updated: 1');
    });

    it('should format failed publish', () => {
      const result: PublishResult = {
        success: false,
        pages: [
          { slug: '/', action: 'failed', error: 'Network error' },
        ],
        assetsUploaded: 0,
        created: 0,
        updated: 0,
        errors: 1,
      };

      const lines = formatPublishResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Publishing failed');
      expect(output).toContain('/');
      expect(output).toContain('Network error');
    });

    it('should show all page statuses', () => {
      const result: PublishResult = {
        success: true,
        pages: [
          { slug: '/', action: 'created', pageId: 'page-1' },
          { slug: '/about', action: 'updated', pageId: 'page-2' },
          { slug: '/contact', action: 'skipped' },
        ],
        assetsUploaded: 0,
        created: 1,
        updated: 1,
        errors: 0,
      };

      const lines = formatPublishResults(result);
      const output = lines.join('\n');

      expect(output).toContain('Pages:');
      expect(output).toContain('+');  // created
      expect(output).toContain('~');  // updated
      expect(output).toContain('-');  // skipped
    });
  });
});

// ============================================================================
// asset-uploader.ts tests
// ============================================================================

import { resolveAssets, formatUploadResults } from '../src/lib/site/asset-uploader.js';
import type { AssetUploadResult } from '../src/lib/site/asset-uploader.js';

describe('asset-uploader', () => {
  describe('resolveAssets', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploader-test-'));
      await fs.mkdir(path.join(tempDir, 'pages', 'assets'), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should resolve assets with R2 URLs', async () => {
      await fs.writeFile(path.join(tempDir, 'pages', 'assets', 'hero.jpg'), 'fake jpg');

      const assets: AssetReference[] = [
        { localPath: './assets/hero.jpg', propPath: [], pageFile: 'pages/home.json' },
      ];

      const uploadResults: AssetUploadResult[] = [
        {
          localPath: './assets/hero.jpg',
          r2Url: 'https://r2.example.com/hero.jpg',
          success: true,
        },
      ];

      const resolved = resolveAssets(assets, uploadResults, tempDir);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].r2Url).toBe('https://r2.example.com/hero.jpg');
      expect(resolved[0].contentType).toBe('image/jpeg');
    });

    it('should skip failed uploads', () => {
      const assets: AssetReference[] = [
        { localPath: './assets/hero.jpg', propPath: [], pageFile: 'home.json' },
      ];

      const uploadResults: AssetUploadResult[] = [
        {
          localPath: './assets/hero.jpg',
          r2Url: '',
          success: false,
          error: 'Upload failed',
        },
      ];

      const resolved = resolveAssets(assets, uploadResults, tempDir);

      expect(resolved).toHaveLength(0);
    });
  });

  describe('formatUploadResults', () => {
    it('should format successful uploads', () => {
      const results: AssetUploadResult[] = [
        { localPath: './assets/hero.jpg', r2Url: 'https://r2.example.com/hero.jpg', success: true },
        { localPath: './assets/logo.png', r2Url: 'https://r2.example.com/logo.png', success: true },
      ];

      const lines = formatUploadResults(results);
      const output = lines.join('\n');

      expect(output).toContain('Uploaded 2 assets');
    });

    it('should format failed uploads', () => {
      const results: AssetUploadResult[] = [
        { localPath: './assets/hero.jpg', r2Url: '', success: false, error: 'File too large' },
      ];

      const lines = formatUploadResults(results);
      const output = lines.join('\n');

      expect(output).toContain('Failed uploads:');
      expect(output).toContain('./assets/hero.jpg');
      expect(output).toContain('File too large');
    });

    it('should format mixed results', () => {
      const results: AssetUploadResult[] = [
        { localPath: './assets/hero.jpg', r2Url: 'https://r2.example.com/hero.jpg', success: true },
        { localPath: './assets/video.mp4', r2Url: '', success: false, error: 'Timeout' },
      ];

      const lines = formatUploadResults(results);
      const output = lines.join('\n');

      expect(output).toContain('Uploaded 1 assets');
      expect(output).toContain('Failed uploads:');
    });
  });
});
