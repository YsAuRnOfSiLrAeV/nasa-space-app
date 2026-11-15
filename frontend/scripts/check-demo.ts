/**
 * Checks that the demo fires open in the app: `npm run data:demo`.
 *
 * Reads the folder the app would serve (scripts/demoData.ts: the pipeline's
 * ../data/demo when it has an index.json, else the bundled example) and loads
 * every fire through the app's own loader (StudyDataApi.loadFire), so the
 * schema, id/year/summer matching and grid-length checks are exactly the app's.
 * Also checks that every file a result names exists. Writes nothing.
 *
 *   npm run data:demo                         # the folder the app will serve
 *   FIRE_DEMO_DIR=../path/to/out npm run data:demo
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { StudyDataApi } from '../src/services/data/StudyDataApi';
import { FireObservationIndexSchema } from '../src/data/fireObservations';
import { demoFile, resolveDemoData } from './demoData';

const BASE = 'local';

/** A fetch over the demo folder, shaped like the dev server's responses. */
function folderFetch(dir: string): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const prefix = `${BASE}/demo/`;
    const file = url.startsWith(prefix)
      ? demoFile(dir, url.slice(prefix.length))
      : url.startsWith(`${BASE}/recovery/`)
        ? demoFile(resolve(process.cwd(), 'public/data'), url.slice(`${BASE}/`.length))
        : null;
    if (!file || !existsSync(file)) return new Response('Not found', { status: 404 });
    return new Response(readFileSync(file), {
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

async function main() {
  const { source, dir } = resolveDemoData();
  const where = relative(process.cwd(), dir) || '.';
  console.log(
    source === 'team'
      ? `Checking team demo fires in ${where}`
      : `No team results yet (../data/demo/index.json). Checking the bundled example in ${where}`,
  );
  const api = new StudyDataApi({ baseUrl: BASE, fetch: folderFetch(dir) });
  const index = await api.loadFireIndex();
  if (!index.length) throw new Error('index.json lists no fires.');
  const observationIndex = resolve(dir, 'observations.json');
  if (existsSync(observationIndex)) {
    const registry = FireObservationIndexSchema.parse(
      JSON.parse(readFileSync(observationIndex, 'utf8')),
    );
    for (const link of registry.links) {
      if (!index.some((fire) => fire.id === link.fire_id))
        throw new Error(`Observation mapping names unknown fire ${link.fire_id}.`);
    }
  }

  let failed = 0;
  for (const entry of index) {
    try {
      const data = await api.loadFire(entry.id);
      if (!data) throw new Error('not found in index.json');
      const observations = await api.loadFireObservations(data.result);
      for (const image of observations?.record.images ?? []) {
        for (const url of [image.natural, image.swir]) {
          const asset = demoFile(
            resolve(process.cwd(), 'public/data'),
            url.slice(`${BASE}/`.length),
          );
          if (!asset || !existsSync(asset))
            throw new Error(`Linked Landsat image is missing: ${url}`);
        }
      }
      const folder = resolve(dir, entry.result, '..');
      const optical = data.result.files.optical_image;
      if (optical && !existsSync(resolve(folder, optical))) {
        throw new Error(`result.json names ${optical}, which does not exist`);
      }
      const { columns, rows } = data.result.map_grid;
      console.log(
        `✔ ${entry.id}: ${columns}×${rows} cells, ${data.result.lidar_points.length} lidar points, ` +
          `${optical ? 'optical image' : 'no optical image'}, ${observations ? `Landsat ${observations.link.group_id}` : 'no linked Landsat record'}` +
          (data.result.warnings.length ? `, warnings ${data.result.warnings.join(', ')}` : ''),
      );
    } catch (error) {
      failed++;
      console.error(`✖ ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) {
    console.error(`${failed} of ${index.length} fires would not open in the app.`);
    process.exit(1);
  }
  console.log(`✔ ${index.length} demo fire(s) open in the app (source: ${source}).`);
}

main().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
