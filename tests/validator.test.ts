/**
 * Tests for validator.ts
 * Verifies package validation logic
 */

// Jest globals are auto-imported
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Test directory - unique per test run
let testDir: string;

describe('validator module', () => {
  beforeEach(async () => {
    // Create unique test directory per test
    testDir = path.join(os.tmpdir(), 'oaysus-validator-test-' + Date.now() + '-' + Math.random().toString(36).slice(2));
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

    // ============================================
    // Tests for uncovered lines 94, 160-168
    // Project type cannot be determined (no index file AND no components dir)
    // ============================================
    it('should fail when project type cannot be determined (line 94, 160-168)', async () => {
      const packageJson = {
        name: 'unknown-type',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      // No index.tsx, no components/ directory

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Cannot determine project type'))).toBe(true);
    });

    // ============================================
    // Tests for uncovered lines 174-207
    // Theme pack without oaysus.theme metadata
    // ============================================
    it('should fail when theme-pack is missing oaysus.theme metadata (lines 174-207)', async () => {
      const packageJson = {
        name: 'theme-pack-no-meta',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        // Missing oaysus.theme
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory to trigger theme-pack detection
      await fs.mkdir(path.join(testDir, 'components', 'Button'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Button', 'index.tsx'),
        'export default function Button() { return null; }'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing Required Theme Metadata'))).toBe(true);
      expect(result.errors.some(e => e.includes('oaysus'))).toBe(true);
      expect(result.inferredConfig.framework).toBe('react');
      expect(result.inferredConfig.type).toBe('theme-pack');
      expect(result.inferredConfig.componentCount).toBe(0);
    });

    // ============================================
    // Tests for uncovered lines 212-226
    // Theme pack with oaysus.theme but empty name or displayName
    // The Zod schema passes with empty strings, but the check at line 211 fails
    // ============================================
    it('should fail when theme-pack has oaysus.theme with empty name (lines 212-226)', async () => {
      const packageJson = {
        name: 'theme-pack-empty-name',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: '', // Empty string passes Zod but fails the check at line 211
            displayName: 'Theme Pack Display Name',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory to trigger theme-pack detection
      await fs.mkdir(path.join(testDir, 'components', 'Button'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Button', 'index.tsx'),
        'export default function Button() { return null; }'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Theme must have'))).toBe(true);
      expect(result.inferredConfig.framework).toBe('react');
      expect(result.inferredConfig.type).toBe('theme-pack');
    });

    it('should fail when theme-pack has oaysus.theme with empty displayName (lines 212-226)', async () => {
      const packageJson = {
        name: 'theme-pack-empty-display',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'theme-pack-name',
            displayName: '', // Empty string passes Zod but fails the check at line 211
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory to trigger theme-pack detection
      await fs.mkdir(path.join(testDir, 'components', 'Button'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Button', 'index.tsx'),
        'export default function Button() { return null; }'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Theme must have'))).toBe(true);
    });

    // ============================================
    // Tests for uncovered lines 279-281, 283-284
    // Invalid component schema
    // ============================================
    it('should report errors for invalid schema.json (lines 279-284)', async () => {
      const packageJson = {
        name: 'invalid-schema',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      // Create invalid schema - missing required fields
      const schema = {
        // Missing type, displayName, props
        invalidField: 'something',
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid schema'))).toBe(true);
    });

    it('should report multiple schema validation errors', async () => {
      const packageJson = {
        name: 'multi-error-schema',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      // Schema with wrong types
      const schema = {
        type: 123, // Should be string
        displayName: 456, // Should be string
        props: 'not an object', // Should be object
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.filter(e => e.includes('Invalid schema')).length).toBeGreaterThan(0);
    });

    // ============================================
    // Tests for uncovered line 292
    // Theme pack entry point path (vs single component)
    // ============================================
    it('should validate theme-pack component entry points (line 292)', async () => {
      const packageJson = {
        name: 'theme-pack-entry',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'theme-pack-entry',
            displayName: 'Theme Pack Entry',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory with schema and index
      await fs.mkdir(path.join(testDir, 'components', 'Card'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Card', 'index.tsx'),
        'export default function Card() { return null; }'
      );
      const schema = {
        type: 'Card',
        displayName: 'Card Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'Card', 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('Card');
    });

    // ============================================
    // Tests for uncovered lines 298-299
    // Missing entry point file
    // ============================================
    it('should fail when entry point file is missing for single component (lines 298-299)', async () => {
      const packageJson = {
        name: 'missing-entry',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      // Create index.tsx so type detection works, then delete it
      await fs.writeFile(path.join(testDir, 'index.tsx'), 'export default function() {}');

      // Create schema.json but then remove the index.tsx
      const schema = {
        type: 'component',
        displayName: 'Missing Entry',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Remove index.tsx to simulate missing entry point
      await fs.rm(path.join(testDir, 'index.tsx'));

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      // Type detection returns null since index.tsx is missing and no components dir
      expect(result.valid).toBe(false);
    });

    it('should fail when entry point file is missing for theme-pack component (lines 298-299)', async () => {
      const packageJson = {
        name: 'theme-pack-missing-entry',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'theme-pack-missing-entry',
            displayName: 'Theme Pack Missing Entry',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory with schema but NO index.tsx
      await fs.mkdir(path.join(testDir, 'components', 'Missing'), { recursive: true });
      const schema = {
        type: 'Missing',
        displayName: 'Missing Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'Missing', 'schema.json'),
        JSON.stringify(schema)
      );
      // No index.tsx created!

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing entry point'))).toBe(true);
    });

    // ============================================
    // Tests for uncovered line 310
    // Error handling when processing schema fails
    // ============================================
    it('should handle malformed JSON in schema.json (line 310)', async () => {
      const packageJson = {
        name: 'malformed-schema',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      // Write malformed JSON
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        '{ invalid json content'
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to process') || e.includes('schema.json'))).toBe(true);
    });

    // ============================================
    // Tests for uncovered lines 316-330
    // No valid components found (after processing all schemas)
    // ============================================
    it('should fail when no valid components found after schema validation (lines 316-330)', async () => {
      const packageJson = {
        name: 'no-valid-components',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'no-valid-components',
            displayName: 'No Valid Components',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory with invalid schema (all schemas invalid)
      await fs.mkdir(path.join(testDir, 'components', 'Invalid1'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Invalid1', 'index.tsx'),
        'export default function Invalid1() { return null; }'
      );
      // Invalid schema - missing required fields
      await fs.writeFile(
        path.join(testDir, 'components', 'Invalid1', 'schema.json'),
        JSON.stringify({ badField: 'value' })
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('No valid components found'))).toBe(true);
      expect(result.inferredConfig.componentCount).toBe(0);
    });

    // ============================================
    // Tests for uncovered line 335
    // Warning for node_modules directory
    // ============================================
    it('should warn when node_modules directory is present (line 335)', async () => {
      const packageJson = {
        name: 'with-node-modules',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Create node_modules directory
      await fs.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('node_modules'))).toBe(true);
    });

    // ============================================
    // Tests for uncovered line 342
    // Warning for unnecessary files
    // ============================================
    it('should warn when .git directory is present (line 342)', async () => {
      const packageJson = {
        name: 'with-git',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Create .git directory
      await fs.mkdir(path.join(testDir, '.git'), { recursive: true });

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('.git'))).toBe(true);
    });

    it('should warn when dist directory is present', async () => {
      const packageJson = {
        name: 'with-dist',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Create dist directory
      await fs.mkdir(path.join(testDir, 'dist'), { recursive: true });

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('dist'))).toBe(true);
    });

    it('should warn when build directory is present', async () => {
      const packageJson = {
        name: 'with-build',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Create build directory
      await fs.mkdir(path.join(testDir, 'build'), { recursive: true });

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('build'))).toBe(true);
    });

    it('should warn when coverage directory is present', async () => {
      const packageJson = {
        name: 'with-coverage',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Create coverage directory
      await fs.mkdir(path.join(testDir, 'coverage'), { recursive: true });

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('coverage'))).toBe(true);
    });

    it('should warn when .DS_Store is present', async () => {
      const packageJson = {
        name: 'with-dsstore',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );
      // Create .DS_Store file
      await fs.writeFile(path.join(testDir, '.DS_Store'), '');

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('.DS_Store'))).toBe(true);
    });

    // ============================================
    // Tests for uncovered lines 363-372
    // Top-level catch block for unexpected errors
    // ============================================
    it('should handle unexpected errors gracefully (lines 363-372)', async () => {
      // Test with a path that will cause an error
      const { validatePackage } = await import('../src/lib/validator.js');

      // Use a path that doesn't exist to trigger an error in the catch block
      // We need the package.json to exist but then have something fail
      const packageJson = {
        name: 'test-error',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );

      // Make package.json unreadable to trigger an error (requires special handling)
      // Instead, let's test with invalid JSON in package.json that will throw during parse
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        'not valid json at all {'
      );

      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Validation error'))).toBe(true);
    });

    // ============================================
    // Additional edge case tests
    // ============================================
    it('should detect framework from devDependencies', async () => {
      const packageJson = {
        name: 'dev-dep-framework',
        version: '1.0.0',
        devDependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.framework).toBe('react');
    });

    it('should detect Vue framework from devDependencies', async () => {
      const packageJson = {
        name: 'vue-dev-dep',
        version: '1.0.0',
        devDependencies: { vue: '^3.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.vue'),
        '<template><div></div></template>'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.framework).toBe('vue');
    });

    it('should detect Svelte framework from devDependencies', async () => {
      const packageJson = {
        name: 'svelte-dev-dep',
        version: '1.0.0',
        devDependencies: { svelte: '^4.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.svelte'),
        '<script></script><div></div>'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.inferredConfig.framework).toBe('svelte');
    });

    it('should fail when no schema.json files found for single component', async () => {
      const packageJson = {
        name: 'no-schema',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      // No schema.json created

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('No components found'))).toBe(true);
    });

    it('should fail when no schema.json files found for theme-pack', async () => {
      const packageJson = {
        name: 'theme-pack-no-schema',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'theme-pack-no-schema',
            displayName: 'Theme Pack No Schema',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create components directory without schema.json
      await fs.mkdir(path.join(testDir, 'components', 'NoSchema'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'NoSchema', 'index.tsx'),
        'export default function NoSchema() { return null; }'
      );
      // No schema.json created

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('No components found'))).toBe(true);
    });

    it('should handle multiple components in theme-pack', async () => {
      const packageJson = {
        name: 'multi-component-pack',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'multi-component-pack',
            displayName: 'Multi Component Pack',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create multiple components
      const components = ['Button', 'Card', 'Input'];
      for (const comp of components) {
        await fs.mkdir(path.join(testDir, 'components', comp), { recursive: true });
        await fs.writeFile(
          path.join(testDir, 'components', comp, 'index.tsx'),
          `export default function ${comp}() { return null; }`
        );
        const schema = {
          type: comp,
          displayName: `${comp} Component`,
          props: {},
        };
        await fs.writeFile(
          path.join(testDir, 'components', comp, 'schema.json'),
          JSON.stringify(schema)
        );
      }

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.components).toHaveLength(3);
      expect(result.inferredConfig.componentCount).toBe(3);
    });

    it('should include theme metadata in inferredConfig for valid theme-pack', async () => {
      const packageJson = {
        name: 'themed-pack',
        version: '2.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'themed-pack',
            displayName: 'Themed Pack',
            category: 'marketing',
            isPremium: true,
            tags: ['hero', 'landing'],
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create a component
      await fs.mkdir(path.join(testDir, 'components', 'Hero'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Hero', 'index.tsx'),
        'export default function Hero() { return null; }'
      );
      const schema = {
        type: 'Hero',
        displayName: 'Hero Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'Hero', 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.inferredConfig.theme).toEqual({
        name: 'themed-pack',
        displayName: 'Themed Pack',
        category: 'marketing',
        isPremium: true,
        tags: ['hero', 'landing'],
      });
      expect(result.inferredConfig.version).toBe('2.0.0');
      expect(result.inferredConfig.name).toBe('themed-pack');
    });

    it('should handle theme-pack with both root index and components directory (prefer theme-pack)', async () => {
      const packageJson = {
        name: 'hybrid-pack',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'hybrid-pack',
            displayName: 'Hybrid Pack',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      // Both root index and components directory
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Root() { return null; }'
      );
      await fs.mkdir(path.join(testDir, 'components', 'Widget'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Widget', 'index.tsx'),
        'export default function Widget() { return null; }'
      );
      const schema = {
        type: 'Widget',
        displayName: 'Widget Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'Widget', 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      // When both exist, should prefer theme-pack (components dir takes precedence)
      expect(result.inferredConfig.type).toBe('theme-pack');
    });

    it('should validate component props schema correctly', async () => {
      const packageJson = {
        name: 'props-test',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      // Schema with props
      const schema = {
        type: 'PropsComponent',
        displayName: 'Props Component',
        description: 'A component with props',
        category: 'forms',
        props: {
          title: {
            type: 'string',
            default: 'Default Title',
            required: true,
            description: 'The title text',
          },
          count: {
            type: 'number',
            default: 0,
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.components[0].schema.props.title.type).toBe('string');
      expect(result.components[0].schema.props.title.required).toBe(true);
    });

    it('should handle nested component directories in theme-pack', async () => {
      const packageJson = {
        name: 'nested-theme',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'nested-theme',
            displayName: 'Nested Theme',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Create nested component structure
      await fs.mkdir(path.join(testDir, 'components', 'forms', 'Input'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'forms', 'Input', 'index.tsx'),
        'export default function Input() { return null; }'
      );
      const schema = {
        type: 'Input',
        displayName: 'Input Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'forms', 'Input', 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('Input');
    });

    it('should validate Vue component entry points', async () => {
      const packageJson = {
        name: 'vue-theme',
        version: '1.0.0',
        dependencies: { vue: '^3.0.0' },
        oaysus: {
          theme: {
            name: 'vue-theme',
            displayName: 'Vue Theme',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      await fs.mkdir(path.join(testDir, 'components', 'VueButton'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'VueButton', 'index.vue'),
        '<template><button></button></template>'
      );
      const schema = {
        type: 'VueButton',
        displayName: 'Vue Button',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'VueButton', 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.inferredConfig.framework).toBe('vue');
    });

    it('should validate Svelte component entry points', async () => {
      const packageJson = {
        name: 'svelte-theme',
        version: '1.0.0',
        dependencies: { svelte: '^4.0.0' },
        oaysus: {
          theme: {
            name: 'svelte-theme',
            displayName: 'Svelte Theme',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      await fs.mkdir(path.join(testDir, 'components', 'SvelteButton'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'SvelteButton', 'index.svelte'),
        '<button></button>'
      );
      const schema = {
        type: 'SvelteButton',
        displayName: 'Svelte Button',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'components', 'SvelteButton', 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.inferredConfig.framework).toBe('svelte');
    });

    it('should handle all unnecessary files warnings together', async () => {
      const packageJson = {
        name: 'messy-project',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );
      await fs.writeFile(
        path.join(testDir, 'index.tsx'),
        'export default function Component() { return null; }'
      );
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      // Create all unnecessary files/directories
      await fs.mkdir(path.join(testDir, 'node_modules'), { recursive: true });
      await fs.mkdir(path.join(testDir, '.git'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'dist'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'build'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'coverage'), { recursive: true });
      await fs.writeFile(path.join(testDir, '.DS_Store'), '');

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      // Should have warnings for all unnecessary files
      expect(result.warnings.length).toBeGreaterThanOrEqual(6);
      expect(result.warnings.some(w => w.includes('node_modules'))).toBe(true);
      expect(result.warnings.some(w => w.includes('.git'))).toBe(true);
      expect(result.warnings.some(w => w.includes('dist'))).toBe(true);
      expect(result.warnings.some(w => w.includes('build'))).toBe(true);
      expect(result.warnings.some(w => w.includes('coverage'))).toBe(true);
      expect(result.warnings.some(w => w.includes('.DS_Store'))).toBe(true);
    });

    it('should handle package.json with optional oaysus config for single component', async () => {
      const packageJson = {
        name: 'optional-config',
        version: '1.0.0',
        description: 'A test component',
        author: 'Test Author',
        license: 'MIT',
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
        oaysus: {
          theme: {
            name: 'optional-config',
            displayName: 'Optional Config',
            category: 'misc',
            isPremium: false,
            tags: ['test'],
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
      const schema = {
        type: 'component',
        displayName: 'Component',
        props: {},
      };
      await fs.writeFile(
        path.join(testDir, 'schema.json'),
        JSON.stringify(schema)
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      expect(result.valid).toBe(true);
      expect(result.packageJson.description).toBe('A test component');
      expect(result.packageJson.author).toBe('Test Author');
      expect(result.packageJson.license).toBe('MIT');
    });

    it('should handle components with mixed valid and invalid schemas', async () => {
      const packageJson = {
        name: 'mixed-schemas',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        oaysus: {
          theme: {
            name: 'mixed-schemas',
            displayName: 'Mixed Schemas',
          },
        },
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      // Valid component
      await fs.mkdir(path.join(testDir, 'components', 'Valid'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Valid', 'index.tsx'),
        'export default function Valid() { return null; }'
      );
      await fs.writeFile(
        path.join(testDir, 'components', 'Valid', 'schema.json'),
        JSON.stringify({ type: 'Valid', displayName: 'Valid Component', props: {} })
      );

      // Invalid component (bad schema)
      await fs.mkdir(path.join(testDir, 'components', 'Invalid'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'components', 'Invalid', 'index.tsx'),
        'export default function Invalid() { return null; }'
      );
      await fs.writeFile(
        path.join(testDir, 'components', 'Invalid', 'schema.json'),
        JSON.stringify({ badField: 'invalid' })
      );

      const { validatePackage } = await import('../src/lib/validator.js');
      const result = await validatePackage(testDir);

      // Should have errors but still include valid components
      expect(result.errors.some(e => e.includes('Invalid schema'))).toBe(true);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('Valid');
    });
  });
});
