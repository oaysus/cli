# AI Workflows with Oaysus CLI

The Oaysus CLI's `site pull` and `site publish` commands unlock powerful AI-assisted content workflows. By storing pages as JSON files locally, any AI assistant can read and modify them.

## The AI-Powered Workflow

```bash
# Step 1: Pull all pages from your website
oaysus site pull

# Step 2: Use AI to make bulk changes
# (See example prompts below)

# Step 3: Validate the changes
oaysus site validate

# Step 4: Review changes in git diff

# Step 5: Publish all changes
oaysus site publish
```

## Example AI Prompts

### Content Updates

**Update brand messaging across all pages:**
```
"Update all hero sections to use our new tagline: 'Build faster, ship sooner'"
```

**Change pricing information:**
```
"Change the price from $99 to $149 on all pages that mention pricing"
```

**Add calls to action:**
```
"Add a newsletter signup CTA to the footer of every page"
```

### Bulk Modifications

**Update testimonials:**
```
"Update all testimonial sections with these new customer quotes:
- 'Oaysus saved us 10 hours per week' - Jane Doe, Marketing Lead
- 'Our team loves the visual editor' - John Smith, CEO"
```

**Add new sections:**
```
"Add a FAQ section to the pricing page with these questions:
1. What payment methods do you accept?
2. Can I cancel anytime?
3. Do you offer refunds?"
```

### Translations

**Translate entire site:**
```
"Translate all page content to Spanish, keeping the same structure"
```

**Localize specific content:**
```
"Update the contact information to use our European office address on all pages"
```

### SEO Optimization

**Update meta descriptions:**
```
"Generate unique, SEO-optimized meta descriptions for each page based on their content"
```

**Add structured data:**
```
"Add FAQ schema markup to all pages that have FAQ sections"
```

## Page JSON Structure

Each page is stored as a JSON file that AI tools can easily parse and modify:

```json
{
  "title": "About Us",
  "slug": "/about",
  "description": "Learn about our company and team",
  "components": [
    {
      "type": "Hero",
      "props": {
        "headline": "Our Story",
        "subtext": "Building the future of web development",
        "buttonText": "Meet the Team",
        "buttonLink": "/team"
      }
    },
    {
      "type": "FeatureGrid",
      "props": {
        "heading": "Our Values",
        "features": [
          {
            "title": "Innovation",
            "description": "Pushing boundaries every day"
          },
          {
            "title": "Quality",
            "description": "Excellence in everything we do"
          }
        ]
      }
    }
  ]
}
```

## Component Catalog

After pulling, the `components.json` file contains all available components and their schemas. AI tools can reference this to understand what props are available:

```json
{
  "Hero": {
    "displayName": "Hero Section",
    "props": {
      "headline": { "type": "string" },
      "subtext": { "type": "string" },
      "buttonText": { "type": "string" },
      "buttonLink": { "type": "string" },
      "backgroundImage": { "type": "image" }
    }
  },
  "FeatureGrid": {
    "displayName": "Feature Grid",
    "props": {
      "heading": { "type": "string" },
      "features": { "type": "array" }
    }
  }
}
```

## Time Savings

| Task | Manual Approach | AI-Assisted |
|------|-----------------|-------------|
| Update 10 page headlines | 30+ minutes | 2 minutes |
| Add CTA to all pages | 45+ minutes | 3 minutes |
| Translate 20 pages | Days | 30 minutes |
| Update testimonials site-wide | 1 hour | 5 minutes |

## Best Practices

### 1. Pull Before Making Changes

Always start with a fresh pull to ensure you have the latest content:

```bash
oaysus site pull --force
```

### 2. Validate Before Publishing

Run validation to catch errors before they go live:

```bash
oaysus site validate
```

### 3. Use Git for Version Control

Track changes and review diffs before publishing:

```bash
git diff pages/
```

### 4. Review AI Output

Always review AI-generated changes before publishing. AI can make mistakes, especially with:
- Proper nouns and brand names
- Technical terminology
- Numerical data

### 5. Publish Incrementally

For large changes, consider publishing one page at a time:

```bash
oaysus site publish pages/home.json
oaysus site publish pages/about.json
```

## Integration with AI Coding Assistants

The site commands work seamlessly with AI coding assistants like:

- **Claude Code** - Can read, modify, and validate page JSON files
- **GitHub Copilot** - Suggests edits based on context
- **Cursor** - Full IDE integration with AI assistance

Simply open your site project in your preferred editor and let AI help with bulk content changes.
