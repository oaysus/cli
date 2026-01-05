import { jest } from '@jest/globals';
/**
 * Tests for root lib modules
 * Covers:
 * - project-generator.ts - project scaffolding
 * - template-manager.ts - template processing
 * - push.ts - push workflow
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

// Test directory base
const testDirBase = path.join(os.tmpdir(), 'oaysus-lib-root-test');
let testDir: string;

describe('template-manager module', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getTemplatesDir()', () => {
    it('should return a valid templates directory path', async () => {
      const { getTemplatesDir } = await import('../src/lib/template-manager.js');

      const templatesDir = getTemplatesDir();

      expect(templatesDir).toBeDefined();
      expect(typeof templatesDir).toBe('string');
      expect(templatesDir).toContain('templates');
    });
  });

  describe('getTemplateDir()', () => {
    it('should return React theme pack template directory', async () => {
      const { getTemplateDir } = await import('../src/lib/template-manager.js');

      const templateDir = getTemplateDir('react');

      expect(templateDir).toBeDefined();
      expect(templateDir).toContain('react-theme-pack');
    });

    it('should return Vue theme pack template directory', async () => {
      const { getTemplateDir } = await import('../src/lib/template-manager.js');

      const templateDir = getTemplateDir('vue');

      expect(templateDir).toBeDefined();
      expect(templateDir).toContain('vue-theme-pack');
    });

    it('should return Svelte theme pack template directory', async () => {
      const { getTemplateDir } = await import('../src/lib/template-manager.js');

      const templateDir = getTemplateDir('svelte');

      expect(templateDir).toBeDefined();
      expect(templateDir).toContain('svelte-theme-pack');
    });
  });

  describe('replaceVariables()', () => {
    it('should replace single variable', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = 'Hello {{NAME}}!';
      const variables = { NAME: 'World' } as any;

      const result = replaceVariables(content, variables);

      expect(result).toBe('Hello World!');
    });

    it('should replace multiple variables', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = '{{PROJECT_NAME}} - {{DESCRIPTION}} by {{AUTHOR}}';
      const variables = {
        PROJECT_NAME: 'my-project',
        DISPLAY_NAME: 'My Project',
        DESCRIPTION: 'A test project',
        AUTHOR: 'Test Author',
        FRAMEWORK: 'react' as const,
      };

      const result = replaceVariables(content, variables);

      expect(result).toBe('my-project - A test project by Test Author');
    });

    it('should replace multiple occurrences of the same variable', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = '{{PROJECT_NAME}} is named {{PROJECT_NAME}}';
      const variables = {
        PROJECT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        DESCRIPTION: '',
        AUTHOR: '',
        FRAMEWORK: 'react' as const,
      };

      const result = replaceVariables(content, variables);

      expect(result).toBe('test is named test');
    });

    it('should not replace undefined variables', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = '{{PROJECT_NAME}} - {{UNDEFINED_VAR}}';
      const variables = {
        PROJECT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        DESCRIPTION: '',
        AUTHOR: '',
        FRAMEWORK: 'react' as const,
      };

      const result = replaceVariables(content, variables);

      expect(result).toBe('test - {{UNDEFINED_VAR}}');
    });

    it('should handle empty content', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = '';
      const variables = {
        PROJECT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        DESCRIPTION: '',
        AUTHOR: '',
        FRAMEWORK: 'react' as const,
      };

      const result = replaceVariables(content, variables);

      expect(result).toBe('');
    });

    it('should handle content with no variables', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = 'No variables here';
      const variables = {
        PROJECT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        DESCRIPTION: '',
        AUTHOR: '',
        FRAMEWORK: 'react' as const,
      };

      const result = replaceVariables(content, variables);

      expect(result).toBe('No variables here');
    });

    it('should handle optional component variables', async () => {
      const { replaceVariables } = await import('../src/lib/template-manager.js');

      const content = 'Component: {{COMPONENT_NAME}}, Type: {{COMPONENT_TYPE}}, Category: {{CATEGORY}}';
      const variables = {
        PROJECT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        DESCRIPTION: '',
        AUTHOR: '',
        FRAMEWORK: 'react' as const,
        COMPONENT_NAME: 'Hero',
        COMPONENT_TYPE: 'hero',
        CATEGORY: 'marketing',
      };

      const result = replaceVariables(content, variables);

      expect(result).toBe('Component: Hero, Type: hero, Category: marketing');
    });
  });

  describe('getComponentExtension()', () => {
    it('should return .tsx for React', async () => {
      const { getComponentExtension } = await import('../src/lib/template-manager.js');

      expect(getComponentExtension('react')).toBe('.tsx');
    });

    it('should return .vue for Vue', async () => {
      const { getComponentExtension } = await import('../src/lib/template-manager.js');

      expect(getComponentExtension('vue')).toBe('.vue');
    });

    it('should return .svelte for Svelte', async () => {
      const { getComponentExtension } = await import('../src/lib/template-manager.js');

      expect(getComponentExtension('svelte')).toBe('.svelte');
    });

    it('should return .tsx as default for unknown framework', async () => {
      const { getComponentExtension } = await import('../src/lib/template-manager.js');

      // @ts-ignore - testing default behavior
      expect(getComponentExtension('unknown')).toBe('.tsx');
    });
  });

  describe('getExampleComponentType()', () => {
    it('should return react-hero for React', async () => {
      const { getExampleComponentType } = await import('../src/lib/template-manager.js');

      expect(getExampleComponentType('react')).toBe('react-hero');
    });

    it('should return vue-hero for Vue', async () => {
      const { getExampleComponentType } = await import('../src/lib/template-manager.js');

      expect(getExampleComponentType('vue')).toBe('vue-hero');
    });

    it('should return svelte-hero for Svelte', async () => {
      const { getExampleComponentType } = await import('../src/lib/template-manager.js');

      expect(getExampleComponentType('svelte')).toBe('svelte-hero');
    });
  });

  describe('processTemplate()', () => {
    it('should process template file and write to target', async () => {
      const { processTemplate } = await import('../src/lib/template-manager.js');

      // Create a template file
      const templatePath = path.join(testDir, 'template.txt.template');
      const targetPath = path.join(testDir, 'output.txt');

      await fs.writeFile(templatePath, 'Project: {{PROJECT_NAME}}\nAuthor: {{AUTHOR}}');

      const variables = {
        PROJECT_NAME: 'my-project',
        DISPLAY_NAME: 'My Project',
        DESCRIPTION: 'Test description',
        AUTHOR: 'Test Author',
        FRAMEWORK: 'react' as const,
      };

      processTemplate(templatePath, targetPath, variables);

      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toBe('Project: my-project\nAuthor: Test Author');
    });

    it('should create target directory if it does not exist', async () => {
      const { processTemplate } = await import('../src/lib/template-manager.js');

      const templatePath = path.join(testDir, 'template.txt.template');
      const targetPath = path.join(testDir, 'nested', 'dir', 'output.txt');

      await fs.writeFile(templatePath, '{{PROJECT_NAME}}');

      const variables = {
        PROJECT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        DESCRIPTION: '',
        AUTHOR: '',
        FRAMEWORK: 'react' as const,
      };

      processTemplate(templatePath, targetPath, variables);

      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toBe('test');
    });
  });
});

describe('project-generator module', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateProject()', () => {
    it('should fail if target directory already exists', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      // Create target directory
      const targetDir = path.join(testDir, 'existing-project');
      await fs.mkdir(targetDir, { recursive: true });

      const options = {
        projectName: 'existing-project',
        description: 'Test project',
        framework: 'react' as const,
        author: 'Test Author',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.filesCreated).toHaveLength(0);
    });

    it('should generate React theme pack project successfully', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      const targetDir = path.join(testDir, 'new-react-project');

      const options = {
        projectName: 'new-react-project',
        description: 'Test React project',
        framework: 'react' as const,
        author: 'Test Author',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(true);
      expect(result.projectPath).toBe(targetDir);
      expect(result.filesCreated.length).toBeGreaterThan(0);

      // Check key files exist
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('README.md');
      expect(result.filesCreated).toContain('.gitignore');
      expect(result.filesCreated).toContain('tailwind.config.js');
      expect(result.filesCreated).toContain('postcss.config.js');

      // Check component files
      expect(result.filesCreated.some(f => f.includes('components/Hero'))).toBe(true);
    });

    it('should generate React project with tsconfig.json', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      const targetDir = path.join(testDir, 'react-with-tsconfig');

      const options = {
        projectName: 'react-with-tsconfig',
        description: 'Test React project with TypeScript',
        framework: 'react' as const,
        author: 'Test Author',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('tsconfig.json');
    });

    it('should generate React project with Storybook files', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      const targetDir = path.join(testDir, 'react-with-storybook');

      const options = {
        projectName: 'react-with-storybook',
        description: 'Test React project with Storybook',
        framework: 'react' as const,
        author: 'Test Author',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('.storybook/main.ts');
      expect(result.filesCreated).toContain('.storybook/preview.ts');
      expect(result.filesCreated).toContain('.storybook/utils/schemaToArgTypes.ts');
      expect(result.filesCreated).toContain('vite.config.ts');
      expect(result.filesCreated).toContain('styles/tailwind.css');
    });

    it('should generate React project with shared files', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      const targetDir = path.join(testDir, 'react-with-shared');

      const options = {
        projectName: 'react-with-shared',
        description: 'Test React project',
        framework: 'react' as const,
        author: 'Test Author',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('shared/types.ts');
      expect(result.filesCreated).toContain('shared/utils.ts');
    });

    it('should generate preview files', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      const targetDir = path.join(testDir, 'with-preview');

      const options = {
        projectName: 'with-preview',
        description: 'Test project with preview',
        framework: 'react' as const,
        author: 'Test Author',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('preview/generate.js');
      expect(result.filesCreated).toContain('preview/server.js');
    });

    it('should handle errors gracefully and return error result', async () => {
      const { generateProject } = await import('../src/lib/project-generator.js');

      // Use invalid path that will cause error
      const targetDir = path.join('\0invalid', 'path');

      const options = {
        projectName: 'test',
        description: 'Test',
        framework: 'react' as const,
        author: 'Test',
      };

      const result = await generateProject(options, targetDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createComponent()', () => {
    it('should fail if components directory does not exist', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      const options = {
        name: 'Button',
        displayName: 'Button',
        category: 'ui',
      };

      const result = await createComponent(options, testDir, 'react');

      expect(result.success).toBe(false);
      expect(result.error).toContain('components/ directory not found');
    });

    it('should fail if component already exists', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      // Create components directory and existing component
      const componentsDir = path.join(testDir, 'components', 'Button');
      await fs.mkdir(componentsDir, { recursive: true });

      const options = {
        name: 'Button',
        displayName: 'Button',
        category: 'ui',
      };

      const result = await createComponent(options, testDir, 'react');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should create React component successfully', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      // Create components directory
      await fs.mkdir(path.join(testDir, 'components'), { recursive: true });

      const options = {
        name: 'NewComponent',
        displayName: 'New Component',
        category: 'marketing',
        description: 'A new component',
      };

      const result = await createComponent(options, testDir, 'react');

      expect(result.success).toBe(true);
      expect(result.filesCreated.length).toBeGreaterThan(0);
      expect(result.filesCreated).toContain('components/NewComponent/index.tsx');
      expect(result.filesCreated).toContain('components/NewComponent/schema.json');
      expect(result.filesCreated).toContain('components/NewComponent/NewComponent.stories.tsx');
    });

    it('should create Vue component without story file', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      // Create components directory
      await fs.mkdir(path.join(testDir, 'components'), { recursive: true });

      const options = {
        name: 'VueComponent',
        displayName: 'Vue Component',
        category: 'marketing',
      };

      const result = await createComponent(options, testDir, 'vue');

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('components/VueComponent/index.vue');
      expect(result.filesCreated).toContain('components/VueComponent/schema.json');
      // Vue should not have story files
      expect(result.filesCreated.some(f => f.includes('.stories.'))).toBe(false);
    });

    it('should create Svelte component without story file', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      // Create components directory
      await fs.mkdir(path.join(testDir, 'components'), { recursive: true });

      const options = {
        name: 'SvelteComponent',
        displayName: 'Svelte Component',
        category: 'marketing',
      };

      const result = await createComponent(options, testDir, 'svelte');

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('components/SvelteComponent/index.svelte');
      expect(result.filesCreated).toContain('components/SvelteComponent/schema.json');
      // Svelte should not have story files
      expect(result.filesCreated.some(f => f.includes('.stories.'))).toBe(false);
    });

    it('should use default description if not provided', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      // Create components directory
      await fs.mkdir(path.join(testDir, 'components'), { recursive: true });

      const options = {
        name: 'TestComp',
        displayName: 'Test Comp',
        category: 'ui',
        // description not provided
      };

      const result = await createComponent(options, testDir, 'react');

      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { createComponent } = await import('../src/lib/project-generator.js');

      // Create components directory with invalid permissions
      await fs.mkdir(path.join(testDir, 'components'), { recursive: true });

      const options = {
        name: '\0invalid',
        displayName: 'Invalid',
        category: 'ui',
      };

      const result = await createComponent(options, testDir, 'react');

      // Should handle error gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('push module', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    testDir = path.join(testDirBase, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('push() - authentication tests', () => {
    it('should fail when credentials file does not exist', async () => {
      // Remove any credentials file that might exist
      const credPath = path.join(os.homedir(), '.oaysus', 'credentials.json');
      try {
        await fs.unlink(credPath);
      } catch {
        // File might not exist
      }

      const { push } = await import('../src/lib/push.js');

      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      // Will fail at auth or validation
      expect(result.error).toBeDefined();
    });
  });

  describe('push() - validation tests', () => {
    it('should fail when project path has no package.json', async () => {
      // Just test with empty directory - will fail at auth or validation
      const { push } = await import('../src/lib/push.js');

      const result = await push({ projectPath: testDir, silent: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use default project path when not provided', async () => {
      const { push } = await import('../src/lib/push.js');

      // Call with minimal options
      const result = await push({ silent: true });

      // Should return a result (will fail but should not crash)
      expect(result.success).toBe(false);
      expect(typeof result.success).toBe('boolean');
    });

    it('should return success false with error message for invalid project', async () => {
      const { push } = await import('../src/lib/push.js');

      const result = await push({
        projectPath: '/nonexistent/path/to/project',
        silent: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('push() - logging behavior', () => {
    it('should not log when silent is true', async () => {
      const { push } = await import('../src/lib/push.js');

      await push({ projectPath: testDir, silent: true });

      // With silent=true, should not log main header
      const logCalls = (consoleLogSpy.mock.calls as any[][]).map(call => call.join(' '));
      const hasHeader = logCalls.some(log => log.includes('Oaysus Push'));
      expect(hasHeader).toBe(false);
    });

    it('should log when silent is false', async () => {
      const { push } = await import('../src/lib/push.js');

      await push({ projectPath: testDir, silent: false });

      // With silent=false, should log the header
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('push() - interface types', () => {
    it('should return PushResult with expected properties', async () => {
      const { push } = await import('../src/lib/push.js');

      const result = await push({ projectPath: testDir, silent: true });

      // Check result structure
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');

      // Error should be present when success is false
      if (!result.success) {
        expect(result).toHaveProperty('error');
      }

      // These properties are optional but should be correct type if present
      if (result.themePackId !== undefined) {
        expect(typeof result.themePackId).toBe('string');
      }
      if (result.componentCount !== undefined) {
        expect(typeof result.componentCount).toBe('number');
      }
    });

    it('should accept empty options object', async () => {
      const { push } = await import('../src/lib/push.js');

      // Call with empty object
      const result = await push({});

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should accept no arguments', async () => {
      const { push } = await import('../src/lib/push.js');

      // Call with no arguments
      const result = await push();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});

describe('Import analyzer module', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('analyzeComponentImports()', () => {
    it('should detect external dependencies from component source', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      // Create a component file with external imports
      const componentPath = path.join(testDir, 'TestComponent.tsx');
      await fs.writeFile(
        componentPath,
        `
import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

export default function TestComponent() {
  return <Swiper><SwiperSlide>Slide</SwiperSlide></Swiper>;
}
        `.trim()
      );

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          swiper: '^11.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      // React should be filtered out (framework external)
      // Swiper should be detected
      const swiperDep = result.find(d => d.name === 'swiper');
      expect(swiperDep).toBeDefined();
      expect(swiperDep?.hasCSS).toBe(true);
      expect(swiperDep?.cssImports).toContain('swiper/css');
    });

    it('should not include framework externals', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const componentPath = path.join(testDir, 'Component.tsx');
      await fs.writeFile(
        componentPath,
        `
import React from 'react';
import ReactDOM from 'react-dom';
export default function Component() { return null; }
        `.trim()
      );

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      // React and react-dom should be filtered out
      expect(result.find(d => d.name === 'react')).toBeUndefined();
      expect(result.find(d => d.name === 'react-dom')).toBeUndefined();
    });

    it('should not include dev-only packages', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const componentPath = path.join(testDir, 'Component.tsx');
      await fs.writeFile(
        componentPath,
        `
import React from 'react';
export default function Component() { return null; }
        `.trim()
      );

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/react': '^18.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      // TypeScript and @types should not be detected (dev only)
      expect(result.find(d => d.name === 'typescript')).toBeUndefined();
      expect(result.find(d => d.name === '@types/react')).toBeUndefined();
    });

    it('should detect sub-exports', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const componentPath = path.join(testDir, 'Component.tsx');
      await fs.writeFile(
        componentPath,
        `
import { Swiper } from 'swiper/react';
import { Navigation } from 'swiper/modules';
export default function Component() { return null; }
        `.trim()
      );

      const packageJson = {
        dependencies: {
          swiper: '^11.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      const swiperDep = result.find(d => d.name === 'swiper');
      expect(swiperDep).toBeDefined();
      expect(swiperDep?.subExports).toContain('react');
      expect(swiperDep?.subExports).toContain('modules');
    });

    it('should handle dynamic imports', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const componentPath = path.join(testDir, 'Component.tsx');
      await fs.writeFile(
        componentPath,
        `
const Swiper = import('swiper');
export default function Component() { return null; }
        `.trim()
      );

      const packageJson = {
        dependencies: {
          swiper: '^11.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      expect(result.find(d => d.name === 'swiper')).toBeDefined();
    });

    it('should handle require statements', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const componentPath = path.join(testDir, 'Component.js');
      await fs.writeFile(
        componentPath,
        `
const lodash = require('lodash');
module.exports = function Component() { return null; }
        `.trim()
      );

      const packageJson = {
        dependencies: {
          lodash: '^4.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      expect(result.find(d => d.name === 'lodash')).toBeDefined();
    });

    it('should return empty array for non-existent file', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const result = analyzeComponentImports(
        ['/nonexistent/path/Component.tsx'],
        { dependencies: {} }
      );

      expect(result).toEqual([]);
    });

    it('should handle file with no imports', async () => {
      const { analyzeComponentImports } = await import('../src/lib/shared/import-analyzer.js');

      const componentPath = path.join(testDir, 'Component.tsx');
      await fs.writeFile(componentPath, 'export default function Component() { return null; }');

      const packageJson = {
        dependencies: {
          react: '^18.0.0',
        },
      };

      const result = analyzeComponentImports([componentPath], packageJson);

      expect(result).toEqual([]);
    });
  });

  describe('mergeWithFrameworkDeps()', () => {
    it('should merge framework deps with detected deps', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const frameworkDeps = [
        { name: 'react', version: '18.0.0' },
        { name: 'react-dom', version: '18.0.0' },
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
      expect(result[0].name).toBe('react');
      expect(result[1].name).toBe('react-dom');
      expect(result[2].name).toBe('swiper');
      expect(result[2].subExports).toEqual(['react']);
      expect(result[2].cssImports).toEqual(['swiper/css']);
    });

    it('should handle empty detected deps', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const frameworkDeps = [{ name: 'react', version: '18.0.0' }];
      const detectedDeps: any[] = [];

      const result = mergeWithFrameworkDeps(frameworkDeps, detectedDeps);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('react');
    });

    it('should not include subExports/cssImports if empty', async () => {
      const { mergeWithFrameworkDeps } = await import('../src/lib/shared/import-analyzer.js');

      const frameworkDeps: any[] = [];
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

      const result = mergeWithFrameworkDeps(frameworkDeps, detectedDeps);

      expect(result).toHaveLength(1);
      expect(result[0].subExports).toBeUndefined();
      expect(result[0].cssImports).toBeUndefined();
    });
  });
});

describe('File utilities used by project-generator', () => {
  beforeEach(async () => {
    testDir = path.join(testDirBase, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('directoryExists()', () => {
    it('should return true for existing directory', async () => {
      const { directoryExists } = await import('../src/lib/shared/file-utils.js');

      expect(directoryExists(testDir)).toBe(true);
    });

    it('should return false for non-existent directory', async () => {
      const { directoryExists } = await import('../src/lib/shared/file-utils.js');

      expect(directoryExists(path.join(testDir, 'nonexistent'))).toBe(false);
    });

    it('should return false for file (not directory)', async () => {
      const { directoryExists } = await import('../src/lib/shared/file-utils.js');

      const filePath = path.join(testDir, 'file.txt');
      await fs.writeFile(filePath, 'content');

      expect(directoryExists(filePath)).toBe(false);
    });
  });

  describe('fileExists()', () => {
    it('should return true for existing file', async () => {
      const { fileExists } = await import('../src/lib/shared/file-utils.js');

      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'content');

      expect(fileExists(filePath)).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const { fileExists } = await import('../src/lib/shared/file-utils.js');

      expect(fileExists(path.join(testDir, 'nonexistent.txt'))).toBe(false);
    });

    it('should return false for directory (not file)', async () => {
      const { fileExists } = await import('../src/lib/shared/file-utils.js');

      expect(fileExists(testDir)).toBe(false);
    });
  });

  describe('createDirectory()', () => {
    it('should create directory recursively', async () => {
      const { createDirectory, directoryExists } = await import('../src/lib/shared/file-utils.js');

      const nestedDir = path.join(testDir, 'a', 'b', 'c');
      createDirectory(nestedDir);

      expect(directoryExists(nestedDir)).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const { createDirectory, directoryExists } = await import('../src/lib/shared/file-utils.js');

      createDirectory(testDir);

      expect(directoryExists(testDir)).toBe(true);
    });
  });

  describe('toKebabCase()', () => {
    it('should convert PascalCase to kebab-case', async () => {
      const { toKebabCase } = await import('../src/lib/shared/file-utils.js');

      expect(toKebabCase('MyComponent')).toBe('mycomponent');
    });

    it('should handle spaces', async () => {
      const { toKebabCase } = await import('../src/lib/shared/file-utils.js');

      expect(toKebabCase('My Component')).toBe('my-component');
    });

    it('should handle underscores', async () => {
      const { toKebabCase } = await import('../src/lib/shared/file-utils.js');

      expect(toKebabCase('my_component')).toBe('my-component');
    });

    it('should remove leading and trailing hyphens', async () => {
      const { toKebabCase } = await import('../src/lib/shared/file-utils.js');

      expect(toKebabCase('  my component  ')).toBe('my-component');
    });
  });

  describe('toPascalCase()', () => {
    it('should convert kebab-case to PascalCase', async () => {
      const { toPascalCase } = await import('../src/lib/shared/file-utils.js');

      expect(toPascalCase('my-component')).toBe('MyComponent');
    });

    it('should handle spaces', async () => {
      const { toPascalCase } = await import('../src/lib/shared/file-utils.js');

      expect(toPascalCase('my component')).toBe('MyComponent');
    });

    it('should handle underscores', async () => {
      const { toPascalCase } = await import('../src/lib/shared/file-utils.js');

      expect(toPascalCase('my_component')).toBe('MyComponent');
    });

    it('should capitalize single word', async () => {
      const { toPascalCase } = await import('../src/lib/shared/file-utils.js');

      expect(toPascalCase('component')).toBe('Component');
    });
  });

  describe('isValidProjectName()', () => {
    it('should accept valid project name', async () => {
      const { isValidProjectName } = await import('../src/lib/shared/file-utils.js');

      expect(isValidProjectName('my-project-123')).toBe(true);
    });

    it('should reject project name with uppercase', async () => {
      const { isValidProjectName } = await import('../src/lib/shared/file-utils.js');

      expect(isValidProjectName('MyProject')).toBe(false);
    });

    it('should reject project name with spaces', async () => {
      const { isValidProjectName } = await import('../src/lib/shared/file-utils.js');

      expect(isValidProjectName('my project')).toBe(false);
    });

    it('should reject project name with special characters', async () => {
      const { isValidProjectName } = await import('../src/lib/shared/file-utils.js');

      expect(isValidProjectName('my_project')).toBe(false);
    });

    it('should accept lowercase with hyphens and numbers', async () => {
      const { isValidProjectName } = await import('../src/lib/shared/file-utils.js');

      expect(isValidProjectName('my-project-v2')).toBe(true);
    });
  });

  describe('readFile()', () => {
    it('should read file content', async () => {
      const { readFile } = await import('../src/lib/shared/file-utils.js');

      const filePath = path.join(testDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      expect(readFile(filePath)).toBe('test content');
    });
  });

  describe('writeFile()', () => {
    it('should write content to file', async () => {
      const { writeFile } = await import('../src/lib/shared/file-utils.js');

      const filePath = path.join(testDir, 'output.txt');
      writeFile(filePath, 'new content');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('should create parent directories if needed', async () => {
      const { writeFile } = await import('../src/lib/shared/file-utils.js');

      const filePath = path.join(testDir, 'nested', 'dir', 'output.txt');
      writeFile(filePath, 'content');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });
  });

  describe('copyFile()', () => {
    it('should copy file content', async () => {
      const { copyFile } = await import('../src/lib/shared/file-utils.js');

      const sourcePath = path.join(testDir, 'source.txt');
      const destPath = path.join(testDir, 'dest.txt');

      await fs.writeFile(sourcePath, 'original content');
      copyFile(sourcePath, destPath);

      const content = await fs.readFile(destPath, 'utf-8');
      expect(content).toBe('original content');
    });
  });

  describe('getCurrentYear()', () => {
    it('should return current year', async () => {
      const { getCurrentYear } = await import('../src/lib/shared/file-utils.js');

      const year = getCurrentYear();
      expect(year).toBe(new Date().getFullYear());
    });
  });
});
