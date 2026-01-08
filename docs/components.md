# Building Components

Components are the building blocks of Oaysus pages. Each component has two files: the code and a schema that defines editable props.

## Component File Structure

Every component requires this exact structure:

```
components/
└── ComponentName/
    ├── index.tsx      # React component (or index.vue / index.svelte)
    └── schema.json    # Editable props definition
```

Both files are required. The schema.json defines what marketing teams can edit in the visual builder.

---

## React Components

### File Structure

```
components/
└── HeroBanner/
    ├── index.tsx
    └── schema.json
```

### Component File (index.tsx)

```tsx
// components/HeroBanner/index.tsx
interface HeroBannerProps {
  heading: string;
  subtext: string;
  buttonText: string;
  buttonLink: string;
  backgroundImage?: string;
}

export default function HeroBanner({
  heading = "Welcome",
  subtext = "Build something amazing",
  buttonText = "Get Started",
  buttonLink = "/",
  backgroundImage
}: HeroBannerProps) {
  return (
    <section
      className="py-24 px-6 text-white bg-cover bg-center"
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-4">{heading}</h1>
        <p className="text-xl mb-8 opacity-90">{subtext}</p>
        <a
          href={buttonLink}
          className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-medium"
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
}
```

### Schema File (schema.json)

```json
{
  "displayName": "Hero Banner",
  "category": "marketing",
  "props": {
    "heading": {
      "type": "string",
      "label": "Heading",
      "default": "Welcome"
    },
    "subtext": {
      "type": "string",
      "label": "Subtext",
      "default": "Build something amazing"
    },
    "buttonText": {
      "type": "string",
      "label": "Button Text",
      "default": "Get Started"
    },
    "buttonLink": {
      "type": "string",
      "label": "Button Link",
      "default": "/"
    },
    "backgroundImage": {
      "type": "image",
      "label": "Background Image"
    }
  }
}
```

---

## Vue Components

### File Structure

```
components/
└── MessageCard/
    ├── index.vue
    └── schema.json
```

### Component File (index.vue)

```vue
<!-- components/MessageCard/index.vue -->
<template>
  <div class="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto">
    <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ message }}</h2>
    <p class="text-gray-600 mb-6">{{ description }}</p>
    <a
      v-if="showButton"
      :href="buttonLink"
      class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
    >
      {{ buttonText }}
    </a>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
  description: string;
  showButton: boolean;
  buttonText: string;
  buttonLink: string;
}>();
</script>
```

### Schema File (schema.json)

```json
{
  "displayName": "Message Card",
  "category": "content",
  "props": {
    "message": {
      "type": "string",
      "label": "Message",
      "default": "Hello World"
    },
    "description": {
      "type": "text",
      "label": "Description",
      "default": "This is a sample message card component."
    },
    "showButton": {
      "type": "boolean",
      "label": "Show Button",
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
      "default": "/about"
    }
  }
}
```

### Vue Component with Array Props

```
components/
└── FeatureGrid/
    ├── index.vue
    └── schema.json
```

**index.vue:**

```vue
<!-- components/FeatureGrid/index.vue -->
<template>
  <section class="py-16 px-6 bg-gray-50">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">{{ heading }}</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <div
          v-for="(feature, index) in features"
          :key="index"
          class="bg-white p-6 rounded-xl shadow-sm"
        >
          <div class="text-3xl mb-4">{{ feature.icon }}</div>
          <h3 class="text-xl font-semibold mb-2">{{ feature.title }}</h3>
          <p class="text-gray-600">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Feature {
  icon: string;
  title: string;
  description: string;
}

defineProps<{
  heading: string;
  features: Feature[];
}>();
</script>
```

**schema.json:**

```json
{
  "displayName": "Feature Grid",
  "category": "marketing",
  "props": {
    "heading": {
      "type": "string",
      "label": "Section Heading",
      "default": "Our Features"
    },
    "features": {
      "type": "array",
      "label": "Features",
      "itemSchema": {
        "icon": {
          "type": "string",
          "label": "Icon Emoji",
          "default": "⚡"
        },
        "title": {
          "type": "string",
          "label": "Title",
          "default": "Feature Title"
        },
        "description": {
          "type": "text",
          "label": "Description",
          "default": "Feature description goes here."
        }
      }
    }
  }
}
```

---

## Svelte Components

### File Structure

```
components/
└── ContentBlock/
    ├── index.svelte
    └── schema.json
```

### Component File (index.svelte)

```svelte
<!-- components/ContentBlock/index.svelte -->
<script lang="ts">
  export let content: string = 'Your content here';
  export let alignment: string = 'left';
  export let textColor: string = '#000000';
  export let backgroundColor: string = '#ffffff';
</script>

<div
  class="py-12 px-6"
  style="background-color: {backgroundColor}; color: {textColor}; text-align: {alignment};"
>
  <div class="max-w-3xl mx-auto prose">
    {@html content}
  </div>
</div>
```

### Schema File (schema.json)

