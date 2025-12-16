# @oaysus/cli

[![npm version](https://img.shields.io/npm/v/@oaysus/cli.svg)](https://www.npmjs.com/package/@oaysus/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Build components in React, Vue, or Svelte. Push with one command. Let your team create pages visually.**

Stop building every landing page from scratch. Oaysus lets developers create reusable components that marketing teams can assemble into pages without writing code or waiting for deployments.

## What is Oaysus?

[Oaysus](https://oaysus.com) is a visual page builder for developer-built components. You write components in your favorite framework, define what's editable via a simple schema, and push them to Oaysus. Your marketing team then uses a drag-and-drop editor to create pages instantly.

**The workflow:**
```
Developer builds component → Pushes to Oaysus → Marketing creates pages visually
```

No more "can you update the hero text?" tickets. No more waiting for deploys to change copy. Your team ships faster, and you get back to building features.

## Installation

```bash
npm install -g @oaysus/cli
```

Requires Node.js 20 or higher.

## Quick Start

```bash
# 1. Authenticate with your Oaysus account
oaysus login

# 2. Create a new theme pack project
oaysus init my-components

# 3. Navigate to the project
cd my-components

# 4. Push your components to Oaysus
oaysus push
```

That's it. Your components are now available in the visual page builder.

```
✓ Validated 1 component
✓ Built and bundled (2.1 KB)
✓ Uploaded to Oaysus
✓ Published!

Install in dashboard: Content → Theme Packs
```

## Commands

| Command | Description |
|---------|-------------|
| `oaysus init [name]` | Create a new theme pack project |
| `oaysus create` | Add a component to your project |
| `oaysus validate` | Validate package structure |
| `oaysus build` | Build components locally (no upload) |
| `oaysus push` | Build and upload to Oaysus |
| `oaysus login` | Authenticate with Oaysus |
| `oaysus logout` | Clear authentication |
| `oaysus whoami` | Display current user |

## Framework Support

Build with the tools you already know:

- **React** — JSX/TSX components with full hooks support
- **Vue** — Single File Components (.vue)
- **Svelte** — Native Svelte components (.svelte)

Framework is automatically detected from your `package.json` dependencies.

## How Components Work

Each component has two files: the code and a schema that defines what's editable.

**Component (React example):**
```tsx
export default function AnnouncementBar({ message, backgroundColor }) {
  return (
    <div style={{ backgroundColor }} className="py-3 px-4 text-center text-white">
      {message}
    </div>
  );
}
```

**Schema:**
```json
{
  "displayName": "Announcement Bar",
  "props": {
    "message": {
      "type": "string",
      "default": "Free shipping on orders over $50"
    },
    "backgroundColor": {
      "type": "color",
      "default": "#2563eb"
    }
  }
}
```

Marketing edits `message` and `backgroundColor` in the visual editor. You never touch the code again.

## Project Structure

```
my-components/
├── package.json
└── components/
    ├── AnnouncementBar/
    │   ├── index.tsx
    │   └── schema.json
    ├── Hero/
    │   ├── index.tsx
    │   └── schema.json
    └── FeatureGrid/
        ├── index.tsx
        └── schema.json
```

## Documentation

- **[Quick Start Guide](https://oaysus.com/docs/quickstart)** — Build your first component in 5 minutes
- **[CLI Reference](https://oaysus.com/docs/cli)** — Complete command documentation
- **[Component Guide](https://oaysus.com/docs/components)** — Props, schemas, and best practices
- **[Theme Packs](https://oaysus.com/docs/theme-packs)** — Organize and distribute component collections

## Why Oaysus?

| Traditional Approach | With Oaysus |
|---------------------|-------------|
| Marketing files a ticket for every page change | Marketing creates pages themselves |
| Developers build one-off landing pages | Developers build reusable components |
| Every text change requires a deploy | Changes publish instantly |
| Locked into proprietary CMS themes | Standard React/Vue/Svelte you own |

## Get Started

1. **[Create an account](https://oaysus.com/pricing)** — Free tier available
2. **Install the CLI** — `npm install -g @oaysus/cli`
3. **Follow the quick start** — [oaysus.com/docs/quickstart](https://oaysus.com/docs/quickstart)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

## License

MIT
