# Theme Pack Commands

Theme packs are collections of reusable components that can be installed on any Oaysus website.

## oaysus theme init

Create a new theme pack project.

```bash
oaysus theme init [name]
```

### Options

| Option | Description |
|--------|-------------|
| `[name]` | Optional project name (prompted if not provided) |

### Example

```bash
oaysus theme init marketing-starter
```

### Output

```
? Select framework: React
? Project name: marketing-starter
? Description: Landing page components
? Author: Your Name
? Create project? Yes

✓ Created package.json
✓ Created components/
✓ Created shared/
✓ Added Hero component
✓ Project ready!
```

### Generated Files

- `package.json` - Project configuration with Oaysus metadata
- `components/` - Directory for your components
- `components/Hero/` - Example component with schema
- `shared/` - Directory for shared utilities

---

## oaysus theme create

Add a new component to an existing theme pack.

```bash
oaysus theme create [name] [path]
```

### Options

| Option | Description |
|--------|-------------|
| `[name]` | Component name (converted to PascalCase) |
| `[path]` | Optional path to theme pack directory |

### Example

```bash
oaysus theme create FeatureGrid
```

### Output

```
? Component name: FeatureGrid
? Description: Feature grid component
? Category: marketing
? Create component? Yes

✓ Created components/FeatureGrid/index.tsx
✓ Created components/FeatureGrid/schema.json
```

---

## oaysus theme validate

Check your theme pack for errors before pushing.

```bash
oaysus theme validate [path]
```

### Options

| Option | Description |
|--------|-------------|
| `[path]` | Optional path to theme pack directory |
| `--dry-run` | Validate without creating build artifacts |

### Example

```bash
oaysus theme validate
```

### Output

```
Validating package...
✓ package.json valid
✓ components/ directory found
✓ 3 components discovered
✓ All schemas valid

Ready to push!
```

### Common Errors

- **Missing package.json** - Run from a theme pack directory
- **Invalid schema** - Check JSON syntax in schema.json files
- **Missing component file** - Each component needs index.tsx/vue/svelte

---

## oaysus theme build

Build components locally without uploading.

```bash
oaysus theme build [path]
```

### Options

| Option | Description |
|--------|-------------|
| `[path]` | Optional path to theme pack directory |

### Example

```bash
oaysus theme build
```

### Output

```
Building components...
✓ Validated package
✓ Built client components
✓ Built server components
✓ Bundled dependencies
✓ Generated import map

Build complete → .oaysus-build/
```

### Build Output

The `.oaysus-build/` directory contains:
- Compiled client-side components
- Server-side rendered versions
- Dependency bundle
- Import map for the runtime

---

## oaysus theme push

Build and upload components to Oaysus.

```bash
oaysus theme push [path]
```

**Requires authentication.**

### Options

| Option | Description |
|--------|-------------|
| `[path]` | Optional path to theme pack directory |

### Example

```bash
oaysus theme push
```

### Output

```
Authenticating...
✓ Authenticated

Building components...
✓ Validated package
✓ Built client components
✓ Built server components
✓ Bundled dependencies
✓ Generated manifest

Uploading to Oaysus...
████████████████████ 100%

✓ Upload complete
✓ Theme Pack ID: abc123
✓ 3 components published

Install in dashboard: Content → Theme Packs
```

### After Pushing

1. Open your Oaysus dashboard
2. Go to Content → Theme Packs
3. Click Install on your theme pack
4. Components appear in the page builder

---

## oaysus theme delete

Delete a theme pack from Oaysus.

```bash
oaysus theme delete [name]
```

**Requires authentication.**

### Options

| Option | Description |
|--------|-------------|
| `[name]` | Theme pack name to delete |

### Example

```bash
oaysus theme delete my-old-theme
```

### Output

```
? Select theme pack to delete:
❯ my-old-theme (v1.2.0)
  another-theme (v2.0.0)

? Are you sure you want to delete "my-old-theme"? Yes

✓ Theme pack deleted
```

### Warning

Deleting a theme pack removes all components. Pages using these components will need to be updated.