```json
{
  "displayName": "Content Block",
  "category": "content",
  "props": {
    "content": {
      "type": "text",
      "label": "Content",
      "default": "Your content here"
    },
    "alignment": {
      "type": "select",
      "label": "Text Alignment",
      "default": "left",
      "options": [
        { "value": "left", "label": "Left" },
        { "value": "center", "label": "Center" },
        { "value": "right", "label": "Right" }
      ]
    },
    "textColor": {
      "type": "color",
      "label": "Text Color",
      "default": "#000000"
    },
    "backgroundColor": {
      "type": "color",
      "label": "Background Color",
      "default": "#ffffff"
    }
  }
}
```

### Svelte Component with Array Props

```
components/
└── Testimonials/
    ├── index.svelte
    └── schema.json
```

**index.svelte:**

```svelte
<!-- components/Testimonials/index.svelte -->
<script lang="ts">
  export let heading: string = 'What Our Customers Say';
  export let testimonials: Array<{
    quote: string;
    author: string;
    role: string;
    avatar?: string;
  }> = [];
</script>

<section class="py-16 px-6 bg-white">
  <div class="max-w-4xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-12">{heading}</h2>
    <div class="grid md:grid-cols-2 gap-8">
      {#each testimonials as testimonial}
        <blockquote class="bg-gray-50 p-6 rounded-xl">
          <p class="text-lg text-gray-700 mb-4 italic">
            "{testimonial.quote}"
          </p>
          <footer class="flex items-center gap-3">
            {#if testimonial.avatar}
              <img
                src={testimonial.avatar}
                alt={testimonial.author}
                class="w-10 h-10 rounded-full object-cover"
              />
            {/if}
            <div>
              <cite class="font-semibold not-italic">{testimonial.author}</cite>
              <p class="text-gray-500 text-sm">{testimonial.role}</p>
            </div>
          </footer>
        </blockquote>
      {/each}
    </div>
  </div>
</section>
```

**schema.json:**

```json
{
  "displayName": "Testimonials",
  "category": "social-proof",
  "props": {
    "heading": {
      "type": "string",
      "label": "Section Heading",
      "default": "What Our Customers Say"
    },
    "testimonials": {
      "type": "array",
      "label": "Testimonials",
      "itemSchema": {
        "quote": {
          "type": "text",
          "label": "Quote",
          "default": "This product changed my life!"
        },
        "author": {
          "type": "string",
          "label": "Author Name",
          "default": "Jane Doe"
        },
        "role": {
          "type": "string",
          "label": "Role/Company",
          "default": "CEO, Example Co"
        },
        "avatar": {
          "type": "image",
          "label": "Avatar"
        }
      }
    }
  }
}
```

---

## Updating Components

To modify an existing component and push the update:

### Step 1: Edit the Component

Modify the component code (index.tsx/vue/svelte) and/or the schema.json file.

### Step 2: Add a New Schema Property

Example: Adding an `imageUrl` property to an existing component:

**Before (schema.json):**
```json
{
  "displayName": "Hero Banner",
  "props": {
    "heading": {
      "type": "string",
      "label": "Heading",
      "default": "Welcome"
    }
  }
}
```

**After (schema.json):**
```json
{
  "displayName": "Hero Banner",
  "props": {
    "heading": {
      "type": "string",
      "label": "Heading",
      "default": "Welcome"
    },
    "imageUrl": {
      "type": "string",
      "label": "Image URL",
      "default": ""
    }
  }
}
```

### Step 3: Update the Component Code

Add the new prop to your component:

```tsx
export default function HeroBanner({
  heading = "Welcome",
  imageUrl = ""  // New prop
}: HeroBannerProps) {
  return (
    <section>
      <h1>{heading}</h1>
      {imageUrl && <img src={imageUrl} alt="" />}
    </section>
  );
}
```

### Step 4: Validate and Push

```bash
# Validate your changes
oaysus theme validate

# Push the update
oaysus theme push
```

The updated component will be available in the page builder immediately.

---

## Best Practices

### Use TypeScript

Define prop interfaces to catch type mismatches between your component and schema.

### Provide Defaults

Components should render something meaningful even with default props.

### Handle Missing Data

Use conditional rendering for optional props:

```tsx
{backgroundImage && (
  <img src={backgroundImage} alt="" />
)}
```

### Use Tailwind CSS

Oaysus supports Tailwind classes out of the box. Avoid custom CSS files.

### Keep Components Focused

One component per concern. Don't build Swiss army knives.

---

## Component Categories

Set the `category` field in your schema to organize components:

| Category | Use For |
|----------|---------|
| `marketing` | Landing page sections, CTAs |
| `content` | Blog posts, articles |
| `navigation` | Headers, menus, breadcrumbs |
| `footer` | Footer sections |
| `social-proof` | Testimonials, reviews |
| `ecommerce` | Product displays, carts |
| `forms` | Contact forms, signups |
| `media` | Image galleries, videos |

```json
{
  "displayName": "Testimonials",
  "category": "social-proof",
  "props": { ... }
}
```
