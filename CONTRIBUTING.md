# Contributing to @oaysus/cli

Thank you for your interest in contributing to the Oaysus CLI!

## Development Setup

### Prerequisites

- Node.js 20+
- [Bun](https://bun.sh) (recommended) or npm

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/oaysus/cli.git
   cd cli
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the project:
   ```bash
   bun run build
   ```

4. Link for local testing:
   ```bash
   npm link
   oaysus --version
   ```

## Development Commands

```bash
bun run build      # Compile TypeScript to dist/
bun run dev        # Watch mode for development
bun run test       # Run Jest tests
```

After building, run the CLI locally with:
```bash
node bin/oaysus.js <command>
```

## Environment Variables

For local development against non-production servers, create a `.env` file in the project root:

```env
# Authentication server (default: https://auth.oaysus.com)
NEXT_PUBLIC_OAYSUS_SSO_URL=http://localhost:3000

# Admin dashboard URL for magic link redirects (default: https://admin.oaysus.com)
NEXT_PUBLIC_OAYSUS_ADMIN_URL=http://localhost:3001

# R2 CDN URL (default: production CDN)
NEXT_PUBLIC_R2_PUBLIC_URL=http://localhost:9000

# Environment: 'prod' | 'dev' | 'local'
NEXT_PUBLIC_API_STAGE=local

# Developer namespace for local R2 paths
DEVELOPER=your-name

# Enable debug logging
DEBUG=true
```

See `.env.example` for a template.

## Architecture Overview

The CLI is built with **Ink** (React for CLIs) and TypeScript.

### Entry Flow

```
bin/oaysus.js → dist/index.js → src/cli.ts:runCli() → Ink screens
```

### Key Directories

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
│   ├── shared/               # Auth, upload, config utilities
│   ├── push.ts               # Main push orchestration
│   └── validator.ts          # Package validation
└── types/                    # TypeScript type definitions
```

### Framework-agnostic Build System

The CLI supports React, Vue, and Svelte through a plugin architecture:

- `src/lib/core/framework-registry.ts` - Dynamically loads framework implementations
- `src/lib/core/types.ts` - Defines `IBuilder`, `IBundler`, `IImportMapGenerator` interfaces
- Each framework has its own implementation in `src/lib/{react,vue,svelte}/`

## Testing

Tests are written with Jest and use ESM modules.

### Running Tests

```bash
# Run all tests
bun run test

# Run specific test file
NODE_OPTIONS='--experimental-vm-modules' bunx jest tests/config.test.ts

# Run with coverage
NODE_OPTIONS='--experimental-vm-modules' bunx jest --coverage
```

### Writing Tests

- Place tests in `tests/` directory
- Use `.test.ts` extension
- Import from `@jest/globals`

Example:
```typescript
import { jest, describe, it, expect } from '@jest/globals';

describe('myFunction', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Code Style

- Use TypeScript strict mode
- Prefer ESM imports
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `bun run test`
5. Build: `bun run build`
6. Commit with a clear message
7. Push to your fork
8. Open a Pull Request

### PR Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation if needed
- Ensure all tests pass
- Follow existing code style

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Provide system information (OS, Node.js version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
