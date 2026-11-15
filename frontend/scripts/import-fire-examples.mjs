import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Pass the supplied frontend_katya directory.');
const index = JSON.parse(readFileSync(join(source, 'index.json'), 'utf8'));
if (index.bundle_format !== 2) throw new Error('Expected bundle format 2.');
const entries = index.fires;
if (entries.length !== 80 || new Set(entries.map((entry) => entry.id)).size !== 80)
  throw new Error('Expected 80 unique supplied fires.');
const perimeters = [];
const destination = resolve(import.meta.dirname, '../public/data/bundle-v2');
for (const entry of entries) {
  if (!/^[a-z0-9_-]+$/.test(entry.id) || entry.dir !== `fire_${entry.id}/summer_${index.summer}`)
    throw new Error(`Invalid export path: ${entry.id}.`);
  mkdirSync(join(destination, entry.dir), { recursive: true });
  for (const file of entry.files) {
    if (!/^[a-z_.0-9]+$/.test(file)) throw new Error('Unsafe resource path.');
    copyFileSync(join(source, entry.dir, file), join(destination, entry.dir, file));
  }
  if (entry.files.includes('polygon.geojson')) {
    const polygon = JSON.parse(readFileSync(join(source, entry.dir, 'polygon.geojson'), 'utf8'));
    perimeters.push({
      ...polygon,
      id: entry.id,
      properties: { id: entry.id, year: entry.year, region: entry.region },
    });
  }
}
writeFileSync(
  join(destination, 'index.json'),
  JSON.stringify({ ...index, fires: entries }, null, 2) + '\n',
);
writeFileSync(
  join(destination, 'perimeters.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: perimeters }) + '\n',
);
copyFileSync(
  join(source, 'confidence_zones.geojson'),
  join(destination, 'confidence_zones.geojson'),
);
console.log(
  'Imported 80 fire exports and applicability zones unchanged, and generated the lightweight catalog perimeter collection.',
);
