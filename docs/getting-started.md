# Getting Started with Oaysus CLI

## Installation

Install the Oaysus CLI globally using npm:

```bash
npm install -g @oaysus/cli
```

Requires Node.js 20 or higher.

## Authentication

Before pushing components, authenticate with your Oaysus account:

```bash
oaysus login
```

This opens a magic link flow:
1. Enter your email address
2. Check your inbox for the login link
3. Click the link to complete authentication
4. Select which website to work with

Your credentials are stored locally and expire after 7 days.

## Quick Start

### Create a Theme Pack

```bash
# Create a new theme pack project
oaysus theme init my-components

# Navigate to the project
cd my-components
```

The CLI will prompt you to:
- Select a framework (React, Vue, or Svelte)
- Name your project
- Add a description

### Project Structure

After initialization, your project looks like this:

```
my-components/
├── package.json
├── components/
│   └── Hero/
│       ├── index.tsx      # Component code
│       └── schema.json    # Editable props definition
├── shared/                # Shared utilities
└── README.md
```

### Push to Oaysus

```bash
oaysus theme push
```

The CLI will:
1. Validate your component structure
2. Build and bundle your components
3. Upload to Oaysus cloud
4. Make components available in the visual editor

## Verify Your Setup

Check your authentication status:

```bash
oaysus whoami
```

This shows:
- Your email address
- Current website selected
- Token expiration time

## Next Steps

- [Theme Pack Commands](./theme-commands.md) - Full command reference
- [Component Guide](./components.md) - Building effective components
- [Schema Reference](./schemas.md) - All available prop types
