# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
bun run build          # Compile TypeScript to dist/
bun run dev            # Watch mode for development
bun run test           # Run Jest tests
```

After building, run the CLI locally with:
```bash
node bin/oaysus.js <command>
```

## Architecture Overview

This is a CLI tool for building and uploading frontend components to Oaysus. The CLI is built with **Ink** (React for CLIs) and TypeScript.

### Entry Flow
- `bin/oaysus.js` → `dist/index.js` → `src/cli.ts:runCli()` routes commands to Ink screens

### Key Architectural Patterns

**Framework-agnostic build system**: The CLI supports React, Vue, and Svelte components through a plugin architecture:
- `src/lib/core/framework-registry.ts` - Dynamically loads framework implementations
- `src/lib/core/types.ts` - Defines `IBuilder`, `IBundler`, `IImportMapGenerator` interfaces
- Each framework has its own implementation in `src/lib/{react,vue,svelte}/`

**Push flow** (`src/lib/push.ts`):
1. Validate package structure (`src/lib/validator.ts`)
2. Analyze imports for external dependencies
3. Build client components (framework-specific builder)
4. Build server components for SSR
5. Bundle React/Vue/Svelte runtime dependencies
6. Generate import map for browser ESM loading
7. Upload to R2

**Component validation** (`src/lib/validator.ts`):
- Detects framework from `package.json` dependencies
- Detects project type: single component (root `index.tsx`) vs theme-pack (`components/` directory)
- Validates `schema.json` files using Zod schemas
- Theme packs require `oaysus.theme` metadata in `package.json`

### Directory Structure

```
src/
├── cli.ts                    # Command router
├── screens/                  # Ink screen components (one per command)
├── components/               # Reusable Ink UI components
├── lib/
│   ├── core/                 # Framework registry and interfaces
│   ├── react/                # React builder, bundler, import-map
│   ├── vue/                  # Vue implementation
│   ├── svelte/               # Svelte implementation
│   ├── shared/               # Auth, upload, zip, CDN utilities
│   ├── push.ts               # Main push orchestration
│   └── validator.ts          # Package validation
└── types/                    # TypeScript type definitions
```

### CLI Commands

- `init [name]` - Create new theme pack project
- `create` - Add component to existing project
- `validate` - Validate package structure
- `build` - Build components locally (no upload)
- `push` - Build and upload to Oaysus
- `login/logout/whoami` - Authentication

### Import Maps / ESM Architecture

Components are built as ESM modules that rely on browser import maps for dependency resolution. The generated `import-map.json` maps bare specifiers (e.g., `react`) to CDN URLs, enabling multiple components to share a single React instance without bundling React into each component.
