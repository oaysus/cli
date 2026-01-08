# Schema Reference

Schemas define which props are editable in the Oaysus page builder. Each prop type generates a specific form control in the visual editor.

## Schema File Location

Every component needs a `schema.json` file alongside the component code:

```
components/
└── MyComponent/
    ├── index.tsx       # Component code
    └── schema.json     # Schema definition (required)
```

## Basic Schema Structure

```json
{
  "displayName": "Component Name",
  "category": "marketing",
  "props": {
    "propName": {
      "type": "string",
      "label": "Display Label",
      "default": "Default value",
      "required": false
    }
  }
}
```

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displayName` | string | Yes | Name shown in the component picker |
| `category` | string | No | Grouping category for organization |
| `props` | object | Yes | Map of prop definitions |

---

## Basic Prop Types

### string

Single line text input for short text values.

```json
{
  "heading": {
    "type": "string",
    "label": "Heading",
    "default": "Welcome to our site"
  }
}
```

**Editor:** Text input field

**Use for:** Titles, labels, short text, URLs, email addresses

---

### text

Multi-line text area for longer content.

```json
{
  "description": {
    "type": "text",
    "label": "Description",
    "default": "Enter a longer description here"
  }
}
```

**Editor:** Textarea with multiple lines

**Use for:** Paragraphs, descriptions, rich content blocks

---

### number

Numeric value with optional constraints.

```json
{
  "opacity": {
    "type": "number",
    "label": "Opacity",
    "default": 0.5,
    "min": 0,
    "max": 1,
    "step": 0.1
  }
}
```

**Additional Options:**
| Option | Type | Description |
|--------|------|-------------|
| `min` | number | Minimum allowed value |
| `max` | number | Maximum allowed value |
| `step` | number | Increment step |

**Editor:** Number input with optional slider

**Use for:** Quantities, percentages, dimensions, opacity values

---

### boolean

True/false toggle switch.

```json
{
  "showButton": {
    "type": "boolean",
    "label": "Show Button",
    "default": true
  }
}
```

**Editor:** Toggle switch

**Use for:** Feature toggles, visibility controls, yes/no options

---

### color

Hex color value with color picker.

```json
{
  "backgroundColor": {
    "type": "color",
    "label": "Background Color",
    "default": "#3B82F6"
  }
}
```

**Editor:** Color picker with hex input

**Use for:** Background colors, text colors, border colors, accent colors

---

### image

Image from the media library with upload capability.

```json
{
  "heroImage": {
    "type": "image",
    "label": "Hero Image"
  }
}
```

**Editor:** Image picker with upload and media library browser

**Use for:** Hero images, thumbnails, avatars, background images

---

### select

Dropdown with predefined options.

```json
{
  "alignment": {
    "type": "select",
    "label": "Text Alignment",
    "default": "center",
    "options": [
      { "value": "left", "label": "Left" },
      { "value": "center", "label": "Center" },
      { "value": "right", "label": "Right" }
    ]
  }
}
```

**Required Option:**
| Option | Type | Description |
|--------|------|-------------|
| `options` | array | Array of `{ value, label }` objects |

**Editor:** Select dropdown menu

**Use for:** Predefined choices, layout options, theme variants

---

## Complex Prop Types

### array

Repeatable list of items with structured data. This is the most powerful schema type for creating dynamic, editable lists.

**Basic Array Example:**

```json
{
  "features": {
    "type": "array",
    "label": "Features",
    "itemSchema": {
      "title": {
        "type": "string",
        "label": "Title",
        "default": "Feature Title"
      },
      "description": {
        "type": "text",
        "label": "Description",
        "default": "Feature description"
      }
    }
  }
}
```

**Editor:** Add/remove/reorder interface with form fields for each item

**Complex Array with Multiple Field Types:**

```json
{
  "testimonials": {
    "type": "array",
    "label": "Testimonials",
    "itemSchema": {
      "quote": {
        "type": "text",
        "label": "Quote",
        "required": true
      },
      "author": {
        "type": "string",
        "label": "Author Name",
        "required": true
      },
      "role": {
        "type": "string",
        "label": "Role/Company"
      },
      "avatar": {
        "type": "image",
        "label": "Avatar"
      },
      "rating": {
        "type": "number",
        "label": "Star Rating",
        "default": 5,
        "min": 1,
        "max": 5
      }
    }
  }
}
```

**Array with Nested Select:**

```json
{
  "teamMembers": {
    "type": "array",
    "label": "Team Members",
    "itemSchema": {
      "name": {
        "type": "string",
        "label": "Name"
      },
      "photo": {
        "type": "image",
        "label": "Photo"
      },
      "department": {
        "type": "select",
        "label": "Department",
        "options": [
          { "value": "engineering", "label": "Engineering" },
          { "value": "design", "label": "Design" },
          { "value": "marketing", "label": "Marketing" },
          { "value": "sales", "label": "Sales" }
        ]
      },
      "bio": {
        "type": "text",
        "label": "Bio"
      }
    }
  }
}
```

**Use for:**
- Feature lists
- Testimonials
- Team member grids
- FAQ sections
- Product cards
- Navigation links
- Pricing tiers
- Gallery images

---

## Advanced Schema Patterns

### Rich Content with Multiple Options

```json
{
  "displayName": "Content Section",
  "category": "content",
  "props": {
    "title": {
      "type": "string",
      "label": "Title",
      "default": "Section Title",
      "required": true
    },
    "content": {
      "type": "text",
      "label": "Content",
      "default": "Your content here..."
    },
    "layout": {
      "type": "select",
      "label": "Layout",
      "default": "centered",
      "options": [
        { "value": "left", "label": "Left Aligned" },
        { "value": "centered", "label": "Centered" },
        { "value": "right", "label": "Right Aligned" },
        { "value": "split", "label": "Split (Image + Text)" }
      ]
    },
    "image": {
      "type": "image",
      "label": "Featured Image"
    },
    "imagePosition": {
      "type": "select",
      "label": "Image Position",
      "default": "right",
      "options": [
        { "value": "left", "label": "Left" },
        { "value": "right", "label": "Right" }
      ]
    },
    "backgroundColor": {
      "type": "color",
      "label": "Background Color",
      "default": "#ffffff"
    },
    "textColor": {
      "type": "color",
      "label": "Text Color",
      "default": "#1f2937"
    },
    "showButton": {
      "type": "boolean",
      "label": "Show CTA Button",
      "default": true
    },
    "buttonText": {
      "type": "string",
      "label": "Button Text",
      "default": "Learn More"
    },
    "buttonLink": {
      "type": "string",
      "label": "Button Link",
      "default": "#"
    }
  }
}
```

### Structured Data for Cards

```json
{
  "displayName": "Pricing Cards",
  "category": "ecommerce",
  "props": {
    "heading": {
      "type": "string",
      "label": "Section Heading",
      "default": "Choose Your Plan"
    },
    "plans": {
      "type": "array",
      "label": "Pricing Plans",
      "itemSchema": {
        "name": {
          "type": "string",
          "label": "Plan Name",
          "default": "Pro Plan"
        },
        "price": {
          "type": "string",
          "label": "Price",
          "default": "$29/mo"
        },
        "description": {
          "type": "text",
          "label": "Description",
          "default": "Perfect for growing teams"
        },
        "features": {
          "type": "text",
          "label": "Features (one per line)",
          "default": "Feature 1\nFeature 2\nFeature 3"
        },
        "highlighted": {
          "type": "boolean",
          "label": "Highlight This Plan",
          "default": false
        },
        "buttonText": {
          "type": "string",
          "label": "Button Text",
          "default": "Get Started"
        },
        "buttonLink": {
          "type": "string",
          "label": "Button Link",
          "default": "/signup"
        }
      }
    }
  }
}
```

### Navigation Links Array

```json
{
  "displayName": "Header Navigation",
  "category": "navigation",
  "props": {
    "logo": {
      "type": "image",
      "label": "Logo"
    },
    "links": {
      "type": "array",
      "label": "Navigation Links",
      "itemSchema": {
        "text": {
          "type": "string",
          "label": "Link Text",
          "default": "Link"
        },
        "url": {
          "type": "string",
          "label": "URL",
          "default": "/"
        },
        "openInNewTab": {
          "type": "boolean",
          "label": "Open in New Tab",
          "default": false
        }
      }
    },
    "ctaText": {
      "type": "string",
      "label": "CTA Button Text",
      "default": "Get Started"
    },
    "ctaLink": {
      "type": "string",
      "label": "CTA Button Link",
      "default": "/signup"
    }
  }
}
```

---

## Common Field Options

All prop types support these options:

| Option | Type | Description |
|--------|------|-------------|
| `label` | string | Display name in editor (defaults to prop name) |
| `default` | any | Initial value when component is added |
| `required` | boolean | Must have value before publishing |

---

## Validation

The CLI validates schemas when you run:

```bash
oaysus theme validate
```

**Common validation errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| Invalid JSON syntax | Missing comma, bracket, or quote | Check JSON formatting |
| Unknown prop type | Typo in type field | Use: string, text, number, boolean, color, image, select, array |
| Missing itemSchema | Array type without itemSchema | Add itemSchema with field definitions |
| Missing options | Select type without options array | Add options array with value/label objects |
| Type mismatch | Component prop type doesn't match schema | Align TypeScript interface with schema |

---

## Schema Best Practices

1. **Always provide defaults** - Components should render without user input
2. **Use descriptive labels** - Make it clear what each field controls
3. **Group related fields** - Put related props together in the schema
4. **Use appropriate types** - Choose the right type for better UX (color picker vs text input)
5. **Mark truly required fields** - Only use `required: true` for essential fields
6. **Test the editor** - Verify your schema creates a good editing experience
