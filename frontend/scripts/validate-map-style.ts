/**
 * Validate basemap style(s) in public/map/ after editing them.
 *
 *   npm run map:validate             # all public/map/*.json
 *   npm run map:validate -- --fix    # also re-format with MapLibre's canonical key order
 *
 * Checks:
 *  1. MapLibre style-spec validation (the same rules the map uses at runtime).
 *  2. Every source keeps an attribution (license requirement for OpenFreeMap / OpenMapTiles / OSM).
 *  3. No basemap layer uses an ID prefix reserved for app overlays (see RESERVED_PREFIXES).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { format, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

const ROOT = resolve(import.meta.dirname, '..');
const STYLE_DIR = join(ROOT, 'public', 'map');

/** App overlay layers are added at runtime with these prefixes (src/components/map). */
const RESERVED_PREFIXES = ['points-', 'fires-', 'raster-', 'selection-'];

interface StyleLike {
  sources?: Record<string, { attribution?: string }>;
  layers?: { id: string }[];
}

const fix = process.argv.includes('--fix');
const files = readdirSync(STYLE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => join(STYLE_DIR, f));

let failed = false;
for (const file of files) {
  const label = relative(ROOT, file).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8');
  const problems: string[] = [];

  let style: StyleLike;
  try {
    style = JSON.parse(text) as StyleLike;
  } catch (e) {
    console.error(`✖ ${label}: invalid JSON (${(e as Error).message})`);
    failed = true;
    continue;
  }

  for (const err of validateStyleMin(style as Parameters<typeof validateStyleMin>[0])) {
    problems.push(err.message);
  }

  for (const [id, source] of Object.entries(style.sources ?? {})) {
    if (!source.attribution?.trim()) problems.push(`source "${id}" has no attribution`);
  }

  for (const layer of style.layers ?? []) {
    const prefix = RESERVED_PREFIXES.find((p) => layer.id.startsWith(p));
    if (prefix) problems.push(`layer "${layer.id}" uses reserved app prefix "${prefix}"`);
  }

  if (problems.length > 0) {
    failed = true;
    console.error(`✖ ${label}\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    continue;
  }

  if (fix) writeFileSync(file, `${format(style as Parameters<typeof format>[0], 2)}\n`);
  console.log(`✔ ${label}: valid, ${style.layers?.length ?? 0} layers${fix ? ' (formatted)' : ''}`);
}

if (files.length === 0) {
  console.error(`✖ No styles found in ${relative(ROOT, STYLE_DIR)}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
