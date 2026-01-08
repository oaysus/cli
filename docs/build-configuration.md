# Build Configuration

The Oaysus CLI uses a zero-configuration build pipeline powered by Vite. For most projects, no configuration is needed. However, you can customize the build process for specific requirements.

## Default Build Pipeline

When you run `oaysus theme push` or `oaysus theme build`, the CLI:

1. **Validates** your component structure and schemas
2. **Detects** your framework from package.json dependencies
3. **Bundles** components using Vite with framework-specific plugins
4. **Optimizes** output with tree-shaking and minification
5. **Generates** an import map for the runtime

### Automatic Framework Detection

The CLI detects your framework from package.json:

| Dependency | Framework |
|------------|-----------|
| `react` | React |
| `vue` | Vue 3 |
| `svelte` | Svelte |

No configuration needed. The correct Vite plugin is automatically used.

---

## Customizing the Build

### Adding Custom Dependencies

Install any npm package to use in your components:

```bash
# Add a dependency
npm install lodash

# Add a dev dependency
npm install -D @types/lodash
```

Dependencies are automatically bundled when you push. The CLI analyzes your imports and includes only what you use.

### Using Tailwind CSS

Tailwind CSS is supported out of the box. Just use Tailwind classes in your components:

```tsx
export default function Card({ title }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}
```

The Oaysus runtime includes Tailwind, so your classes work automatically.

### Custom Tailwind Configuration

For custom Tailwind settings, create a `tailwind.config.js` in your theme pack root:

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
    },
  },
};
```

The CLI will merge your configuration with the base Tailwind config.

---

## Build Output

### Understanding the Build Output

After running `oaysus theme build`, the `.oaysus-build/` directory contains:

```
.oaysus-build/
├── components/
│   ├── Hero/
│   │   ├── client.js      # Client-side component
│   │   └── server.js      # Server-side renderer
│   └── FeatureGrid/
│       ├── client.js
│       └── server.js
├── shared/
│   └── chunk-abc123.js    # Shared dependencies
├── import-map.json        # Module resolution map
└── manifest.json          # Component metadata
```

### Inspecting Build Size

The CLI reports bundle size after building:

```
Building components...
✓ Built 3 components
✓ Total size: 24.5 KB (gzip: 8.2 KB)
```

To see detailed size breakdown, use the `--verbose` flag:

```bash
oaysus theme build --verbose
```

---

## Advanced Configuration

### Environment Variables

Use environment variables in your components:

```tsx
const API_URL = import.meta.env.VITE_API_URL || 'https://api.example.com';

export default function ApiComponent() {
  // Use API_URL
}
```

Set variables in a `.env` file:

```
VITE_API_URL=https://api.example.com
VITE_FEATURE_FLAG=true
```

Note: Only variables prefixed with `VITE_` are exposed to components.

### TypeScript Configuration

For TypeScript projects, the CLI uses your `tsconfig.json` if present:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["components/**/*", "shared/**/*"]
}
```

### Path Aliases

Configure path aliases in tsconfig.json:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["components/*"],
      "@shared/*": ["shared/*"]
    }
  }
}
```

Use in your components:

```tsx
import { formatDate } from '@shared/utils';
import Button from '@components/Button';
```

---

## Shared Code

### The shared/ Directory

Place reusable utilities, hooks, and helpers in the `shared/` directory:

```
my-theme/
├── components/
│   └── Hero/
├── shared/
│   ├── utils.ts
│   ├── hooks/
│   │   └── useAnimation.ts
│   └── styles/
│       └── variables.ts
└── package.json
```

### Example Shared Utility

```ts
// shared/utils.ts
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}
```

### Using Shared Code

```tsx
// components/PriceTag/index.tsx
import { formatPrice } from '../../shared/utils';

export default function PriceTag({ cents }) {
  return <span className="font-bold">{formatPrice(cents)}</span>;
}
```

---

## Troubleshooting Build Issues

### Common Build Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot resolve module" | Missing dependency | Run `npm install <package>` |
| "Unexpected token" | Syntax error in component | Check component code for typos |
| "Invalid schema" | Malformed schema.json | Validate JSON syntax |
| "Framework not detected" | Missing framework dependency | Add react/vue/svelte to package.json |

### Build Debugging

Enable verbose logging:

```bash
DEBUG=oaysus:* oaysus theme build
```

This shows detailed build steps and timing information.

### Clearing Build Cache

If you encounter stale build issues:

```bash
# Remove build output
rm -rf .oaysus-build

# Rebuild
oaysus theme build
```

---

## Build Limitations

### What Cannot Be Customized

The Oaysus CLI intentionally limits certain customizations to ensure components work reliably in the visual editor:

1. **Output format** - Always ESM modules
2. **Target browsers** - Modern browsers only (ES2020+)
3. **CSS extraction** - Tailwind classes only, no custom CSS files
4. **Runtime dependencies** - React/Vue/Svelte provided by Oaysus runtime

### Why Zero-Configuration?

The zero-configuration approach ensures:

- **Consistency** - All components work together reliably
- **Performance** - Optimized builds without manual tuning
- **Simplicity** - Focus on building components, not tooling
- **Compatibility** - Components work in the visual editor and published sites

For advanced use cases requiring full build control, consider building a custom integration using the Oaysus API directly.

---

## Performance Tips

### Optimize Bundle Size

1. **Use tree-shakeable imports**
   ```tsx
   // Good - only imports what's used
   import { format } from 'date-fns';

   // Bad - imports entire library
   import * as dateFns from 'date-fns';
   ```

2. **Lazy load heavy dependencies**
   ```tsx
   const Chart = lazy(() => import('./Chart'));
   ```

3. **Avoid large dependencies** in components that don't need them

### Optimize Runtime Performance

1. **Memoize expensive computations**
2. **Use appropriate image formats** (WebP, AVIF)
3. **Minimize re-renders** with proper React/Vue/Svelte patterns
