# Oaysus Component Demo

This demo showcases the **Import Maps + ESM** architecture for loading pre-built components without a runtime bundler.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (No Bundler!)                │
│                                                           │
│  1. Import Map injected in <head>                       │
│     Maps: "react" → https://esm.sh/react@19.1.0         │
│                                                           │
│  2. Component loaded via dynamic import()                │
│     import('../.oaysus-build/Hero/index.js')            │
│                                                           │
│  3. Component code references "react/jsx-runtime"        │
│     Import map resolves → esm.sh CDN                     │
│                                                           │
│  4. React loaded ONCE, shared by all components          │
│                                                           │
│  5. Component renders using shared React instance        │
└─────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Import Map (Browser-Native Module Resolution)

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.1.0",
    "react/jsx-runtime": "https://esm.sh/react@19.1.0/jsx-runtime"
  }
}
</script>
```

**What this does:**
- When component code has `import { jsx } from "react/jsx-runtime"`
- Browser checks import map
- Resolves to `https://esm.sh/react@19.1.0/jsx-runtime`
- Loads from CDN (cached)
- ALL components share this ONE instance

### 2. Pre-built ESM Components

Components are built with Vite to ESM format:
```javascript
// .oaysus-build/Hero/index.js
import { jsx } from "react/jsx-runtime";  // Import map resolves this
export default function Hero({ heading }) {
  return jsx("div", { children: heading });
}
```

### 3. Dynamic Loading

```javascript
// Load component at runtime
const module = await import('../.oaysus-build/Hero/index.js');
const Hero = module.default;

// Render with React
root.render(createElement(Hero, { heading: 'Hello' }));
```

## Running the Demo

### Step 1: Build a Component

```bash
cd /Users/chetanbhopal/Sites/mono/my-awesome-theme
oaysus push
```

**This creates:** `.oaysus-build/Hero/index.js` (production ESM module)

### Step 2: Start Demo Server

```bash
cd /Users/chetanbhopal/Sites/mono/oaysus-cli
node demo/server.js
```

**Output:**
```
🚀 Oaysus Component Demo Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server: http://localhost:8888
Demo:   http://localhost:8888/demo/component-demo.html

Press Ctrl+C to stop
```

### Step 3: Open Demo in Browser

Open: **http://localhost:8888/demo/component-demo.html**

### Step 4: Verify

**You should see:**
- ✅ Status panel showing load progress
- ✅ Hero component rendered with Tailwind styles
- ✅ All green checkmarks in status

**Open browser console to see:**
- Import map details
- React version
- Verification that only ONE React instance exists

## What This Proves

✅ **Import maps work** - Browser natively resolves "react" imports
✅ **Shared dependencies** - All components use ONE React instance
✅ **No bundler needed** - Components load as native ESM
✅ **Production ready** - Clean code, no dev metadata
✅ **Dynamic loading** - Components load on demand
✅ **CDN strategy** - React from esm.sh, components from R2 (or local)

## Browser Compatibility

- **Chrome/Edge 89+:** Native support ✅
- **Safari 16.4+:** Native support ✅
- **Firefox 108+:** Native support ✅
- **Coverage:** ~95% of users (2025)

For older browsers, add polyfill:
```html
<script async src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"></script>
```

## Troubleshooting

### "Failed to load module"
- Ensure demo server is running on port 8888
- Check that component was built (`.oaysus-build/Hero/index.js` exists)
- Verify file paths in console errors

### "jsxDEV is not defined"
- Component was built in development mode
- Rebuild with production mode (should be automatic now)
- Check builder.ts has `mode: 'production'`

### "React is not defined"
- Import map not loaded
- Check browser supports import maps (Chrome 89+)
- Add polyfill script

## Production Architecture

In production (dashboard), the same pattern applies:

```typescript
// 1. Backend generates import map for page
const importMap = await fetch(`/api/import-maps/${pageId}`);

// 2. Inject import map
injectImportMap(importMap);

// 3. Load components from R2
for (const comp of pageComponents) {
  const module = await import(comp.r2Url);
  renderComponent(module.default, comp.props);
}
```

**Benefits:**
- Instant component loading (pre-compiled)
- No runtime bundling overhead
- Efficient CDN caching
- Version control at component level
- Zero duplicate dependency loads

## Next Steps

1. ✅ Verify demo works locally
2. 🔄 Implement R2 upload for built files
3. 🔄 Create backend import map generator
4. 🔄 Integrate into dashboard ComponentRenderer
5. 🔄 Add SRI verification
6. 🔄 Performance testing

---

**This demo proves the architecture works before production implementation!**
