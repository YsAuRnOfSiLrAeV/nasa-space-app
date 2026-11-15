import {
  opticalGroup,
  OPTICAL_REFERENCE_RADIUS_KM as REFERENCE_RADIUS_KM,
  type StudyPoint,
} from '../src/data/opticalGroup';
/**
 * Landsat imagery and NDVI history for one burn-scar group, from the public
 * USGS Landsat Collection 2 Level-2 archive via Microsoft Planetary Computer
 * (no account or key). Optional: the app works without its output.
 *
 * Usage:
 *   npm run data:landsat                          # default group 2002_205_-376
 *   npm run data:landsat -- --group 2011_204_-379
 *   npm run data:landsat -- --offline             # rebuild JSON from the cache only
 *   npm run data:landsat -- --check               # verify every cached group offline; writes nothing
 *
 * What it does:
 *   1. Searches summer scenes (15 Jun – 15 Sep) from 6 years before the fire to the
 *      reference year, Landsat 5 / 7 / 8 / 9, scene cloud cover < 80 %, at most 6 per year.
 *   2. Samples red, NIR and QA_PIXEL at every sample point of the group and at the
 *      unburned reference points within 40 km. Raw samples are cached in
 *      data/raw/landsat/<group>/ so the result can be rebuilt and checked offline.
 *   3. NDVI per point per summer (cloud, shadow, cirrus, snow and fill masked), then
 *      the median over points. Years without a clear observation stay empty.
 *   4. For each year, renders the clearest usable scene (≥ 90 % of the group's points
 *      clear; no Landsat 7 scan-line-off scenes) as natural-colour and shortwave-infrared
 *      JPEGs of a box that is square on the ground.
 *
 * Only coordinates and scene ids are sent to the service.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PointCollectionSchema } from '../src/data/schema';
import {
  clearShare,
  isSlcOff,
  summariseNdvi,
  type Sample,
  type SceneRef,
} from '../src/data/landsat';
import { RecoveryFileSchema, type RecoveryFile } from '../src/data/recoverySchema';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE_ROOT = join(ROOT, 'data/raw/landsat');
const OUT_ROOT = join(ROOT, 'public/data/recovery');
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const DATA_API = 'https://planetarycomputer.microsoft.com/api/data/v1/item';
const COLLECTION = 'landsat-c2-l2';
const PLATFORMS = ['landsat-5', 'landsat-7', 'landsat-8', 'landsat-9'];
const SEASON = { from: '06-15', to: '09-15' };
const YEARS_BEFORE_FIRE = 6;
const MAX_SCENES_PER_YEAR = 6;
const MAX_SCENE_CLOUD = 80;
const IMAGE_MIN_CLEAR = 0.9;
const IMAGE_MAX_SIZE = 720;
const CONCURRENCY = 8;
const COLOR_FORMULA = 'gamma RGB 2.7, saturation 1.5, sigmoidal RGB 15 0.55';
const DEFAULT_GROUP = '2002_205_-376';

interface Args {
  group: string;
  offline: boolean;
  check: boolean;
}

interface CachedScene extends SceneRef {
  cloud: number;
}

interface Cache {
  scenes: CachedScene[];
  samples: Record<string, Sample>;
  /** Scenes the render service could not open; skipped as images (the next-clearest is used). */
  unrenderable?: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { group: DEFAULT_GROUP, offline: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--group') args.group = argv[++i] ?? fail('--group needs an id');
    else if (a === '--offline') args.offline = true;
    else if (a === '--check') args.check = true;
    else fail(`Unknown argument: ${a}`);
  }
  return args;
}

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500) {
        // The data API reports a point outside a scene's footprint as HTTP 500; that is "no data".
        const body = await res.text();
        if (body.includes('outside dataset bounds')) return new Response(body, { status: 404 });
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
      }
      if (res.status === 429) throw new Error('HTTP 429');
      return res;
    } catch (e) {
      if (attempt >= 4) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

async function pool<T>(items: T[], worker: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        await worker(items[i]!, i);
      }
    }),
  );
}

/* ------------------------------------------------------------------ */

function loadGroup(groupId: string) {
  const collection = PointCollectionSchema.parse(
    JSON.parse(readFileSync(join(ROOT, 'public/data/points.geojson'), 'utf8')),
  );
  return opticalGroup(collection, groupId);
}

/* ------------------------------------------------------------------ */

async function searchScenes(extent: number[], years: [number, number]): Promise<CachedScene[]> {
  const out: CachedScene[] = [];
  for (let y = years[0]; y <= years[1]; y++) {
    const res = await request(STAC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: [COLLECTION],
        bbox: extent,
        datetime: `${y}-${SEASON.from}T00:00:00Z/${y}-${SEASON.to}T23:59:59Z`,
        query: { 'eo:cloud_cover': { lt: MAX_SCENE_CLOUD }, platform: { in: PLATFORMS } },
        sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }],
        limit: 50,
      }),
    });
    if (!res.ok) fail(`STAC search ${y}: HTTP ${res.status}`);
    const json = (await res.json()) as {
      features: {
        id: string;
        properties: { datetime: string; platform: string; 'eo:cloud_cover': number };
      }[];
    };
    const picked = json.features.slice(0, MAX_SCENES_PER_YEAR).map((f) => ({
      id: f.id,
      date: f.properties.datetime.slice(0, 10),
      platform: f.properties.platform,
      cloud: f.properties['eo:cloud_cover'],
    }));
    console.log(`  ${y}: ${json.features.length} scenes, sampling ${picked.length}`);
    out.push(...picked);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

