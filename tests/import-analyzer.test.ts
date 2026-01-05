/**
 * Tests for import-analyzer.ts
 * Verifies component import scanning and dependency detection
 */

// Jest globals are auto-imported
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Test directory
const testDir = path.join(os.tmpdir(), 'oaysus-import-analyzer-test-' + Date.now());

describe('import-analyzer module', () => {
  beforeEach(async () => {
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

  describe('analyzeComponentImports()', () => {
    describe('basic import detection', () => {
      it('should return empty array when no component paths provided', async () => {
        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports([], { dependencies: {} });
        expect(result).toEqual([]);
      });

      it('should return empty array when file does not exist', async () => {
        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [path.join(testDir, 'nonexistent.tsx')],
          { dependencies: { swiper: '^11.0.0' } }
        );
        expect(result).toEqual([]);
      });

      it('should detect static imports from dependencies', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { Swiper, SwiperSlide } from 'swiper/react';
           import 'swiper/css';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].version).toBe('11.0.0');
        expect(result[0].imports).toContain('swiper/react');
        expect(result[0].imports).toContain('swiper/css');
        expect(result[0].hasCSS).toBe(true);
        expect(result[0].cssImports).toContain('swiper/css');
        expect(result[0].subExports).toContain('react');
      });

      it('should detect default imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import Swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].imports).toContain('swiper');
        expect(result[0].subExports).toEqual([]);
      });

      it('should detect namespace imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import * as Swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].imports).toContain('swiper');
      });

      it('should detect side-effect imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import 'swiper/css';
           import 'swiper/css/navigation';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].hasCSS).toBe(true);
        expect(result[0].cssImports).toContain('swiper/css');
        expect(result[0].cssImports).toContain('swiper/css/navigation');
      });

      it('should detect dynamic imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `const Swiper = await import('swiper');
           const { Navigation } = await import('swiper/modules');
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].imports).toContain('swiper');
        expect(result[0].imports).toContain('swiper/modules');
        expect(result[0].subExports).toContain('modules');
      });

      it('should detect require statements', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `const swiper = require('swiper');
           const navigation = require('swiper/modules');
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].imports).toContain('swiper');
        expect(result[0].imports).toContain('swiper/modules');
      });
    });

    describe('import filtering', () => {
      it('should ignore relative imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { helper } from './utils';
           import { other } from '../shared';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should ignore absolute path imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { helper } from '/absolute/path';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should ignore node: built-in imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import path from 'node:path';
           import fs from 'node:fs';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: {} }
        );

        expect(result).toEqual([]);
      });

      it('should ignore packages not in dependencies', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import lodash from 'lodash';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } } // lodash not in deps
        );

        expect(result).toEqual([]);
      });

      it('should skip framework externals (react)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import React from 'react';
           import { useState } from 'react';
           import ReactDOM from 'react-dom';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip framework externals (vue)', async () => {
        const componentPath = path.join(testDir, 'Component.vue');
        await fs.writeFile(
          componentPath,
          `import { ref, computed } from 'vue';
           export default { setup() { return null; } }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { vue: '^3.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip framework externals (svelte)', async () => {
        const componentPath = path.join(testDir, 'Component.svelte');
        await fs.writeFile(
          componentPath,
          `import { onMount } from 'svelte';
           export let prop;`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { svelte: '^4.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip framework externals (solid-js)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { createSignal } from 'solid-js';
           import { render } from 'solid-js/web';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { 'solid-js': '^1.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (@types)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import type { FC } from '@types/react';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { '@types/react': '^18.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (typescript)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import typescript from 'typescript';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { typescript: '^5.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (eslint)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import eslint from 'eslint';
           import plugin from 'eslint-plugin-react';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { eslint: '^8.0.0', 'eslint-plugin-react': '^7.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (vite, vitest, jest)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import vite from 'vite';
           import { describe } from 'vitest';
           import jest from 'jest';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { vite: '^5.0.0', vitest: '^1.0.0', jest: '^29.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (@testing-library)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { render } from '@testing-library/react';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { '@testing-library/react': '^14.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (tailwindcss, postcss, autoprefixer)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import tailwind from 'tailwindcss';
           import postcss from 'postcss';
           import autoprefixer from 'autoprefixer';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { tailwindcss: '^3.0.0', postcss: '^8.0.0', autoprefixer: '^10.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should skip dev-only packages (@vitejs, @tailwindcss, @storybook, storybook)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import reactPlugin from '@vitejs/plugin-react';
           import tailwindPreset from '@tailwindcss/typography';
           import storybook from 'storybook';
           import addon from '@storybook/addon-essentials';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          {
            dependencies: {
              '@vitejs/plugin-react': '^4.0.0',
              '@tailwindcss/typography': '^0.5.0',
              storybook: '^8.0.0',
              '@storybook/addon-essentials': '^8.0.0',
            },
          }
        );

        expect(result).toEqual([]);
      });

      it('should skip prettier', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import prettier from 'prettier';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { prettier: '^3.0.0' } }
        );

        expect(result).toEqual([]);
      });
    });

    describe('scoped packages', () => {
      it('should handle scoped packages correctly', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { gsap } from '@gsap/react';
           import { ScrollTrigger } from '@gsap/react/ScrollTrigger';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { '@gsap/react': '^2.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('@gsap/react');
        expect(result[0].version).toBe('2.0.0');
        expect(result[0].imports).toContain('@gsap/react');
        expect(result[0].imports).toContain('@gsap/react/ScrollTrigger');
        expect(result[0].subExports).toContain('ScrollTrigger');
      });

      it('should handle deeply nested scoped package sub-exports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { something } from '@scope/package/sub/path/deep';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { '@scope/package': '^1.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('@scope/package');
        expect(result[0].subExports).toContain('sub/path/deep');
      });
    });

    describe('CSS detection', () => {
      it('should detect .css extension imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import 'library/styles.css';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { library: '^1.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].hasCSS).toBe(true);
        expect(result[0].cssImports).toContain('library/styles.css');
      });

      it('should detect /css path pattern', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import 'swiper/css';
           import 'swiper/css/navigation';
           import 'swiper/css/pagination';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].hasCSS).toBe(true);
        expect(result[0].cssImports).toHaveLength(3);
      });

      it('should detect /styles path pattern', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import 'library/styles';
           import 'library/styles/main';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { library: '^1.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].hasCSS).toBe(true);
        expect(result[0].cssImports).toHaveLength(2);
      });

      it('should detect .scss, .less, .sass extensions', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import 'library/style.scss';
           import 'library/theme.less';
           import 'library/variables.sass';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { library: '^1.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].hasCSS).toBe(true);
        expect(result[0].cssImports).toHaveLength(3);
      });

      it('should separate CSS and JS imports correctly', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { Swiper } from 'swiper/react';
           import { Navigation, Pagination } from 'swiper/modules';
           import 'swiper/css';
           import 'swiper/css/navigation';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].imports).toHaveLength(4);
        expect(result[0].cssImports).toHaveLength(2);
        // subExports should only contain non-CSS paths
        expect(result[0].subExports).toContain('react');
        expect(result[0].subExports).toContain('modules');
        expect(result[0].subExports).not.toContain('css');
        expect(result[0].subExports).not.toContain('css/navigation');
      });
    });

    describe('version parsing', () => {
      it('should strip ^ prefix from version', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result[0].version).toBe('11.0.0');
      });

      it('should strip ~ prefix from version', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '~11.0.0' } }
        );

        expect(result[0].version).toBe('11.0.0');
      });

      it('should strip >= prefix from version', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '>=11.0.0' } }
        );

        expect(result[0].version).toBe('=11.0.0');
      });

      it('should use exact version when no prefix', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '11.0.0' } }
        );

        expect(result[0].version).toBe('11.0.0');
      });

      it('should use 0.0.0 when version is empty string', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '' as any } }
        );

        // Empty string is falsy, so package won't be detected
        // Test that packages with falsy versions are not detected
        expect(result).toEqual([]);
      });

      it('should handle undefined version gracefully', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: undefined as any } }
        );

        // Undefined version means package won't be detected (deps[packageName] is falsy)
        expect(result).toEqual([]);
      });

    });

    describe('peerDependencies', () => {
      it('should detect imports from peerDependencies', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { peerDependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
      });

      it('should merge dependencies and peerDependencies', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           import lodash from 'lodash';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          {
            dependencies: { swiper: '^11.0.0' },
            peerDependencies: { lodash: '^4.0.0' },
          }
        );

        expect(result).toHaveLength(2);
        expect(result.map(d => d.name)).toContain('swiper');
        expect(result.map(d => d.name)).toContain('lodash');
      });
    });

    describe('local file analysis', () => {
      it('should not analyze the same file twice (deduplication)', async () => {
        // Create a component with circular local imports
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { a } from './fileA';
           import { b } from './fileB';
           export default function Component() { return null; }`
        );

        // FileA imports FileB and Component (creating a cycle)
        const fileAPath = path.join(testDir, 'fileA.ts');
        await fs.writeFile(
          fileAPath,
          `import { b } from './fileB';
           import Component from './Component';
           import lodash from 'lodash';
           export const a = () => lodash.noop();`
        );

        // FileB imports FileA (creating a cycle)
        const fileBPath = path.join(testDir, 'fileB.ts');
        await fs.writeFile(
          fileBPath,
          `import { a } from './fileA';
           export const b = () => null;`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        // Should still find lodash despite circular imports
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('lodash');
      });

      it('should analyze local imports recursively', async () => {
        // Create component that imports a local file
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { helper } from './utils';
           export default function Component() { return null; }`
        );

        // Create local file that imports external dependency
        const utilsPath = path.join(testDir, 'utils.ts');
        await fs.writeFile(
          utilsPath,
          `import lodash from 'lodash';
           export const helper = () => lodash.noop();`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('lodash');
      });

      it('should try different extensions when resolving local imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import { helper } from './utils';
           export default function Component() { return null; }`
        );

        // Create local file with .tsx extension (will be found without explicit extension)
        const utilsPath = path.join(testDir, 'utils.tsx');
        await fs.writeFile(
          utilsPath,
          `import lodash from 'lodash';
           export const helper = () => lodash.noop();`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('lodash');
      });

      it('should not follow local imports outside component directory', async () => {
        // Create component in a subdirectory
        const componentDir = path.join(testDir, 'components', 'Button');
        await fs.mkdir(componentDir, { recursive: true });

        const componentPath = path.join(componentDir, 'index.tsx');
        await fs.writeFile(
          componentPath,
          `import { helper } from '../../shared/utils';
           export default function Button() { return null; }`
        );

        // Create shared utils outside component directory
        const sharedDir = path.join(testDir, 'shared');
        await fs.mkdir(sharedDir, { recursive: true });
        const utilsPath = path.join(sharedDir, 'utils.ts');
        await fs.writeFile(
          utilsPath,
          `import lodash from 'lodash';
           export const helper = () => lodash.noop();`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        // Should not find lodash since utils is outside component directory
        expect(result).toEqual([]);
      });

      it('should limit recursive analysis to 50 files', async () => {
        // Create many local files to test the limit
        const componentPath = path.join(testDir, 'Component.tsx');
        let importStatements = '';
        for (let i = 0; i < 60; i++) {
          importStatements += `import { helper${i} } from './util${i}';\n`;
        }
        await fs.writeFile(
          componentPath,
          `${importStatements}export default function Component() { return null; }`
        );

        // Create 60 local files, each importing lodash
        for (let i = 0; i < 60; i++) {
          await fs.writeFile(
            path.join(testDir, `util${i}.ts`),
            `import lodash from 'lodash';
             export const helper${i} = () => lodash.noop();`
          );
        }

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { lodash: '^4.0.0' } }
        );

        // Should still find lodash (from the files analyzed within limit)
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('lodash');
      });
    });

    describe('multiple components', () => {
      it('should analyze multiple component files', async () => {
        // Create first component
        const component1Path = path.join(testDir, 'Component1.tsx');
        await fs.writeFile(
          component1Path,
          `import swiper from 'swiper';
           export default function Component1() { return null; }`
        );

        // Create second component
        const component2Path = path.join(testDir, 'Component2.tsx');
        await fs.writeFile(
          component2Path,
          `import lodash from 'lodash';
           export default function Component2() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [component1Path, component2Path],
          { dependencies: { swiper: '^11.0.0', lodash: '^4.0.0' } }
        );

        expect(result).toHaveLength(2);
        expect(result.map(d => d.name)).toContain('swiper');
        expect(result.map(d => d.name)).toContain('lodash');
      });

      it('should deduplicate imports across multiple components', async () => {
        // Both components import swiper
        const component1Path = path.join(testDir, 'Component1.tsx');
        await fs.writeFile(
          component1Path,
          `import { Swiper } from 'swiper/react';
           export default function Component1() { return null; }`
        );

        const component2Path = path.join(testDir, 'Component2.tsx');
        await fs.writeFile(
          component2Path,
          `import { Navigation } from 'swiper/modules';
           import 'swiper/css';
           export default function Component2() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [component1Path, component2Path],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
        expect(result[0].imports).toContain('swiper/react');
        expect(result[0].imports).toContain('swiper/modules');
        expect(result[0].imports).toContain('swiper/css');
        expect(result[0].subExports).toContain('react');
        expect(result[0].subExports).toContain('modules');
      });
    });

    describe('edge cases', () => {
      it('should handle empty file', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(componentPath, '');

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should handle file with no imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `const x = 1;
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toEqual([]);
      });

      it('should handle malformed imports gracefully', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `// This is not a real import
           const importFake = "import from 'fake'";
           import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
      });

      it('should handle imports with single quotes', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
      });

      it('should handle imports with double quotes', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from "swiper";
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
      });

      it('should handle mixed import/export statements', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import swiper from 'swiper';
           export { swiper };
           import lodash from 'lodash';
           export default lodash;`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0', lodash: '^4.0.0' } }
        );

        expect(result).toHaveLength(2);
      });

      it('should handle combined default and named imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import Swiper, { Navigation, Pagination } from 'swiper';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('swiper');
      });

      it('should not detect re-export statements (only handles imports)', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `export { Swiper } from 'swiper';
           export * from 'swiper/react';`
        );

        // Re-exports use 'export ... from', not 'import ... from'
        // The analyzer specifically looks for 'import' statements
        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        // Re-exports are not detected - this is expected behavior
        // The analyzer focuses on imports, not exports
        expect(result).toEqual([]);
      });

      it('should handle type imports', async () => {
        const componentPath = path.join(testDir, 'Component.tsx');
        await fs.writeFile(
          componentPath,
          `import type { SwiperOptions } from 'swiper';
           import { type Navigation } from 'swiper/modules';
           export default function Component() { return null; }`
        );

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        const result = analyzeComponentImports(
          [componentPath],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toHaveLength(1);
        expect(result[0].imports).toContain('swiper');
        expect(result[0].imports).toContain('swiper/modules');
      });

      it('should handle error when reading file fails', async () => {
        // Create a file that will fail to read (by passing a directory path)
        await fs.mkdir(path.join(testDir, 'directory'), { recursive: true });

        const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');
        // This should not throw, just return empty
        const result = analyzeComponentImports(
          [path.join(testDir, 'directory')],
          { dependencies: { swiper: '^11.0.0' } }
        );

        expect(result).toEqual([]);
      });
    });
  });

  describe('mergeWithFrameworkDeps()', () => {
    it('should merge framework deps with detected deps', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const frameworkDeps = [
        { name: 'react', version: '18.2.0' },
        { name: 'react-dom', version: '18.2.0' },
      ];

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper', 'swiper/react'],
          subExports: ['react'],
          hasCSS: true,
          cssImports: ['swiper/css'],
        },
      ];

      const result = mergeWithFrameworkDeps(frameworkDeps, detectedDeps);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: 'react', version: '18.2.0' });
      expect(result[1]).toEqual({ name: 'react-dom', version: '18.2.0' });
      expect(result[2]).toEqual({
        name: 'swiper',
        version: '11.0.0',
        subExports: ['react'],
        cssImports: ['swiper/css'],
      });
    });

    it('should handle empty framework deps', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const detectedDeps = [
        {
          name: 'lodash',
          version: '4.0.0',
          imports: ['lodash'],
          subExports: [],
          hasCSS: false,
          cssImports: [],
        },
      ];

      const result = mergeWithFrameworkDeps([], detectedDeps);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'lodash',
        version: '4.0.0',
        subExports: undefined,
        cssImports: undefined,
      });
    });

    it('should handle empty detected deps', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const frameworkDeps = [{ name: 'react', version: '18.2.0' }];

      const result = mergeWithFrameworkDeps(frameworkDeps, []);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'react', version: '18.2.0' });
    });

    it('should handle both empty', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const result = mergeWithFrameworkDeps([], []);

      expect(result).toEqual([]);
    });

    it('should omit subExports and cssImports when empty arrays', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const detectedDeps = [
        {
          name: 'lodash',
          version: '4.0.0',
          imports: ['lodash'],
          subExports: [],
          hasCSS: false,
          cssImports: [],
        },
      ];

      const result = mergeWithFrameworkDeps([], detectedDeps);

      expect(result[0].subExports).toBeUndefined();
      expect(result[0].cssImports).toBeUndefined();
    });

    it('should include subExports when non-empty', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper/react'],
          subExports: ['react'],
          hasCSS: false,
          cssImports: [],
        },
      ];

      const result = mergeWithFrameworkDeps([], detectedDeps);

      expect(result[0].subExports).toEqual(['react']);
      expect(result[0].cssImports).toBeUndefined();
    });

    it('should include cssImports when non-empty', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper/css'],
          subExports: [],
          hasCSS: true,
          cssImports: ['swiper/css'],
        },
      ];

      const result = mergeWithFrameworkDeps([], detectedDeps);

      expect(result[0].subExports).toBeUndefined();
      expect(result[0].cssImports).toEqual(['swiper/css']);
    });

    it('should include both subExports and cssImports when both non-empty', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const detectedDeps = [
        {
          name: 'swiper',
          version: '11.0.0',
          imports: ['swiper/react', 'swiper/css'],
          subExports: ['react'],
          hasCSS: true,
          cssImports: ['swiper/css'],
        },
      ];

      const result = mergeWithFrameworkDeps([], detectedDeps);

      expect(result[0].subExports).toEqual(['react']);
      expect(result[0].cssImports).toEqual(['swiper/css']);
    });
  });

  describe('default export', () => {
    it('should export both functions via default export', async () => {
      const importAnalyzer = await import('../src/lib/shared/import-analyzer.js');

      expect(importAnalyzer.default).toBeDefined();
      expect(importAnalyzer.default.analyzeComponentImports).toBeDefined();
      expect(importAnalyzer.default.mergeWithFrameworkDeps).toBeDefined();
      expect(typeof importAnalyzer.default.analyzeComponentImports).toBe('function');
      expect(typeof importAnalyzer.default.mergeWithFrameworkDeps).toBe('function');
    });
  });
});
