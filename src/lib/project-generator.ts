/**
 * Project Generator
 * Orchestrates project scaffolding from templates
 */

import path from 'path';
import {
  Framework,
  InitOptions,
  CreateComponentOptions,
  GenerationResult,
  TemplateVariables
} from '../types/templates.js';
import {
  directoryExists,
  createDirectory,
  toPascalCase,
  toKebabCase
} from './shared/file-utils.js';
import {
  getTemplateDir,
  getTemplatesDir,
  processTemplate,
  getComponentExtension
} from './template-manager.js';

/**
 * Generate a new project from templates
 * All projects use theme pack structure (components/ directory)
 */
export async function generateProject(
  options: InitOptions,
  targetDir: string
): Promise<GenerationResult> {
  const filesCreated: string[] = [];

  try {
    // Check if directory already exists
    if (directoryExists(targetDir)) {
      return {
        success: false,
        projectPath: targetDir,
        filesCreated: [],
        error: `Directory "${targetDir}" already exists`
      };
    }

    // Create project directory
    createDirectory(targetDir);

    // Prepare template variables
    const variables: TemplateVariables = {
      PROJECT_NAME: options.projectName,
      DISPLAY_NAME: toPascalCase(options.projectName),
      DESCRIPTION: options.description,
      AUTHOR: options.author,
      FRAMEWORK: options.framework
    };

    // Get template directory (always theme pack)
    const templateDir = getTemplateDir(options.framework);

    // Generate theme pack structure
    await generateThemePack(targetDir, templateDir, variables, filesCreated);

    // Add shared files
    await generateSharedFiles(targetDir, variables, filesCreated);

    return {
      success: true,
      projectPath: targetDir,
      filesCreated
    };
  } catch (error) {
    return {
      success: false,
      projectPath: targetDir,
      filesCreated,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generate a theme pack project
 * Creates one example component by default (Hero)
 */
async function generateThemePack(
  targetDir: string,
  templateDir: string,
  variables: TemplateVariables,
  filesCreated: string[]
): Promise<void> {
  const extension = getComponentExtension(variables.FRAMEWORK);

  // Generate package.json
  const packageTemplate = path.join(templateDir, 'package.json.template');
  const packageTarget = path.join(targetDir, 'package.json');
  processTemplate(packageTemplate, packageTarget, variables);
  filesCreated.push('package.json');

  // Generate README.md
  const readmeTemplate = path.join(templateDir, 'README.md.template');
  const readmeTarget = path.join(targetDir, 'README.md');
  processTemplate(readmeTemplate, readmeTarget, variables);
  filesCreated.push('README.md');

  // Generate tsconfig.json if TypeScript
  if (variables.FRAMEWORK === 'react') {
    const tsconfigTemplate = path.join(templateDir, 'tsconfig.json.template');
    const tsconfigTarget = path.join(targetDir, 'tsconfig.json');
    processTemplate(tsconfigTemplate, tsconfigTarget, variables);
    filesCreated.push('tsconfig.json');
  }

  // Create components directory
  const componentsDir = path.join(targetDir, 'components');
  createDirectory(componentsDir);

  // Create ONE example component (Hero) by default
  const componentName = 'Hero';
  const componentDir = path.join(componentsDir, componentName);
  createDirectory(componentDir);

  // Component file
  const componentTemplate = path.join(templateDir, 'components', `example${extension}.template`);
  const componentTarget = path.join(componentDir, `index${extension}`);
  const componentVars = {
    ...variables,
    COMPONENT_NAME: componentName,
    COMPONENT_TYPE: toKebabCase(componentName),
    CATEGORY: 'marketing'
  };
  processTemplate(componentTemplate, componentTarget, componentVars);
  filesCreated.push(`components/${componentName}/index${extension}`);

  // Schema file
  const schemaTemplate = path.join(templateDir, 'components', 'example-schema.json.template');
  const schemaTarget = path.join(componentDir, 'schema.json');
  processTemplate(schemaTemplate, schemaTarget, componentVars);
  filesCreated.push(`components/${componentName}/schema.json`);

  // Story file (for React with Storybook)
  if (variables.FRAMEWORK === 'react') {
    const storyTemplate = path.join(templateDir, 'components', 'example.stories.tsx.template');
    const storyTarget = path.join(componentDir, `${componentName}.stories.tsx`);
    processTemplate(storyTemplate, storyTarget, componentVars);
    filesCreated.push(`components/${componentName}/${componentName}.stories.tsx`);
  }

  // Create shared directory
  const sharedDir = path.join(targetDir, 'shared');
  createDirectory(sharedDir);

  // Shared types file (if TypeScript)
  if (variables.FRAMEWORK === 'react') {
    const typesTemplate = path.join(templateDir, 'shared', 'types.ts.template');
    const typesTarget = path.join(sharedDir, 'types.ts');
    processTemplate(typesTemplate, typesTarget, variables);
    filesCreated.push('shared/types.ts');

    // Shared utils file
    const utilsTemplate = path.join(templateDir, 'shared', 'utils.ts.template');
    const utilsTarget = path.join(sharedDir, 'utils.ts');
    processTemplate(utilsTemplate, utilsTarget, variables);
    filesCreated.push('shared/utils.ts');
  }

  // Generate preview files
  await generatePreviewFiles(targetDir, templateDir, variables, filesCreated);

  // Generate Storybook files (for React)
  if (variables.FRAMEWORK === 'react') {
    await generateStorybookFiles(targetDir, templateDir, variables, filesCreated);
  }
}

/**
 * Generate Storybook configuration files (React only)
 */
async function generateStorybookFiles(
  targetDir: string,
  templateDir: string,
  variables: TemplateVariables,
  filesCreated: string[]
): Promise<void> {
  // Create .storybook directory
  const storybookDir = path.join(targetDir, '.storybook');
  createDirectory(storybookDir);

  // Create .storybook/utils directory
  const storybookUtilsDir = path.join(storybookDir, 'utils');
  createDirectory(storybookUtilsDir);

  // Create styles directory
  const stylesDir = path.join(targetDir, 'styles');
  createDirectory(stylesDir);

  // Generate .storybook/main.ts
  const mainTemplate = path.join(templateDir, '.storybook', 'main.ts.template');
  const mainTarget = path.join(storybookDir, 'main.ts');
  processTemplate(mainTemplate, mainTarget, variables);
  filesCreated.push('.storybook/main.ts');

  // Generate .storybook/preview.ts
  const previewTemplate = path.join(templateDir, '.storybook', 'preview.ts.template');
  const previewTarget = path.join(storybookDir, 'preview.ts');
  processTemplate(previewTemplate, previewTarget, variables);
  filesCreated.push('.storybook/preview.ts');

  // Generate .storybook/utils/schemaToArgTypes.ts
  const schemaUtilsTemplate = path.join(templateDir, '.storybook', 'utils', 'schemaToArgTypes.ts.template');
  const schemaUtilsTarget = path.join(storybookUtilsDir, 'schemaToArgTypes.ts');
  processTemplate(schemaUtilsTemplate, schemaUtilsTarget, variables);
  filesCreated.push('.storybook/utils/schemaToArgTypes.ts');

  // Generate vite.config.ts
  const viteTemplate = path.join(templateDir, 'vite.config.ts.template');
  const viteTarget = path.join(targetDir, 'vite.config.ts');
  processTemplate(viteTemplate, viteTarget, variables);
  filesCreated.push('vite.config.ts');

  // Generate styles/tailwind.css
  const tailwindCssTemplate = path.join(templateDir, 'styles', 'tailwind.css.template');
  const tailwindCssTarget = path.join(stylesDir, 'tailwind.css');
  processTemplate(tailwindCssTemplate, tailwindCssTarget, variables);
  filesCreated.push('styles/tailwind.css');
}

/**
 * Generate preview files (generate.js, server.js)
 */
async function generatePreviewFiles(
  targetDir: string,
  templateDir: string,
  variables: TemplateVariables,
  filesCreated: string[]
): Promise<void> {
  // Create preview directory
  const previewDir = path.join(targetDir, 'preview');
  createDirectory(previewDir);

  // Create preview/dist directory
  const previewDistDir = path.join(previewDir, 'dist');
  createDirectory(previewDistDir);

  // Generate generate.js
  const generateTemplate = path.join(templateDir, 'preview', 'generate.js.template');
  const generateTarget = path.join(previewDir, 'generate.js');
  processTemplate(generateTemplate, generateTarget, variables);
  filesCreated.push('preview/generate.js');

  // Generate server.js
  const serverTemplate = path.join(templateDir, 'preview', 'server.js.template');
  const serverTarget = path.join(previewDir, 'server.js');
  processTemplate(serverTemplate, serverTarget, variables);
  filesCreated.push('preview/server.js');

  // Add .gitkeep to dist/ to ensure it's tracked
  filesCreated.push('preview/dist/.gitkeep');
}

/**
 * Generate shared files (.gitignore, etc.)
 */
async function generateSharedFiles(
  targetDir: string,
  variables: TemplateVariables,
  filesCreated: string[]
): Promise<void> {
  const sharedTemplatesDir = path.join(getTemplatesDir(), 'shared');

  // .gitignore
  const gitignoreTemplate = path.join(sharedTemplatesDir, '.gitignore.template');
  const gitignoreTarget = path.join(targetDir, '.gitignore');
  processTemplate(gitignoreTemplate, gitignoreTarget, variables);
  filesCreated.push('.gitignore');

  // tailwind.config.js
  const tailwindTemplate = path.join(sharedTemplatesDir, 'tailwind.config.js.template');
  const tailwindTarget = path.join(targetDir, 'tailwind.config.js');
  processTemplate(tailwindTemplate, tailwindTarget, variables);
  filesCreated.push('tailwind.config.js');

  // postcss.config.js
  const postcssTemplate = path.join(sharedTemplatesDir, 'postcss.config.js.template');
  const postcssTarget = path.join(targetDir, 'postcss.config.js');
  processTemplate(postcssTemplate, postcssTarget, variables);
  filesCreated.push('postcss.config.js');
}

/**
 * Create a new component in an existing theme pack
 */
export async function createComponent(
  options: CreateComponentOptions,
  projectPath: string,
  framework: Framework
): Promise<GenerationResult> {
  const filesCreated: string[] = [];

  try {
    const componentsDir = path.join(projectPath, 'components');

    // Check if components directory exists
    if (!directoryExists(componentsDir)) {
      return {
        success: false,
        projectPath,
        filesCreated: [],
        error: 'Not a theme pack project (components/ directory not found)'
      };
    }

    const componentDir = path.join(componentsDir, options.name);

    // Check if component already exists
    if (directoryExists(componentDir)) {
      return {
        success: false,
        projectPath,
        filesCreated: [],
        error: `Component "${options.name}" already exists`
      };
    }

    // Create component directory
    createDirectory(componentDir);

    // Prepare variables
    const variables: TemplateVariables = {
      PROJECT_NAME: options.name,
      DISPLAY_NAME: options.displayName,
      DESCRIPTION: options.description || `${options.displayName} component`,
      AUTHOR: '',
      FRAMEWORK: framework,
      COMPONENT_NAME: options.name,
      COMPONENT_TYPE: toKebabCase(options.name),
      CATEGORY: options.category
    };

    const extension = getComponentExtension(framework);
    const templateDir = getTemplateDir(framework);

    // Component file
    const componentTemplate = path.join(templateDir, 'components', `example${extension}.template`);
    const componentTarget = path.join(componentDir, `index${extension}`);
    processTemplate(componentTemplate, componentTarget, variables);
    filesCreated.push(`components/${options.name}/index${extension}`);

    // Schema file
    const schemaTemplate = path.join(templateDir, 'components', 'example-schema.json.template');
    const schemaTarget = path.join(componentDir, 'schema.json');
    processTemplate(schemaTemplate, schemaTarget, variables);
    filesCreated.push(`components/${options.name}/schema.json`);

    // Story file (for React with Storybook)
    if (framework === 'react') {
      const storyTemplate = path.join(templateDir, 'components', 'example.stories.tsx.template');
      const storyTarget = path.join(componentDir, `${options.name}.stories.tsx`);
      processTemplate(storyTemplate, storyTarget, variables);
      filesCreated.push(`components/${options.name}/${options.name}.stories.tsx`);
    }

    return {
      success: true,
      projectPath,
      filesCreated
    };
  } catch (error) {
    return {
      success: false,
      projectPath,
      filesCreated,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
