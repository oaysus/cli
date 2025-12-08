#!/usr/bin/env node

// CommonJS wrapper to avoid ESM loading issues
(async () => {
  await import('../dist/index.js');
})();