async function samplePoint(sceneId: string, p: StudyPoint): Promise<Sample> {
  const url =
    `${DATA_API}/point/${p.lon},${p.lat}?collection=${COLLECTION}&item=${sceneId}` +
    `&assets=red&assets=nir08&assets=qa_pixel`;
  const res = await request(url);
  // Points outside a scene's footprint come back as an error or as fill; both are "no data".
  if (!res.ok) return [0, 0, 1];
  const json = (await res.json()) as { values?: (number | null)[] };
  const [r, n, q] = json.values ?? [];
  return [r ?? 0, n ?? 0, q ?? 1];
}

/** Renders one composite; resolves false if the service cannot open the scene's files. */
async function renderImage(
  sceneId: string,
  bbox: number[],
  assets: string[],
  file: string,
): Promise<boolean> {
  if (existsSync(file)) return true;
  const url =
    `${DATA_API}/bbox/${bbox.join(',')}.jpg?collection=${COLLECTION}&item=${sceneId}` +
    assets.map((a) => `&assets=${a}`).join('') +
    `&nodata=0&max_size=${IMAGE_MAX_SIZE}&color_formula=${encodeURIComponent(COLOR_FORMULA)}`;
  let res: Response;
  try {
    res = await request(url);
  } catch (e) {
    console.warn(`  ! ${sceneId} (${assets.join('/')}): ${(e as Error).message.slice(0, 100)}`);
    return false;
  }
  if (!res.ok) {
    console.warn(`  ! ${sceneId} (${assets.join('/')}): HTTP ${res.status}`);
    return false;
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

/* ------------------------------------------------------------------ */

function sortedRecord<T>(rec: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).sort(([a], [b]) => a.localeCompare(b)));
}

