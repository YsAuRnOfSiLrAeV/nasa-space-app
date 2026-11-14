/** Cache real government context separately from the example model output.
 * Lakes intersecting the grid extent, >=1 ha, generalised to ~5m in EPSG:4326.
 */
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { z } from 'zod';
import { FireIndexSchema, FireResultSchema } from '../src/data/fireSchema';
import { CanadianContextSchema, WaterFeaturesSchema } from '../src/data/contextSchema';

const ROOT = resolve(import.meta.dirname, '..');
const SERVICE =
  'https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_basemapping/MapServer/20';
const args = process.argv.slice(2);
if (args.length && (args[0] !== '--fire' || args.length !== 2))
  throw new Error('Use --fire <catalog id>.');
const fireId = args[1] ?? 'bc_2003_490';
const index = FireIndexSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'public/data/demo/index.json'), 'utf8')),
);
const entry = index.find((fire) => fire.id === fireId);
if (!entry) throw new Error('The fire is not in the demonstration catalog.');
const result = FireResultSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'public/data/demo', entry.result), 'utf8')),
);
const corners = result.map_grid.corners_lonlat;
const bbox: [number, number, number, number] = [
  Math.min(...corners.map(([lon]) => lon)),
  Math.min(...corners.map(([, lat]) => lat)),
  Math.max(...corners.map(([lon]) => lon)),
  Math.max(...corners.map(([, lat]) => lat)),
];
if (bbox[0] < -139.1 || bbox[2] > -114 || bbox[1] < 48 || bbox[3] > 60.1)
  throw new Error(
    'This source covers British Columbia. Choose a corresponding provincial or national source for other regions.',
  );

async function query(params: Record<string, string>) {
  const response = await fetch(`${SERVICE}/query?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Canadian context request failed (HTTP ${response.status}).`);
  const data = (await response.json()) as Record<string, unknown>;
  if (data.error) throw new Error('The government map service reported a query error.');
  return data;
}

async function main() {
  // Query ids first, then bounded batches so the service's record cap cannot
  // silently truncate the local snapshot.
  const ids =
    z.object({ objectIds: z.array(z.number()).nullable() }).parse(
      await query({
        f: 'json',
        where: 'AREA_HA >= 1',
        geometry: bbox.join(','),
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        returnIdsOnly: 'true',
      }),
    ).objectIds ?? [];
  const water = WaterFeaturesSchema.parse({ type: 'FeatureCollection', features: [] });
  for (let start = 0; start < ids.length; start += 200) {
    const batch = await query({
      f: 'geojson',
      objectIds: ids.slice(start, start + 200).join(','),
      outFields: 'WATERBODY_POLY_ID,GNIS_NAME_1,AREA_HA',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      maxAllowableOffset: '0.00005',
    });
    if (batch.exceededTransferLimit)
      throw new Error(
        'The map service truncated a batch. Preserve the existing snapshot and retry with a smaller batch.',
      );
    water.features.push(...WaterFeaturesSchema.parse(batch).features);
  }
  if (water.features.length !== ids.length)
    throw new Error('The map service returned an incomplete snapshot.');
  const data = CanadianContextSchema.parse({
    schema_version: 1,
    fire_id: fireId,
    bbox,
    fetched_at: new Date().toISOString(),
    source: {
      name: 'British Columbia Freshwater Atlas · Lakes',
      url: 'https://open.canada.ca/data/en/dataset/cb1e3aba-d3fe-4de1-a2d4-b8b6650fb1f6',
      service: SERVICE,
      attribution:
        'Contains information licensed under the Open Government Licence – British Columbia.',
      licence: 'https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc',
      minimum_area_ha: 1,
    },
    water,
  });
  const folder = join(ROOT, 'public/data/context');
  mkdirSync(folder, { recursive: true });
  const output = join(folder, `${fireId}.json`);
  writeFileSync(`${output}.tmp`, `${JSON.stringify(data)}\n`);
  renameSync(`${output}.tmp`, output);
  console.log(
    `Saved ${water.features.length} government lake polygons to public/data/context/${fireId}.json.`,
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Context download failed.');
  process.exitCode = 1;
});
