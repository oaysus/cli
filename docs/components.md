# Building Components

Components are the building blocks of Oaysus pages. Each component has two files: the code and a schema that defines editable props.

## Component Structure

```
components/
└── HeroBanner/
    ├── index.tsx      # Component code
    └── schema.json    # Prop definitions
```

## React Components

### Example Component

```tsx
// components/HeroBanner/index.tsx
interface HeroBannerProps {
  headline: string;
  subtext: string;
  buttonText: string;
  buttonLink: string;
  backgroundImage?: string;
}

export default function HeroBanner({
  headline = "Welcome",
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
        <h1 className="text-5xl font-bold mb-4">{headline}</h1>
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

### Example Schema

```json
{
  "displayName": "Hero Banner",
  "category": "marketing",
  "props": {
    "headline": {
      "type": "string",
      "label": "Headline",
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

## Vue Components

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
          <h3 class="text-xl font-semibold mb-2">{{ feature.title }}</h3>
          <p class="text-gray-600">{{ feature.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Feature {
  title: string;
  description: string;
}

defineProps<{
  heading: string;
  features: Feature[];
}>();
</script>
```

## Svelte Components

```svelte
<!-- components/Testimonials/index.svelte -->
<script lang="ts">
  export let heading = 'What Our Customers Say';
  export let testimonials: Array<{
    quote: string;
    author: string;
    role: string;
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
          <footer>
            <cite class="font-semibold not-italic">{testimonial.author}</cite>
            <p class="text-gray-500 text-sm">{testimonial.role}</p>
          </footer>
        </blockquote>
      {/each}
    </div>
  </div>
</section>
```

## Best Practices

### Use TypeScript

Define prop interfaces to catch type mismatches between your component and schema.

### Provide Defaults

Components should render something meaningful even with default props.

### Handle Missing Data

Use conditional rendering for optional props like images:

```tsx
{backgroundImage && (
  <img src={backgroundImage} alt="" />
)}
```

### Use Tailwind CSS

Oaysus supports Tailwind classes out of the box. Avoid custom CSS files that won't be loaded.

### Keep Components Focused

One component per concern. Don't build Swiss army knives with too many options.

### Use Meaningful Categories

Organize components with categories:
- `marketing` - Landing page sections
- `content` - Blog and article components
- `navigation` - Headers, menus, breadcrumbs
- `footer` - Footer sections
- `social-proof` - Testimonials, reviews
- `ecommerce` - Product displays, carts
- `forms` - Contact forms, signups
- `media` - Image galleries, videos

## Component Categories

Set the `category` field in your schema:

```json
{
  "displayName": "Testimonials",
  "category": "social-proof",
  "props": { ... }
}
```

Components are grouped by category in the page builder for easier discovery.
