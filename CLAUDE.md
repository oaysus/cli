# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
bun install            # Install dependencies
bun run build          # Compile TypeScript to dist/
bun run dev            # Watch mode for development
bun run test           # Run Jest tests

# Run specific test file
NODE_OPTIONS='--experimental-vm-modules' bunx jest tests/config.test.ts
```

After building, run the CLI locally with:
```bash
node bin/oaysus.js <command>
```

## Local Development Environment

Create `.env.local` in the project root to override production defaults:
```bash
NEXT_PUBLIC_OAYSUS_SSO_URL=http://localhost:3003
NEXT_PUBLIC_OAYSUS_ADMIN_URL=http://local-admin.oaysus.com
NEXT_PUBLIC_API_STAGE=local
DEVELOPER=yourname   # Required for local R2 path: local/{developer}/{websiteId}/...
```

Without `.env.local`, the CLI uses production URLs. Credentials are stored separately:
- Production: `~/.oaysus/credentials.json`
- Local dev: `~/.oaysus-local/credentials.json`

## Architecture Overview

This is a CLI tool for building and uploading frontend components to Oaysus. Built with **Ink** (React for CLIs) and TypeScript.

### Entry Flow
- `bin/oaysus.js` → `dist/index.js` → `src/cli.ts:runCli()` routes commands to Ink screens
- Interactive mode (no command): renders `App` component with slash command interface
- Direct command mode: renders specific screen component

### Framework-agnostic Build System

The CLI supports React, Vue, and Svelte components through a plugin architecture:
- `src/lib/core/framework-registry.ts` - Dynamically loads framework implementations
- `src/lib/core/types.ts` - Defines `IBuilder`, `IBundler`, `IImportMapGenerator` interfaces
- Each framework has its own implementation in `src/lib/{react,vue,svelte}/`

### Push Flow (`src/lib/push.ts`)

1. Validate package structure (`src/lib/validator.ts`)
2. Analyze imports for external dependencies
3. Build client components (framework-specific builder)
4. Build server components for SSR
5. Bundle React/Vue/Svelte runtime dependencies
6. Generate import map for browser ESM loading
7. Upload to R2 via streaming endpoint

### Component Validation (`src/lib/validator.ts`)

- Detects framework from `package.json` dependencies
- Detects project type: single component (root `index.tsx`) vs theme-pack (`components/` directory)
- Validates `schema.json` files using Zod schemas
- Theme packs require `oaysus.theme` metadata in `package.json`

### R2 Path Structure

Files are uploaded to environment-specific paths:
- Local: `local/{developer}/{websiteId}/{themeName}/{version}/`
- Dev: `dev/{websiteId}/{themeName}/{version}/`
- Prod: `prod/{websiteId}/{themeName}/{version}/`

## Directory Structure

```
src/
├── cli.ts                    # Command router (direct CLI commands)
├── screens/                  # Ink screen components (one per command)
├── components/
│   ├── App.tsx               # Interactive mode main component
│   ├── SlashCommands.tsx     # Slash command autocomplete UI
│   └── ...                   # Reusable Ink UI components
├── lib/
│   ├── core/                 # Framework registry and interfaces
│   ├── react/                # React builder, bundler, import-map
│   ├── vue/                  # Vue implementation
│   ├── svelte/               # Svelte implementation
│   ├── shared/
│   │   ├── auth.ts           # Authentication (magic link, device flow)
│   │   ├── config.ts         # Environment configuration
│   │   ├── commands.ts       # Command registry for interactive menu
│   │   ├── uploader.ts       # R2 upload with streaming progress
│   │   └── path-builder.ts   # R2 path construction
│   ├── push.ts               # Main push orchestration
│   └── validator.ts          # Package validation
├── commands/                 # Non-Ink command implementations
│   ├── delete.ts             # Theme pack deletion
│   └── switch.ts             # Website switching
└── types/                    # TypeScript type definitions
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init [name]` | Create new theme pack project |
| `create` | Add component to existing project |
| `validate` | Validate package structure |
| `build` | Build components locally (no upload) |
| `push` | Build and upload to Oaysus |
| `delete [name]` | Delete a theme pack from Oaysus |
| `switch` | Switch between websites |
| `login/logout/whoami` | Authentication |

**Adding new commands:**
1. Add to `src/lib/shared/commands.ts` (for interactive menu)
2. Add case in `src/cli.ts` switch statement (for direct CLI)
3. Create screen in `src/screens/` or command in `src/commands/`

## Import Maps / ESM Architecture

Components are built as ESM modules that rely on browser import maps for dependency resolution. The generated `import-map.json` maps bare specifiers (e.g., `react`) to CDN URLs, enabling multiple components to share a single React instance without bundling React into each component.

## Writing Guidelines

When writing copy, documentation, or user-facing text:
- **Never use dashes or emdashes** in sentences. Rewrite to avoid them entirely.
- Use periods to separate thoughts, or restructure sentences.

## Authentication Flow

Uses device authorization flow with magic links:
1. `initializeDevice()` - Get device code from SSO
2. `requestMagicLink(email, deviceCode)` - Send email with embedded device code
3. `pollForAuth(deviceCode)` - Poll until user clicks link and approves
4. Returns JWT + website selection, then credentials are saved locally