function readCache(group: string): Cache | null {
  const f = join(CACHE_ROOT, group, 'samples.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Cache) : null;
}

function writeCache(group: string, cache: Cache) {
  mkdirSync(join(CACHE_ROOT, group), { recursive: true });
  writeFileSync(
    join(CACHE_ROOT, group, 'samples.json'),
    JSON.stringify({
      scenes: cache.scenes,
      unrenderable: [...new Set(cache.unrenderable ?? [])].sort(),
      samples: sortedRecord(cache.samples),
    }) + '\n',
  );
}

function build(group: string, cache: Cache): RecoveryFile {
  const g = loadGroup(group);
  const years: [number, number] = [g.fireYear - YEARS_BEFORE_FIRE, referenceYear()];
  const burnedIds = g.burned.map((p) => p.id);
  const refIds = g.reference.map((p) => p.id);
  const scenes = cache.scenes.map((s) => ({
    id: s.id,
    date: s.date,
    platform: s.platform,
    clear_share: clearShare(s.id, burnedIds, cache.samples),
  }));
  const images: RecoveryFile['images'] = [];
  for (let y = years[0]; y <= years[1]; y++) {
    const best = scenes
      .filter(
        (s) =>
          s.date.startsWith(`${y}-`) &&
          !isSlcOff(s) &&
          s.clear_share >= IMAGE_MIN_CLEAR &&
          !(cache.unrenderable ?? []).includes(s.id),
      )
      .sort((a, b) => b.clear_share - a.clear_share || a.date.localeCompare(b.date))[0];
    if (best) {
      images.push({
        scene_id: best.id,
        date: best.date,
        platform: best.platform,
        clear_share: best.clear_share,
        natural: `recovery/${group}/${best.id}-natural.jpg`,
        swir: `recovery/${group}/${best.id}-swir.jpg`,
      });
    }
  }
  const kmX = 111.32 * Math.cos((((g.extent[1] + g.extent[3]) / 2) * Math.PI) / 180);
  const lon0 = (g.extent[0] + g.extent[2]) / 2;
  const lat0 = (g.extent[1] + g.extent[3]) / 2;
  const maxRef = g.reference.length
    ? Math.max(...g.reference.map((p) => Math.hypot((p.lon - lon0) * kmX, (p.lat - lat0) * 111.32)))
    : 0;
  const file: RecoveryFile = {
    schema_version: 1,
    group_id: group,
    fire_year: g.fireYear,
    bbox: g.bbox,
    season: SEASON,
    years,
    reference: { point_ids: refIds, max_distance_km: Math.round(maxRef * 10) / 10 },
    source: {
      collection:
        'Landsat Collection 2 Level-2 surface reflectance (Landsat 5 TM, 7 ETM+, 8–9 OLI)',
      access: 'Microsoft Planetary Computer (landsat-c2-l2)',
      citation: 'Landsat imagery courtesy of the U.S. Geological Survey',
      doi: ['10.5066/P9IAXOVV', '10.5066/P9C7I13B', '10.5066/P9OGBGM6'],
    },
    scenes,
    images,
    ndvi: summariseNdvi(cache.scenes, cache.samples, burnedIds, refIds, years),
  };
  return RecoveryFileSchema.parse(file);
}

function referenceYear(): number {
  const m = JSON.parse(readFileSync(join(ROOT, 'public/data/manifest.json'), 'utf8')) as {
    reference_year: number;
  };
  return m.reference_year;
}

const serialise = (f: RecoveryFile) => JSON.stringify(f, null, 1) + '\n';

/* ------------------------------------------------------------------ */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.check) {
    const groups = existsSync(CACHE_ROOT) ? readdirSync(CACHE_ROOT) : [];
    if (!groups.length) {
      console.log('✔ no Landsat caches (optional dataset); nothing to check');
      return;
    }
    for (const group of groups) {
      const cache = readCache(group) ?? fail(`${group}: cache missing samples.json`);
      const expected = serialise(build(group, cache));
      const outFile = join(OUT_ROOT, `${group}.json`);
      if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== expected) {
        fail(
          `${group}: public/data/recovery/${group}.json is stale. Run \`npm run data:landsat -- --group ${group} --offline\`.`,
        );
      }
      const file = RecoveryFileSchema.parse(JSON.parse(expected));
      for (const img of file.images) {
        for (const p of [img.natural, img.swir]) {
          if (!existsSync(join(ROOT, 'public/data', p))) fail(`${group}: missing image ${p}`);
        }
      }
      console.log(
        `✔ ${group}: recovery data up to date (${file.images.length} images, ${file.ndvi.filter((y) => y.burned).length} NDVI years)`,
      );
    }
    return;
  }

  const g = loadGroup(args.group);
  const years: [number, number] = [g.fireYear - YEARS_BEFORE_FIRE, referenceYear()];
  let cache = readCache(args.group) ?? { scenes: [], samples: {} };

  if (!args.offline) {
    console.log(
      `Group ${args.group}: ${g.burned.length} burned points, ${g.reference.length} reference points within ${REFERENCE_RADIUS_KM} km`,
    );
    if (!cache.scenes.length) {
      console.log(`Searching scenes ${years[0]}–${years[1]}…`);
      cache = { ...cache, scenes: await searchScenes(g.extent, years) };
      writeCache(args.group, cache);
    }
    const points = [...g.burned, ...g.reference];
    const jobs = cache.scenes.flatMap((s) =>
      points.filter((p) => !(`${s.id}|${p.id}` in cache.samples)).map((p) => ({ s, p })),
    );
    console.log(
      `Sampling ${jobs.length} point-scene pairs (${cache.scenes.length} scenes × ${points.length} points, cached pairs skipped)…`,
    );
    let done = 0;
    try {
      await pool(jobs, async ({ s, p }) => {
        cache.samples[`${s.id}|${p.id}`] = await samplePoint(s.id, p);
        if (++done % 500 === 0) {
          console.log(`  ${done}/${jobs.length}`);
          writeCache(args.group, cache);
        }
      });
    } finally {
      // Keep what was fetched: a rerun resumes from here.
      writeCache(args.group, cache);
    }
  } else if (!cache.scenes.length) {
    fail(`No cache for ${args.group}; run without --offline first.`);
  }

  mkdirSync(join(OUT_ROOT, args.group), { recursive: true });
  let file = build(args.group, cache);
  if (!args.offline) {
    // A scene that cannot be rendered is recorded; that year's next-clearest scene is tried instead.
    for (;;) {
      console.log(`Rendering ${file.images.length} scenes (natural colour + shortwave infrared)…`);
      const failed: string[] = [];
      const current = file;
      await pool(current.images, async (img) => {
        const out = (p: string) => join(ROOT, 'public/data', p);
        const ok =
          (await renderImage(
            img.scene_id,
            current.bbox,
            ['red', 'green', 'blue'],
            out(img.natural),
          )) &&
          (await renderImage(
            img.scene_id,
            current.bbox,
            ['swir22', 'nir08', 'red'],
            out(img.swir),
          ));
        if (!ok) failed.push(img.scene_id);
      });
      if (!failed.length) break;
      for (const id of failed) {
        for (const kind of ['natural', 'swir']) {
          const stale = join(OUT_ROOT, args.group, `${id}-${kind}.jpg`);
          if (existsSync(stale)) rmSync(stale);
        }
      }
      cache.unrenderable = [...(cache.unrenderable ?? []), ...failed];
      writeCache(args.group, cache);
      file = build(args.group, cache);
    }
  }
  writeFileSync(join(OUT_ROOT, `${args.group}.json`), serialise(file));
  const ndviYears = file.ndvi.filter((y) => y.burned).length;
  console.log(
    `✔ ${args.group}: ${file.scenes.length} scenes, ${file.images.length} images, NDVI in ${ndviYears} of ${file.ndvi.length} years → public/data/recovery/${args.group}.json`,
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
