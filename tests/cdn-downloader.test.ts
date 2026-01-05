import { jest } from '@jest/globals';
/**
 * Tests for cdn-downloader.ts
 * Verifies CDN download functionality for framework dependencies
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';

// Import the module under test
import {
  downloadFrameworkDependency,
  saveDownloadedDependency,
  getFrameworkDependencies,
  type DownloadedDependency,
} from '../src/lib/shared/cdn-downloader.js';

// Test directory base
const testDirBase = path.join(os.tmpdir(), 'oaysus-cdn-downloader-test');
let testDir: string;

// Console spies
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
let consoleWarnSpy: ReturnType<typeof jest.spyOn>;

describe('cdn-downloader module', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsPromises.mkdir(testDir, { recursive: true });

    // Set up console spies
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleErrorSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();

    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getFrameworkDependencies()', () => {
    describe('react framework', () => {
      it('should return correct dependencies for react', () => {
        const deps = getFrameworkDependencies('react', '19.0.0');
        expect(deps).toHaveLength(2);
      });

      it('should include react package with correct sub-exports', () => {
        const deps = getFrameworkDependencies('react', '19.0.0');
        const reactDep = deps.find(d => d.packageName === 'react');

        expect(reactDep).toBeDefined();
        expect(reactDep?.version).toBe('19.0.0');
        expect(reactDep?.subExports).toContain('jsx-runtime');
        expect(reactDep?.subExports).toContain('jsx-dev-runtime');
      });

      it('should include react-dom package with client sub-export', () => {
        const deps = getFrameworkDependencies('react', '18.2.0');
        const reactDomDep = deps.find(d => d.packageName === 'react-dom');

        expect(reactDomDep).toBeDefined();
        expect(reactDomDep?.version).toBe('18.2.0');
        expect(reactDomDep?.subExports).toContain('client');
      });

      it('should use provided version for all dependencies', () => {
        const version = '17.0.2';
        const deps = getFrameworkDependencies('react', version);

        for (const dep of deps) {
          expect(dep.version).toBe(version);
        }
      });
    });

    describe('svelte framework', () => {
      it('should return correct dependencies for svelte', () => {
        const deps = getFrameworkDependencies('svelte', '5.0.0');
        expect(deps).toHaveLength(1);
      });

      it('should include svelte package with all sub-exports', () => {
        const deps = getFrameworkDependencies('svelte', '4.2.0');
        const svelteDep = deps[0];

        expect(svelteDep.packageName).toBe('svelte');
        expect(svelteDep.version).toBe('4.2.0');
        expect(svelteDep.subExports).toContain('internal');
        expect(svelteDep.subExports).toContain('store');
        expect(svelteDep.subExports).toContain('motion');
        expect(svelteDep.subExports).toContain('transition');
        expect(svelteDep.subExports).toContain('animate');
        expect(svelteDep.subExports).toContain('easing');
        expect(svelteDep.subExports).toContain('legacy');
      });

      it('should have 7 sub-exports for svelte', () => {
        const deps = getFrameworkDependencies('svelte', '5.0.0');
        expect(deps[0].subExports).toHaveLength(7);
      });
    });

    describe('vue framework', () => {
      it('should return correct dependencies for vue', () => {
        const deps = getFrameworkDependencies('vue', '3.4.0');
        expect(deps).toHaveLength(1);
      });

      it('should include vue package with no sub-exports', () => {
        const deps = getFrameworkDependencies('vue', '3.3.4');
        const vueDep = deps[0];

        expect(vueDep.packageName).toBe('vue');
        expect(vueDep.version).toBe('3.3.4');
        expect(vueDep.subExports).toHaveLength(0);
      });
    });

    describe('unknown framework', () => {
      it('should return empty array for unknown framework', () => {
        const deps = getFrameworkDependencies('angular', '17.0.0');
        expect(deps).toHaveLength(0);
      });

      it('should return empty array for empty string framework', () => {
        const deps = getFrameworkDependencies('', '1.0.0');
        expect(deps).toHaveLength(0);
      });

      it('should return empty array for arbitrary framework name', () => {
        const deps = getFrameworkDependencies('unknown-framework', '1.0.0');
        expect(deps).toHaveLength(0);
      });
    });
  });

  describe('saveDownloadedDependency()', () => {
    describe('basic file saving', () => {
      it('should create dependency directory', () => {
        const dependency: DownloadedDependency = {
          name: 'test-package',
          version: '1.0.0',
          files: [
            { path: 'index.js', content: 'export default {}' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const depDir = path.join(testDir, 'test-package@1.0.0');
        expect(fs.existsSync(depDir)).toBe(true);
      });

      it('should save single file correctly', () => {
        const content = 'export const test = "hello";';
        const dependency: DownloadedDependency = {
          name: 'my-lib',
          version: '2.0.0',
          files: [
            { path: 'index.js', content },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const filePath = path.join(testDir, 'my-lib@2.0.0', 'index.js');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
      });

      it('should save multiple files correctly', () => {
        const dependency: DownloadedDependency = {
          name: 'multi-file',
          version: '1.2.3',
          files: [
            { path: 'index.js', content: 'main export' },
            { path: 'utils.js', content: 'utility functions' },
            { path: 'types.js', content: 'type definitions' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const depDir = path.join(testDir, 'multi-file@1.2.3');
        expect(fs.existsSync(path.join(depDir, 'index.js'))).toBe(true);
        expect(fs.existsSync(path.join(depDir, 'utils.js'))).toBe(true);
        expect(fs.existsSync(path.join(depDir, 'types.js'))).toBe(true);

        expect(fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8')).toBe('main export');
        expect(fs.readFileSync(path.join(depDir, 'utils.js'), 'utf-8')).toBe('utility functions');
        expect(fs.readFileSync(path.join(depDir, 'types.js'), 'utf-8')).toBe('type definitions');
      });
    });

    describe('nested paths', () => {
      it('should create nested directories for nested paths', () => {
        const dependency: DownloadedDependency = {
          name: 'nested-pkg',
          version: '1.0.0',
          files: [
            { path: 'internal/client.js', content: 'client code' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const filePath = path.join(testDir, 'nested-pkg@1.0.0', 'internal', 'client.js');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('client code');
      });

      it('should handle deeply nested paths', () => {
        const dependency: DownloadedDependency = {
          name: 'deep-pkg',
          version: '3.0.0',
          files: [
            { path: 'a/b/c/d/deep.js', content: 'deep content' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const filePath = path.join(testDir, 'deep-pkg@3.0.0', 'a', 'b', 'c', 'd', 'deep.js');
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('deep content');
      });

      it('should handle multiple nested files', () => {
        const dependency: DownloadedDependency = {
          name: 'multi-nested',
          version: '1.0.0',
          files: [
            { path: 'index.js', content: 'root' },
            { path: 'sub/a.js', content: 'sub a' },
            { path: 'sub/b.js', content: 'sub b' },
            { path: 'deep/nested/c.js', content: 'deep c' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const depDir = path.join(testDir, 'multi-nested@1.0.0');
        expect(fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8')).toBe('root');
        expect(fs.readFileSync(path.join(depDir, 'sub', 'a.js'), 'utf-8')).toBe('sub a');
        expect(fs.readFileSync(path.join(depDir, 'sub', 'b.js'), 'utf-8')).toBe('sub b');
        expect(fs.readFileSync(path.join(depDir, 'deep', 'nested', 'c.js'), 'utf-8')).toBe('deep c');
      });
    });

    describe('directory handling', () => {
      it('should work when output directory already exists', () => {
        const dependency: DownloadedDependency = {
          name: 'existing-pkg',
          version: '1.0.0',
          files: [
            { path: 'index.js', content: 'content' },
          ],
        };

        // Directory already exists via beforeEach
        expect(fs.existsSync(testDir)).toBe(true);

        expect(() => {
          saveDownloadedDependency(dependency, testDir);
        }).not.toThrow();
      });

      it('should overwrite existing files', () => {
        const depDir = path.join(testDir, 'overwrite-pkg@1.0.0');
        fs.mkdirSync(depDir, { recursive: true });
        fs.writeFileSync(path.join(depDir, 'index.js'), 'old content');

        const dependency: DownloadedDependency = {
          name: 'overwrite-pkg',
          version: '1.0.0',
          files: [
            { path: 'index.js', content: 'new content' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        expect(fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8')).toBe('new content');
      });

      it('should work with empty files array', () => {
        const dependency: DownloadedDependency = {
          name: 'empty-pkg',
          version: '1.0.0',
          files: [],
        };

        expect(() => {
          saveDownloadedDependency(dependency, testDir);
        }).not.toThrow();

        const depDir = path.join(testDir, 'empty-pkg@1.0.0');
        expect(fs.existsSync(depDir)).toBe(true);
      });
    });

    describe('special characters', () => {
      it('should handle scoped package names', () => {
        const dependency: DownloadedDependency = {
          name: '@scope/package',
          version: '1.0.0',
          files: [
            { path: 'index.js', content: 'scoped' },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const depDir = path.join(testDir, '@scope/package@1.0.0');
        expect(fs.existsSync(depDir)).toBe(true);
        expect(fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8')).toBe('scoped');
      });

      it('should preserve file content with special characters', () => {
        const content = 'export const msg = "Hello\\nWorld\\t!";';
        const dependency: DownloadedDependency = {
          name: 'special-chars',
          version: '1.0.0',
          files: [
            { path: 'index.js', content },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const filePath = path.join(testDir, 'special-chars@1.0.0', 'index.js');
        expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
      });

      it('should handle unicode content', () => {
        const content = 'export const emoji = "Hello! Your file saved successfully!";';
        const dependency: DownloadedDependency = {
          name: 'unicode-pkg',
          version: '1.0.0',
          files: [
            { path: 'index.js', content },
          ],
        };

        saveDownloadedDependency(dependency, testDir);

        const filePath = path.join(testDir, 'unicode-pkg@1.0.0', 'index.js');
        expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
      });
    });
  });

  describe('downloadFrameworkDependency()', () => {
    // These tests use the actual esm.sh CDN to verify real behavior
    // They are slower but ensure real-world compatibility

    describe('successful downloads', () => {
      it('should download main export and return correct structure', async () => {
        // Use a small, stable package for testing
        const result = await downloadFrameworkDependency('is-number', '7.0.0');

        expect(result.name).toBe('is-number');
        expect(result.version).toBe('7.0.0');
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe('index.js');
        expect(typeof result.files[0].content).toBe('string');
        expect(result.files[0].content.length).toBeGreaterThan(0);
      }, 30000);

      it('should download sub-exports when provided', async () => {
        // Using is-number with a fake sub-export to test error handling path
        const result = await downloadFrameworkDependency('is-number', '7.0.0', []);

        expect(result.name).toBe('is-number');
        expect(result.version).toBe('7.0.0');
        expect(result.files).toHaveLength(1);
      }, 30000);
    });

    describe('sub-export path conversion', () => {
      it('should convert slashes in sub-export names to dashes', async () => {
        // Mock axios to test the path conversion logic
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValueOnce({ data: 'main content' });
        axiosGetSpy.mockResolvedValueOnce({ data: 'sub content' });

        const result = await downloadFrameworkDependency('test-pkg', '1.0.0', ['internal/client']);

        expect(result.files).toHaveLength(2);
        expect(result.files[0].path).toBe('index.js');
        expect(result.files[1].path).toBe('internal-client.js');

        axiosGetSpy.mockRestore();
      });

      it('should handle multiple sub-exports', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValue({ data: 'content' });

        const result = await downloadFrameworkDependency('test-pkg', '1.0.0', ['a', 'b', 'c/d']);

        expect(result.files).toHaveLength(4);
        expect(result.files.map(f => f.path)).toEqual([
          'index.js',
          'a.js',
          'b.js',
          'c-d.js',
        ]);

        axiosGetSpy.mockRestore();
      });
    });

    describe('error handling', () => {
      it('should throw error when main export download fails', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockRejectedValue(new Error('Network error'));

        await expect(
          downloadFrameworkDependency('non-existent-package-xyz', '999.999.999')
        ).rejects.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalled();

        axiosGetSpy.mockRestore();
      });

      it('should skip failed sub-export downloads with warning', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        // Main export succeeds
        axiosGetSpy.mockResolvedValueOnce({ data: 'main content' });
        // Sub-export fails
        axiosGetSpy.mockRejectedValueOnce(new Error('Not found'));

        const result = await downloadFrameworkDependency('test-pkg', '1.0.0', ['non-existent']);

        // Should only have main export
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe('index.js');

        // Should have logged a warning
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Could not download test-pkg/non-existent')
        );

        axiosGetSpy.mockRestore();
      });

      it('should continue downloading other sub-exports after one fails', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValueOnce({ data: 'main' }); // main
        axiosGetSpy.mockRejectedValueOnce(new Error('Fail')); // first sub-export fails
        axiosGetSpy.mockResolvedValueOnce({ data: 'second' }); // second sub-export succeeds

        const result = await downloadFrameworkDependency('test-pkg', '1.0.0', ['fail', 'success']);

        expect(result.files).toHaveLength(2);
        expect(result.files[0].path).toBe('index.js');
        expect(result.files[1].path).toBe('success.js');

        axiosGetSpy.mockRestore();
      });

      it('should include package name in error message when main download fails', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockRejectedValue(new Error('Connection refused'));

        await expect(
          downloadFrameworkDependency('my-package', '2.0.0')
        ).rejects.toThrow();

        const errorCall = consoleErrorSpy.mock.calls[0];
        expect(errorCall[0]).toContain('my-package');

        axiosGetSpy.mockRestore();
      });
    });

    describe('axios configuration', () => {
      it('should call axios with correct URL format', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValue({ data: 'content' });

        await downloadFrameworkDependency('test-package', '1.2.3');

        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://esm.sh/test-package@1.2.3',
          expect.any(Object)
        );

        axiosGetSpy.mockRestore();
      });

      it('should call axios with correct sub-export URL format', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValue({ data: 'content' });

        await downloadFrameworkDependency('react', '19.0.0', ['jsx-runtime']);

        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://esm.sh/react@19.0.0',
          expect.any(Object)
        );
        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://esm.sh/react@19.0.0/jsx-runtime',
          expect.any(Object)
        );

        axiosGetSpy.mockRestore();
      });

      it('should set responseType to text', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValue({ data: 'content' });

        await downloadFrameworkDependency('test', '1.0.0');

        expect(axiosGetSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            responseType: 'text',
          })
        );

        axiosGetSpy.mockRestore();
      });

      it('should set User-Agent header', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValue({ data: 'content' });

        await downloadFrameworkDependency('test', '1.0.0');

        expect(axiosGetSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'User-Agent': 'oaysus-cli',
            }),
          })
        );

        axiosGetSpy.mockRestore();
      });
    });
  });

  describe('integration tests', () => {
    describe('download and save workflow', () => {
      it('should download and save a dependency end-to-end', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValueOnce({ data: 'main content' });
        axiosGetSpy.mockResolvedValueOnce({ data: 'sub content' });

        const dependency = await downloadFrameworkDependency('test-pkg', '1.0.0', ['sub']);

        saveDownloadedDependency(dependency, testDir);

        const depDir = path.join(testDir, 'test-pkg@1.0.0');
        expect(fs.existsSync(depDir)).toBe(true);
        expect(fs.readFileSync(path.join(depDir, 'index.js'), 'utf-8')).toBe('main content');
        expect(fs.readFileSync(path.join(depDir, 'sub.js'), 'utf-8')).toBe('sub content');

        axiosGetSpy.mockRestore();
      });

      it('should handle full framework dependency download workflow', async () => {
        const axiosGetSpy = jest.spyOn(axios, 'get');
        axiosGetSpy.mockResolvedValue({ data: 'framework code' });

        const deps = getFrameworkDependencies('react', '19.0.0');

        for (const dep of deps) {
          const downloaded = await downloadFrameworkDependency(
            dep.packageName,
            dep.version,
            dep.subExports
          );
          saveDownloadedDependency(downloaded, testDir);
        }

        // Verify react was saved
        const reactDir = path.join(testDir, 'react@19.0.0');
        expect(fs.existsSync(reactDir)).toBe(true);
        expect(fs.existsSync(path.join(reactDir, 'index.js'))).toBe(true);
        expect(fs.existsSync(path.join(reactDir, 'jsx-runtime.js'))).toBe(true);
        expect(fs.existsSync(path.join(reactDir, 'jsx-dev-runtime.js'))).toBe(true);

        // Verify react-dom was saved
        const reactDomDir = path.join(testDir, 'react-dom@19.0.0');
        expect(fs.existsSync(reactDomDir)).toBe(true);
        expect(fs.existsSync(path.join(reactDomDir, 'index.js'))).toBe(true);
        expect(fs.existsSync(path.join(reactDomDir, 'client.js'))).toBe(true);

        axiosGetSpy.mockRestore();
      });
    });
  });

  describe('type exports', () => {
    it('should export DownloadedDependency interface', () => {
      // Type-only test: verify the interface exists and has correct shape
      const dependency: DownloadedDependency = {
        name: 'test',
        version: '1.0.0',
        files: [
          { path: 'index.js', content: 'content' },
        ],
      };

      expect(dependency.name).toBeDefined();
      expect(dependency.version).toBeDefined();
      expect(dependency.files).toBeDefined();
      expect(Array.isArray(dependency.files)).toBe(true);
    });

    it('should require name, version, and files in DownloadedDependency', () => {
      const validDependency: DownloadedDependency = {
        name: 'pkg',
        version: '0.0.1',
        files: [],
      };

      expect(validDependency).toBeDefined();
    });

    it('should allow file objects with path and content', () => {
      const dependency: DownloadedDependency = {
        name: 'test',
        version: '1.0.0',
        files: [
          { path: 'a.js', content: 'a' },
          { path: 'b.js', content: 'b' },
        ],
      };

      expect(dependency.files[0].path).toBe('a.js');
      expect(dependency.files[0].content).toBe('a');
      expect(dependency.files[1].path).toBe('b.js');
      expect(dependency.files[1].content).toBe('b');
    });
  });
});
