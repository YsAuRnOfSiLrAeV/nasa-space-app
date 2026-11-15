/**
 * Build the land mask for the Earth Intelligence dotted globe.
 *
 * Input:  data/reference/ne_110m_land.geojson
 *         Natural Earth 1:110m land, v5.1.2 (public domain, naturalearthdata.com),
 *         from github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson
 * Output: public/data/land-dots.json, Fibonacci-lattice dots that fall on land.
 *
 * Usage:
 *   npm run data:globe            # write the output
 *   npm run data:globe -- --check # fail if the output is stale; writes nothing
 *
 * Deterministic: the same input always produces byte-identical output.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fibonacciSphere, inRings } from '../src/domain/globe/sphere';

const ROOT = resolve(import.meta.dirname, '..');
const INPUT = resolve(ROOT, 'data/reference/ne_110m_land.geojson');
const OUTPUT = resolve(ROOT, 'public/data/land-dots.json');
/** Lattice size: ~1.9° spacing, enough to read continents at the sizes we draw. */
const LATTICE = 11000;

interface Geometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

const raw = readFileSync(INPUT);
/** Recorded in the output so `--check` proves which source file it was built from. */
const sourceSha256 = createHash('sha256').update(raw).digest('hex');
const geo = JSON.parse(raw.toString('utf8')) as {
  features: { geometry: Geometry }[];
};

/** Each polygon's rings plus its bounding box, for a cheap reject before the ring test. */
const polygons = geo.features.flatMap(({ geometry: g }) => {
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][];
  return polys.map((rings) => {
    const outer = rings[0]!;
    const lons = outer.map((c) => c[0]!);
    const lats = outer.map((c) => c[1]!);
    return {
      rings,
      bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
    };
  });
});

const flat: number[] = [];
for (const [lon, lat] of fibonacciSphere(LATTICE)) {
  const onLand = polygons.some(
    ({ rings, bbox }) =>
      lon >= bbox[0]! &&
      lon <= bbox[2]! &&
      lat >= bbox[1]! &&
      lat <= bbox[3]! &&
      inRings(lon, lat, rings),
  );
  if (onLand) flat.push(Math.round(lon * 100) / 100, Math.round(lat * 100) / 100);
}

const out =
  JSON.stringify({
    source: 'Natural Earth 1:110m land v5.1.2 (public domain)',
    source_file: 'data/reference/ne_110m_land.geojson',
    source_sha256: sourceSha256,
    lattice: LATTICE,
    count: flat.length / 2,
    lonlat: flat,
  }) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    // missing counts as stale
  }
  if (current !== out) {
    console.error('✖ public/data/land-dots.json is stale: run npm run data:globe');
    process.exit(1);
  }
  console.log(`✔ land-dots.json is up to date (${flat.length / 2} land dots)`);
} else {
  writeFileSync(OUTPUT, out);
  console.log(`✔ wrote public/data/land-dots.json (${flat.length / 2} land dots of ${LATTICE})`);
}
