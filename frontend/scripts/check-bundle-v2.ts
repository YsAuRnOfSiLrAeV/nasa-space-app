import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BundleIndexSchema, loadBundleV2 } from '../src/data/bundleV2';
import { ApplicabilityZonesSchema } from '../src/data/applicabilityZones';
const root = resolve(import.meta.dirname, '../public/data/bundle-v2');
const read = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(root, path), 'utf8'));
const index = BundleIndexSchema.parse(await read('index.json'));
const zones = ApplicabilityZonesSchema.parse(await read('confidence_zones.geojson'));
if (zones.features.length !== 8)
  throw new Error('Expected the eight original provider applicability features.');
if (index.fires.length !== 80 || new Set(index.fires.map((fire) => fire.id)).size !== 80)
  throw new Error('Expected all 80 unique supplied fires.');
let spatial = 0;
let timelines = 0;
for (const entry of index.fires) {
  const data = await loadBundleV2('', entry, index.summer, (path) => read(path.replace(/^\//, '')));
  for (const name of entry.files) await readFile(resolve(root, entry.dir, name));
  if (data.bundle!.cells.length) spatial++;
  if (data.bundle!.timeline) timelines++;
}
if (spatial !== 37) throw new Error(`Expected 37 spatial datasets, received ${spatial}.`);
console.log(
  `Validated ${index.fires.length} bundle v2 fires: ${spatial} spatial datasets, ${timelines} cell timelines, ${index.fires.length - spatial} perimeter/summary exports.`,
);
