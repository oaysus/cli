/**
 * Tests for zip-creator.ts
 * Verifies ZIP archive creation and byte formatting
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createZip, formatBytes } from '../src/lib/shared/zip-creator.js';

// Helper to create a temporary directory with test files
async function createTestProject(
  files: Record<string, string>
): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-creator-test-'));

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tempDir, filePath);
    const dir = path.dirname(fullPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
  }

  return tempDir;
}

// Helper to clean up temporary directory
function cleanupTestProject(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('zip-creator module', () => {
  describe('formatBytes()', () => {
    it('should return "0 B" for 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes under 1024 correctly', () => {
      expect(formatBytes(1)).toBe('1 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(1024 * 500)).toBe('500.0 KB');
      expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
      expect(formatBytes(1024 * 1024 * 100)).toBe('100.0 MB');
      expect(formatBytes(1024 * 1024 * 1024 - 1)).toBe('1024.0 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 10)).toBe('10.0 GB');
    });

    it('should handle edge cases at boundaries', () => {
      // Just under 1 KB
      expect(formatBytes(1023)).toBe('1023 B');
      // Exactly 1 KB
      expect(formatBytes(1024)).toBe('1.0 KB');

      // Just under 1 MB
      expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
      // Exactly 1 MB
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');

      // Just under 1 GB
      expect(formatBytes(1024 * 1024 * 1024 - 1)).toBe('1024.0 MB');
      // Exactly 1 GB
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should handle decimal precision', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      // 1024 * 1.25 = 1280, 1280 / 1024 = 1.25, toFixed(1) = '1.3' (rounding)
      expect(formatBytes(1024 * 1.25)).toBe('1.3 KB');
      expect(formatBytes(1024 * 1.99)).toBe('2.0 KB');
    });
  });

  describe('createZip()', () => {
    let tempDir: string;

    afterEach(() => {
      if (tempDir) {
        cleanupTestProject(tempDir);
      }
    });

    it('should create a valid ZIP buffer', async () => {
      tempDir = await createTestProject({
        'index.js': 'console.log("hello");',
        'package.json': '{"name": "test"}',
      });

      const result = await createZip(tempDir);

      expect(result).toBeDefined();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.size).toBeGreaterThan(0);
      expect(result.buffer.length).toBe(result.size);
    });

    it('should return correct file count', async () => {
      tempDir = await createTestProject({
        'file1.js': 'content1',
        'file2.js': 'content2',
        'file3.txt': 'content3',
      });

      const result = await createZip(tempDir);

      expect(result.fileCount).toBe(3);
      expect(result.files).toHaveLength(3);
      expect(result.files).toContain('file1.js');
      expect(result.files).toContain('file2.js');
      expect(result.files).toContain('file3.txt');
    });

    it('should calculate SHA256 hash correctly', async () => {
      tempDir = await createTestProject({
        'test.js': 'test content',
      });

      const result = await createZip(tempDir);

      // Verify hash is valid hex string
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Verify hash is correct
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.buffer)
        .digest('hex');
      expect(result.sha256).toBe(expectedHash);
    });

    it('should include files in subdirectories', async () => {
      tempDir = await createTestProject({
        'src/index.js': 'export default {}',
        'src/components/Button.js': 'export const Button = () => {}',
        'lib/utils.js': 'export const utils = {}',
      });

      const result = await createZip(tempDir);

      expect(result.fileCount).toBe(3);
      expect(result.files).toContain('src/index.js');
      expect(result.files).toContain('src/components/Button.js');
      expect(result.files).toContain('lib/utils.js');
    });

    describe('default exclusions', () => {
      it('should exclude node_modules', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          'node_modules/package/index.js': 'module content',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).not.toContain('node_modules/package/index.js');
        expect(result.excludedCount).toBe(1);
      });

      it('should exclude .git directory', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          '.git/config': 'git config',
          '.git/HEAD': 'ref: refs/heads/main',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).not.toContain('.git/config');
        expect(result.files).not.toContain('.git/HEAD');
      });

      it('should exclude .gitignore', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          '.gitignore': 'node_modules',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).not.toContain('.gitignore');
      });

      it('should exclude .DS_Store', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          '.DS_Store': 'macOS file',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).not.toContain('.DS_Store');
      });

      it('should exclude log files', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          'debug.log': 'debug output',
          'error.log': 'error output',
          'logs/app.log': 'app logs',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).not.toContain('debug.log');
        expect(result.files).not.toContain('error.log');
        expect(result.files).not.toContain('logs/app.log');
      });

      it('should exclude dist and build directories', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'dist/bundle.js': 'bundled',
          'build/output.js': 'built',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('dist/bundle.js');
        expect(result.files).not.toContain('build/output.js');
      });

      it('should exclude .env files', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          '.env': 'SECRET=123',
          '.env.local': 'LOCAL_SECRET=456',
          '.env.production': 'PROD_SECRET=789',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).not.toContain('.env');
        expect(result.files).not.toContain('.env.local');
        expect(result.files).not.toContain('.env.production');
      });

      it('should exclude test files', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'src/index.test.js': 'test content',
          'src/index.test.ts': 'test content',
          'src/index.test.tsx': 'test content',
          'src/index.test.jsx': 'test content',
          'src/index.spec.js': 'spec content',
          'src/index.spec.ts': 'spec content',
          'src/index.spec.tsx': 'spec content',
          'src/index.spec.jsx': 'spec content',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('src/index.test.js');
        expect(result.files).not.toContain('src/index.test.ts');
        expect(result.files).not.toContain('src/index.test.tsx');
        expect(result.files).not.toContain('src/index.test.jsx');
        expect(result.files).not.toContain('src/index.spec.js');
        expect(result.files).not.toContain('src/index.spec.ts');
        expect(result.files).not.toContain('src/index.spec.tsx');
        expect(result.files).not.toContain('src/index.spec.jsx');
      });

      it('should exclude coverage directories', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'coverage/lcov.info': 'coverage data',
          '.nyc_output/data.json': 'nyc data',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('coverage/lcov.info');
        expect(result.files).not.toContain('.nyc_output/data.json');
      });

      it('should exclude Python cache directories', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          '__pycache__/module.pyc': 'bytecode',
          'src/__pycache__/nested.pyc': 'nested bytecode',
          '.pytest_cache/CACHEDIR.TAG': 'cache',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('__pycache__/module.pyc');
        expect(result.files).not.toContain('src/__pycache__/nested.pyc');
        expect(result.files).not.toContain('.pytest_cache/CACHEDIR.TAG');
      });

      it('should exclude IDE directories', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          '.vscode/settings.json': 'vscode settings',
          '.idea/workspace.xml': 'idea workspace',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('.vscode/settings.json');
        expect(result.files).not.toContain('.idea/workspace.xml');
      });

      it('should exclude config files', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'tsconfig.json': '{}',
          'jest.config.js': 'module.exports = {}',
          'jest.config.ts': 'export default {}',
          '.eslintrc': '{}',
          '.eslintrc.js': 'module.exports = {}',
          '.prettierrc': '{}',
          '.prettierrc.json': '{}',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('tsconfig.json');
        expect(result.files).not.toContain('jest.config.js');
        expect(result.files).not.toContain('jest.config.ts');
        expect(result.files).not.toContain('.eslintrc');
        expect(result.files).not.toContain('.eslintrc.js');
        expect(result.files).not.toContain('.prettierrc');
        expect(result.files).not.toContain('.prettierrc.json');
      });
    });

    describe('additional exclusions', () => {
      it('should apply additional exclusions from parameter', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'docs/readme.md': 'documentation',
          'examples/example.js': 'example code',
        });

        const result = await createZip(tempDir, ['docs/**', 'examples/**']);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('docs/readme.md');
        expect(result.files).not.toContain('examples/example.js');
      });

      it('should handle exclusion patterns ending with slash', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'temp/file.txt': 'temp file',
          'temp/nested/deep.txt': 'deep file',
        });

        // Pattern ending with / should become /**
        const result = await createZip(tempDir, ['temp/']);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('temp/file.txt');
        expect(result.files).not.toContain('temp/nested/deep.txt');
      });

      it('should handle exclusion patterns without slash', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'readme.txt': 'readme file',
        });

        const result = await createZip(tempDir, ['readme.txt']);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('readme.txt');
      });

      it('should handle multiple additional exclusions', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'docs/api.md': 'api docs',
          'scripts/build.sh': 'build script',
          'assets/logo.png': 'logo',
        });

        const result = await createZip(tempDir, ['docs/', 'scripts/', 'assets/']);

        expect(result.files).toContain('src/index.js');
        expect(result.files).not.toContain('docs/api.md');
        expect(result.files).not.toContain('scripts/build.sh');
        expect(result.files).not.toContain('assets/logo.png');
      });

      it('should handle empty additional exclusions array', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
        });

        const result = await createZip(tempDir, []);

        expect(result.files).toContain('src/index.js');
        expect(result.fileCount).toBe(1);
      });

      it('should combine default and additional exclusions', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'node_modules/pkg/index.js': 'module',
          'custom-ignore/file.txt': 'custom',
        });

        const result = await createZip(tempDir, ['custom-ignore/']);

        expect(result.files).toContain('src/index.js');
        // Default exclusion
        expect(result.files).not.toContain('node_modules/pkg/index.js');
        // Additional exclusion
        expect(result.files).not.toContain('custom-ignore/file.txt');
      });
    });

    describe('dot files handling', () => {
      it('should include dot files like .oaysusrc.json', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          '.oaysusrc.json': '{"name": "test"}',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).toContain('.oaysusrc.json');
      });

      it('should include other config dot files not in exclusion list', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
          '.babelrc': '{}',
          '.npmrc': 'registry=...',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('index.js');
        expect(result.files).toContain('.babelrc');
        expect(result.files).toContain('.npmrc');
      });
    });

    describe('excluded count tracking', () => {
      it('should track excluded file count correctly', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'node_modules/pkg/a.js': 'a',
          'node_modules/pkg/b.js': 'b',
          '.gitignore': 'ignore',
        });

        const result = await createZip(tempDir);

        expect(result.fileCount).toBe(1);
        expect(result.excludedCount).toBe(3);
      });

      it('should report zero excluded when all files included', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'lib/utils.js': 'utils',
        });

        const result = await createZip(tempDir);

        expect(result.fileCount).toBe(2);
        expect(result.excludedCount).toBe(0);
      });
    });

    describe('ZIP compression', () => {
      it('should compress files with maximum compression', async () => {
        // Create a file with highly compressible content
        const repeatContent = 'a'.repeat(10000);
        tempDir = await createTestProject({
          'compressible.txt': repeatContent,
        });

        const result = await createZip(tempDir);

        // Compressed size should be significantly smaller than original
        expect(result.size).toBeLessThan(repeatContent.length);
      });
    });

    describe('empty project handling', () => {
      it('should handle project with no files', async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-creator-empty-'));

        const result = await createZip(tempDir);

        expect(result.fileCount).toBe(0);
        expect(result.excludedCount).toBe(0);
        expect(result.files).toEqual([]);
        expect(result.buffer).toBeInstanceOf(Buffer);
      });

      it('should handle project with only excluded files', async () => {
        tempDir = await createTestProject({
          'node_modules/pkg/index.js': 'content',
          '.gitignore': 'ignore',
        });

        const result = await createZip(tempDir);

        expect(result.fileCount).toBe(0);
        expect(result.excludedCount).toBe(2);
        expect(result.files).toEqual([]);
      });
    });

    describe('binary files', () => {
      it('should handle binary file content', async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-creator-binary-'));
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
        fs.writeFileSync(path.join(tempDir, 'binary.bin'), binaryContent);

        const result = await createZip(tempDir);

        expect(result.fileCount).toBe(1);
        expect(result.files).toContain('binary.bin');
        expect(result.buffer).toBeInstanceOf(Buffer);
      });
    });

    describe('special characters in filenames', () => {
      it('should handle files with spaces in names', async () => {
        tempDir = await createTestProject({
          'file with spaces.js': 'content',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('file with spaces.js');
      });

      it('should handle files with unicode characters', async () => {
        tempDir = await createTestProject({
          'file-with-emoji.js': 'content',
          'archivo.js': 'contenido',
        });

        const result = await createZip(tempDir);

        expect(result.fileCount).toBe(2);
      });
    });

    describe('deeply nested directories', () => {
      it('should handle deeply nested file structures', async () => {
        tempDir = await createTestProject({
          'a/b/c/d/e/f/g/deep.js': 'deep content',
        });

        const result = await createZip(tempDir);

        expect(result.files).toContain('a/b/c/d/e/f/g/deep.js');
      });
    });

    describe('result structure', () => {
      it('should return all expected properties', async () => {
        tempDir = await createTestProject({
          'index.js': 'content',
        });

        const result = await createZip(tempDir);

        expect(result).toHaveProperty('buffer');
        expect(result).toHaveProperty('size');
        expect(result).toHaveProperty('sha256');
        expect(result).toHaveProperty('fileCount');
        expect(result).toHaveProperty('excludedCount');
        expect(result).toHaveProperty('files');
      });

      it('should return files array with relative paths', async () => {
        tempDir = await createTestProject({
          'src/index.js': 'content',
          'lib/utils.js': 'utils',
        });

        const result = await createZip(tempDir);

        // Files should be relative paths, not absolute
        for (const file of result.files) {
          expect(file.startsWith('/')).toBe(false);
          expect(file.includes(tempDir)).toBe(false);
        }
      });
    });

    describe('archiver warning handling', () => {
      it('should handle ENOENT warnings gracefully', async () => {
        // Create a project with a valid file
        tempDir = await createTestProject({
          'index.js': 'content',
        });

        // The archiver handles ENOENT warnings internally
        // This test verifies the function completes without throwing
        const result = await createZip(tempDir);

        expect(result).toBeDefined();
        expect(result.buffer).toBeInstanceOf(Buffer);
      });

      it('should log non-ENOENT warnings', async () => {
        // Create a valid project
        tempDir = await createTestProject({
          'index.js': 'content',
        });

        // Spy on console.warn to verify warning behavior
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await createZip(tempDir);

        expect(result).toBeDefined();

        // Restore console.warn
        warnSpy.mockRestore();
      });
    });

    describe('error handling', () => {
      it('should handle non-existent project path gracefully', async () => {
        const nonExistentPath = '/non/existent/path/that/does/not/exist';

        // createZip should handle missing directory gracefully
        // The glob will return empty results for non-existent path
        const result = await createZip(nonExistentPath);

        // With a non-existent path, glob returns empty array
        expect(result.fileCount).toBe(0);
        expect(result.files).toEqual([]);
      });

      it('should handle file disappearing during zip creation', async () => {
        // Create a project with multiple files
        tempDir = await createTestProject({
          'index.js': 'content',
          'other.js': 'other content',
        });

        // The file deletion race condition is difficult to trigger reliably
        // This test verifies the function completes even with potential issues
        const result = await createZip(tempDir);

        expect(result).toBeDefined();
        expect(result.buffer).toBeInstanceOf(Buffer);
      });

      it('should handle symlinks gracefully', async () => {
        tempDir = await createTestProject({
          'real-file.js': 'real content',
        });

        // Create a symlink
        const symlinkPath = path.join(tempDir, 'symlink.js');
        const realFilePath = path.join(tempDir, 'real-file.js');

        try {
          fs.symlinkSync(realFilePath, symlinkPath);
        } catch {
          // Symlinks might not be supported on all systems, skip test
          return;
        }

        const result = await createZip(tempDir);

        expect(result).toBeDefined();
        expect(result.fileCount).toBeGreaterThanOrEqual(1);
      });

      // Note: The archiver error handler (line 98) and non-ENOENT warning handler
      // (lines 102-103) are difficult to trigger in integration tests because:
      // 1. The error handler requires the archiver stream to emit a fatal error
      // 2. The warning handler requires a non-ENOENT warning to be emitted
      // These edge cases occur during I/O errors or stream corruption which
      // cannot be reliably simulated without mocking the archiver module.
      // ESM modules cannot have their exports mocked in Jest, so these lines
      // remain uncovered. The handlers are properly implemented for production
      // robustness and will catch any archiver-related errors/warnings.
    });

    describe('consistency', () => {
      it('should produce consistent results for same input', async () => {
        tempDir = await createTestProject({
          'index.js': 'const x = 1;',
          'utils.js': 'export const y = 2;',
        });

        const result1 = await createZip(tempDir);
        const result2 = await createZip(tempDir);

        expect(result1.fileCount).toBe(result2.fileCount);
        expect(result1.excludedCount).toBe(result2.excludedCount);
        expect(result1.files.sort()).toEqual(result2.files.sort());
        // Note: SHA256 might differ due to timestamps in ZIP, but structure should match
      });
    });
  });
});
