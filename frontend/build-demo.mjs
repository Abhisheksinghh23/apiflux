// Builds the static, backend-free demo into ../docs/index.html (served by GitHub Pages).
// Usage: npm install && npm run build:demo
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/index.js'], bundle: true, minify: true, write: false,
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.REACT_APP_DEMO': '"1"' },
});
const js = out.outputFiles[0].text.replaceAll('</script', '<\\/script');
const html = readFileSync('public/index.html', 'utf8')
  .replace('<title>APIFlux - REST Client</title>', '<title>APIFlux - REST Client (demo)</title>')
  .replace('</body>', `<script>${js}</script></body>`);
mkdirSync('../docs', { recursive: true });
writeFileSync('../docs/index.html', html);
console.log('wrote ../docs/index.html', html.length, 'bytes');
