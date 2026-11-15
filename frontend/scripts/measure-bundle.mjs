import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// Measure static imports separately from optional chunks. Font totals describe
// emitted assets, not the subset a browser downloads for the text on a page.
const root = resolve(import.meta.dirname, '../dist');
const manifest = JSON.parse(readFileSync(resolve(root, '.vite/manifest.json'), 'utf8'));
const visited = new Set();
const css = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  for (const file of chunk.css ?? []) css.add(file);
  for (const dependency of chunk.imports ?? []) visit(dependency);
}
visit('index.html');
const jsFiles = [...new Set([...visited].map((key) => manifest[key].file))]
  .filter((file) => file.endsWith('.js'))
  .sort();
const cssFiles = [...css].sort();
function measure(files) {
  return {
    files: files.length,
    bytes: files.reduce((sum, file) => sum + statSync(resolve(root, file)).size, 0),
    gzipBytes: files.reduce(
      (sum, file) => sum + gzipSync(readFileSync(resolve(root, file))).length,
      0,
    ),
  };
}
const fonts = readdirSync(resolve(root, 'assets'))
  .filter((file) => /\.woff2?$/.test(file))
  .map((file) => `assets/${file}`);
const result = {
  js: measure(jsFiles),
  css: measure(cssFiles),
  fonts: measure(fonts),
  jsFiles,
  cssFiles,
};
if (process.argv[2])
  writeFileSync(resolve(process.argv[2]), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
