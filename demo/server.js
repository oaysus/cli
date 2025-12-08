/**
 * Simple HTTP Server for Component Demo
 * Serves files with proper CORS and content-type headers
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Serve from mono root to access my-awesome-theme/
const ROOT_DIR = path.join(__dirname, '..', '..');

const PORT = 8888;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(ROOT_DIR, req.url === '/' ? '/demo/component-demo.html' : req.url);

  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${req.url}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 Server Error: ${err.code}`);
      }
    } else {
      // Set headers
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🚀 Oaysus Component Demo Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Serving from: ${ROOT_DIR}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Demo:   http://localhost:${PORT}/oaysus-cli/demo/component-demo.html`);
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});
