/**
 * Tests for validator.ts
 * Verifies package validation logic
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Test directory
const testDir = path.join(os.tmpdir(), 'oaysus-validator-test-' + Date.now());

describe('validator module', () => {
  beforeEach(async () => {
    jest.resetModules();
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('validatePackage()', () => {
    it('should fail validation when package.json is missing', async () => {
      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('package.json');
    });

    it('should fail validation with invalid package name', async () => {
      // Create package.json with invalid name
      const packageJson = {
        name: 'Invalid Name With Spaces',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      // Create a minimal index.tsx
      await fs.writeFile(path.join(testDir, 'index.tsx'), 'export default function() {}');

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('name'))).toBe(true);
    });

    it('should fail validation with invalid version format', async () => {
      const packageJson = {
        name: 'test-package',
        version: 'invalid-version',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(path.join(testDir, 'index.tsx'), 'export default function() {}');

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('version'))).toBe(true);
    });

    it('should detect React framework from dependencies', async () => {
      const packageJson = {
        name: 'react-component',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'react-component',
            displayName: 'React Component',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.framework).toBe('react');
    });

    it('should detect Vue framework from dependencies', async () => {
      const packageJson = {
        name: 'vue-component',
        version: '1.0.0',
        dependencies: { vue: '^3.0.0' },
        oaysus: {
          theme: {
            name: 'vue-component',
            displayName: 'Vue Component',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.vue'),
        '<template><div></div></template>'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.framework).toBe('vue');
    });

    it('should detect Svelte framework from dependencies', async () => {
      const packageJson = {
        name: 'svelte-component',
        version: '1.0.0',
        dependencies: { svelte: '^4.0.0' },
        oaysus: {
          theme: {
            name: 'svelte-component',
            displayName: 'Svelte Component',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.svelte'),
        '<script></script><div></div>'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.framework).toBe('svelte');
    });

    it('should fail when no framework detected', async () => {
      const packageJson = {
        name: 'no-framework',
        version: '1.0.0',
        dependencies: { lodash: '^4.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('framework'))).toBe(true);
    });

    it('should detect single component type from root index file', async () => {
      const packageJson = {
        name: 'single-component',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'single-component',
            displayName: 'Single Component',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.type).toBe('component');
    });

    it('should detect theme-pack type from components directory', async () => {
      const packageJson = {
        name: 'theme-pack',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'theme-pack',
            displayName: 'Theme Pack',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory with a component
      await fs.mkdir(path.join(testDir, 'components', 'Button'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Button', 'index.tsx'),
        'export default function Button() { return null; }'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.type).toBe('theme-pack');
    });

    it('should pass validation with valid React component', async () => {
      const packageJson = {
        name: 'valid-react-component',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'valid-react-component',
            displayName: 'Valid React Component',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      // Create required schema.json for component validation
      const schema = {
        type: 'component',
        displayName: 'Valid React Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.inferredConfig.framework).toBe('react');
      expect(result.inferredConfig.type).toBe('component');
      expect(result.packageJson.name).toBe('valid-react-component');
    });
  });
});
