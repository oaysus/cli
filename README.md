# @oaysus/cli

Official CLI for building and uploading frontend components to Oaysus.

## Installation

### npm (recommended)

```bash
npm install -g @oaysus/cli
```

### Homebrew (macOS/Linux)

```bash
brew tap oaysus/tap
brew install oaysus
```

### Verify installation

```bash
oaysus --version
```

## Quick Start

```bash
# Authenticate with Oaysus
oaysus login

# Create a new theme pack project
oaysus init my-theme

# Navigate to project
cd my-theme

# Add a component
oaysus create

# Build and upload
oaysus push
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

The CLI supports multiple frontend frameworks:

- **React** - Full support with JSX/TSX components
- **Vue** - Single File Components (.vue)
- **Svelte** - Svelte components (.svelte)

Framework is automatically detected from your `package.json` dependencies.

## Project Structure

### Single Component

```
my-component/
├── package.json
├── index.tsx        # Main component file
└── schema.json      # Component props schema
```

### Theme Pack (Multiple Components)

```
my-theme/
├── package.json
└── components/
    ├── Button/
    │   ├── index.tsx
    │   └── schema.json
    ├── Card/
    │   ├── index.tsx
    │   └── schema.json
    └── Header/
        ├── index.tsx
        └── schema.json
```

## Configuration

### package.json

```json
{
  "name": "my-theme",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  },
  "oaysus": {
    "theme": {
      "name": "my-theme",
      "displayName": "My Theme",
      "category": "ui",
      "tags": ["react", "components"]
    }
  }
}
```

### schema.json

```json
{
  "type": "component",
  "displayName": "My Component",
  "description": "A reusable UI component",
  "props": {
    "title": {
      "type": "string",
      "default": "Hello",
      "description": "The title text"
    },
    "variant": {
      "type": "string",
      "default": "primary",
      "description": "Button variant"
    }
  }
}
```

## Requirements

- Node.js 20 or higher
- Oaysus account

## Authentication

The CLI uses device authorization flow for secure authentication:

1. Run `oaysus login`
2. A browser window opens for authentication
3. Log in with your Oaysus account
4. The CLI automatically receives your credentials

Credentials are stored securely in `~/.oaysus/credentials.json` with restricted file permissions.

## Documentation

For full documentation, visit [docs.oaysus.com](https://docs.oaysus.com)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
