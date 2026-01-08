# Site Commands

Site commands manage website pages and content locally. This enables version control, bulk editing, and AI-assisted workflows.

## oaysus site init

Create a new website project for local page management.

```bash
oaysus site init [name]
```

### Options

| Option | Description |
|--------|-------------|
| `[name]` | Optional project name |

### Example

```bash
oaysus site init my-marketing-site
```

### Output

```
? Project name: my-marketing-site
? Create project? Yes

✓ Created oaysus.config.json
✓ Created pages/
✓ Created assets/
✓ Project ready!

Run "oaysus site pull" to download existing pages.
```

### Generated Structure

```
my-marketing-site/
├── pages/              # Page JSON files
├── assets/             # Local images and files
├── components.json     # Installed component catalog
└── oaysus.config.json  # Project configuration
```

---

## oaysus site validate

Validate pages against installed components.

```bash
oaysus site validate [path]
```

### Options

| Option | Description |
|--------|-------------|
| `[path]` | Optional path to site project |

### Example

```bash
oaysus site validate
```

### Output

```
Validating site...
✓ oaysus.config.json valid
✓ Found 5 pages
✓ All component references valid
✓ All prop types valid
✓ No broken asset references

Site ready to publish!
```

### Common Errors

- **Component not found** - Component referenced in page doesn't exist
- **Invalid prop type** - Prop value doesn't match schema type
- **Missing asset** - Referenced image not in assets folder

---

## oaysus site publish

Publish pages from local files to your website.

```bash
oaysus site publish [file?]
```

**Requires authentication.**

### Options

| Option | Description |
|--------|-------------|
| `[file]` | Optional specific page file to publish |
| `--dry-run` | Preview changes without publishing |
| `--yes, -y` | Skip confirmation prompts |

### Example - Publish All Pages

```bash
oaysus site publish
```

### Output

```
Publishing pages...

Syncing component catalog...
✓ 12 components available

Publishing 5 pages...
  ✓ pages/home.json → /
  ✓ pages/about.json → /about
  ✓ pages/pricing.json → /pricing
  ✓ pages/contact.json → /contact
  ✓ pages/blog/index.json → /blog

Uploading 3 new assets...
████████████████████ 100%

✓ 5 pages published
✓ 3 assets uploaded
```

### Example - Publish Single Page

```bash
oaysus site publish pages/pricing.json
```

---

## oaysus site pull

Download pages from server to local files.

```bash
oaysus site pull
```

**Requires authentication.**

### Options

| Option | Description |
|--------|-------------|
| `--force, -f` | Overwrite local files without prompting |
| `--dry-run` | Preview what would be downloaded |

### Example

```bash
oaysus site pull
```

### Output

```
Pulling pages from server...

Syncing component catalog...
✓ 12 components in catalog

Downloading pages...
  ✓ / → pages/home.json
  ✓ /about → pages/about.json
  ✓ /pricing → pages/pricing.json
  ✓ /contact → pages/contact.json
  ✓ /blog → pages/blog/index.json

Downloading assets...
████████████████████ 100%

✓ 5 pages downloaded
✓ 15 assets synced
```

### Why Pull?

After pulling, you have complete page configurations locally:

1. **Version Control** - Track changes in git
2. **Bulk Editing** - Edit multiple pages at once
3. **AI Assistance** - Let AI tools modify content
4. **Code Review** - Review changes in pull requests

---

## Page JSON Structure

Each page is stored as a JSON file:

```json
{
  "title": "About Us",
  "slug": "/about",
  "description": "Learn about our company",
  "components": [
    {
      "type": "Hero",
      "props": {
        "headline": "Our Story",
        "subtext": "Building the future of web development"
      }
    },
    {
      "type": "FeatureGrid",
      "props": {
        "features": [
          {
            "title": "Innovation",
            "description": "Pushing boundaries"
          }
        ]
      }
    }
  ]
}
```

### Fields

| Field | Description |
|-------|-------------|
| `title` | Page title (browser tab, SEO) |
| `slug` | URL path |
| `description` | Meta description |
| `components` | Array of component instances |

---

## Workflow Example

### The AI-Powered Content Workflow

```bash
# 1. Pull all pages locally
oaysus site pull

# 2. Use AI to make bulk changes
# "Update all hero sections with new brand messaging"
# "Add a newsletter CTA to every page"
# "Translate all content to Spanish"

# 3. Validate changes
oaysus site validate

# 4. Review in git diff

# 5. Publish all changes
oaysus site publish
```

This workflow transforms hours of manual editing into minutes of AI-assisted changes.
