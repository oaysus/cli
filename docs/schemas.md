# Schema Reference

Schemas define which props are editable in the Oaysus page builder. Each prop type generates a specific form control.

## Schema Structure

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

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | Name shown in the component picker |
| `category` | string | Grouping category for organization |
| `props` | object | Map of prop definitions |

## Prop Types

### string

Single line text input.

```json
{
  "headline": {
    "type": "string",
    "label": "Headline",
    "default": "Welcome to our site"
  }
}
```

**Editor:** Text input field

---

### text

Multi-line text area.

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

**Options:**
- `min` - Minimum allowed value
- `max` - Maximum allowed value
- `step` - Increment step

**Editor:** Number input with optional slider

---

### boolean

True/false toggle.

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

---

### color

Hex color value.

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

---

### image

Image from the media library.

```json
{
  "heroImage": {
    "type": "image",
    "label": "Hero Image"
  }
}
```

**Editor:** Image picker with upload capability

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

**Editor:** Select dropdown menu

---

### array

Repeatable list of items.

```json
{
  "features": {
    "type": "array",
    "label": "Features",
    "itemSchema": {
      "title": {
        "type": "string",
        "label": "Title"
      },
      "description": {
        "type": "string",
        "label": "Description"
      },
      "icon": {
        "type": "string",
        "label": "Icon Emoji",
        "default": "⚡"
      }
    }
  }
}
```

**Editor:** Add/remove/reorder items interface

---

## Common Field Options

All prop types support these options:

| Option | Type | Description |
|--------|------|-------------|
| `label` | string | Display name in editor (defaults to prop name) |
| `default` | any | Initial value when component is added |
| `required` | boolean | Must have value before publishing |

## Complete Schema Example

```json
{
  "displayName": "Feature Section",
  "category": "marketing",
  "props": {
    "heading": {
      "type": "string",
      "label": "Section Heading",
      "default": "Our Features",
      "required": true
    },
    "subheading": {
      "type": "text",
      "label": "Subheading",
      "default": "Everything you need to succeed"
    },
    "backgroundColor": {
      "type": "color",
      "label": "Background Color",
      "default": "#F9FAFB"
    },
    "columns": {
      "type": "select",
      "label": "Column Layout",
      "default": "3",
      "options": [
        { "value": "2", "label": "2 Columns" },
        { "value": "3", "label": "3 Columns" },
        { "value": "4", "label": "4 Columns" }
      ]
    },
    "features": {
      "type": "array",
      "label": "Features",
      "itemSchema": {
        "icon": {
          "type": "string",
          "label": "Icon Emoji",
          "default": "✨"
        },
        "title": {
          "type": "string",
          "label": "Title",
          "required": true
        },
        "description": {
          "type": "text",
          "label": "Description"
        },
        "link": {
          "type": "string",
          "label": "Learn More Link"
        }
      }
    },
    "showCTA": {
      "type": "boolean",
      "label": "Show CTA Button",
      "default": true
    },
    "ctaText": {
      "type": "string",
      "label": "CTA Button Text",
      "default": "Learn More"
    },
    "ctaLink": {
      "type": "string",
      "label": "CTA Button Link",
      "default": "/features"
    }
  }
}
```

## Validation

The CLI validates schemas when you run:

```bash
oaysus theme validate
```

Common validation errors:
- Invalid JSON syntax
- Unknown prop type
- Missing required fields in schema
- Type mismatch between component props and schema
