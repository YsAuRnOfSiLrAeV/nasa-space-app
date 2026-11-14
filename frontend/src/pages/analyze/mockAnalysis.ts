import { FirePerimeterSchema, type FireData, type FireResult } from '@/data/fireSchema';

export const ANALYSIS_YEAR = 2026;
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export type Perimeter = NonNullable<FireResult['fire']['perimeter']>;
export type AnalysisInput =
  | { kind: 'catalog'; fireId: string }
  | { kind: 'upload'; name: string; fireYear: number; perimeter: Perimeter };
export const MOCK_STEPS = [
  'Validate input',
  'Prepare the demo result',
  'Open the shared fire view',
] as const;

function polygons(shape: Perimeter) {
  return shape.type === 'Polygon' ? [shape.coordinates] : shape.coordinates;
}

/** Accept one polygonal fire, not a collection of unrelated fires. Properties
 * are deliberately ignored; user input is never treated as HTML or model data.
 */
export function parseFireUpload(text: string): Perimeter {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON. Choose a GeoJSON Polygon or MultiPolygon.');
  }
  if (input && typeof input === 'object' && 'type' in input) {
    if (input.type === 'FeatureCollection') {
      if (!('features' in input) || !Array.isArray(input.features) || input.features.length !== 1)
        throw new Error(
          'Upload one fire: a FeatureCollection must contain exactly one polygon feature.',
        );
      input = input.features[0];
    }
    if (input && typeof input === 'object' && 'type' in input && input.type === 'Feature')
      input = 'geometry' in input ? input.geometry : null;
  }
  const parsed = FirePerimeterSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      'Use a Polygon or MultiPolygon with closed rings and [longitude, latitude] coordinates in WGS84 (EPSG:4326).',
    );
  const shape = parsed.data;
  const rings = polygons(shape).flat();
  if (rings.reduce((count, ring) => count + ring.length, 0) > 1000)
    throw new Error(
      'This demo accepts up to 1,000 vertices. Simplify the perimeter and try again.',
    );
  for (const ring of rings) {
    if (ring.some(([, lat]) => Math.abs(lat) > 85))
      throw new Error('This map supports latitudes between 85° south and 85° north.');
    let area = 0;
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]!,
        b = ring[i]!;
      area += a[0] * b[1] - b[0] * a[1];
      for (let j = i + 2; j < ring.length; j++) {
        if (i === 1 && j === ring.length - 1) continue;
        if (crosses(a, b, ring[j - 1]!, ring[j]!))
          throw new Error('The perimeter crosses itself. Repair its rings before uploading.');
      }
    }
    if (Math.abs(area) < 1e-10) throw new Error('The perimeter must enclose a non-zero area.');
  }
  const bounds = shapeBounds(shape);
  if (bounds[2] - bounds[0] > 180)
    throw new Error('Perimeters crossing the date line are not supported by this demo.');
  return shape;
}

function crosses(a: number[], b: number[], c: number[], d: number[]) {
  const side = (p: number[], q: number[], r: number[]) =>
    (q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

export function shapeBounds(shape: Perimeter): [number, number, number, number] {
  const points = polygons(shape).flat(2);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}

function inRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (
      a[1]! > lat !== b[1]! > lat &&
      lon < ((b[0]! - a[0]!) * (lat - a[1]!)) / (b[1]! - a[1]!) + a[0]!
    )
      inside = !inside;
  }
  return inside;
}

/** Illustrative spatial response for exercising the UI, with no observations,
 * height probabilities, calibration claims or growth parameters fabricated.
 */
export function mockUploadResult(input: Extract<AnalysisInput, { kind: 'upload' }>): FireData {
  if (!input.name.trim() || input.name.length > 100)
    throw new Error('Enter a fire name of 1–100 characters.');
  if (!Number.isInteger(input.fireYear) || input.fireYear < 1900 || input.fireYear > ANALYSIS_YEAR)
    throw new Error('Enter a fire year between 1900 and 2026.');
  const shape = parseFireUpload(JSON.stringify(input.perimeter));
  const [w, s, e, n] = shapeBounds(shape);
  const size = 20;
  const recovery = Array.from({ length: size * size }, (_, i) => {
    const lon = w + (((i % size) + 0.5) / size) * (e - w);
    const lat = n - ((Math.floor(i / size) + 0.5) / size) * (n - s);
    const inside = polygons(shape).some(
      (p) => inRing(lon, lat, p[0]!) && !p.slice(1).some((hole) => inRing(lon, lat, hole)),
    );
    return inside ? 20 + ((i * 17) % 61) : null;
  });
  const valid = recovery.filter((v): v is number => v != null);
  const empty = recovery.map(() => null);
  return {
    result: {
      schema_version: 1,
      fire: {
        id: 'mock-upload',
        name: { en: input.name.trim(), uk: '' },
        year: input.fireYear,
        area_ha: null,
        perimeter: shape,
      },
      satellite_images: { summer: ANALYSIS_YEAR, nisar: null, sentinel1: null, sentinel2: null },
      map_grid: {
        columns: size,
        rows: size,
        cell_size_m: Math.max(
          1,
          Math.round(
            (111320 * Math.max((e - w) * Math.cos((((n + s) / 2) * Math.PI) / 180), n - s)) / size,
          ),
        ),
        corners_lonlat: [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ],
      },
      neighbour_forest: null,
      model_result: {
        model_version: 'illustrative-mock-v1',
        region: 'Unvalidated upload',
        recovery_today_avg: valid.length
          ? valid.reduce((sum, v) => sum + v, 0) / valid.length / 100
          : null,
        area_recovered_80pct: null,
        stage_share: null,
        error_vs_lidar_pct: null,
      },
      growth_forecast: null,
      comparison: null,
      lidar_points: [],
      files: { cells: 'cells.json', optical_image: null },
      warnings: ['MOCK_RESULT'],
    },
    cells: {
      model: { recovery, stage: empty, p_forest_gt5: empty },
      map: {
        zone: recovery.map((v) => (v == null ? null : 1)),
        confidence: recovery.map((v) => (v == null ? 0 : 1)),
        reburn_year: empty,
      },
      optics: { ndvi: empty },
    },
    opticalImageUrl: null,
  };
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, 300);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

export async function runMockAnalysis(
  input: AnalysisInput,
  options: {
    signal: AbortSignal;
    loadFire: (id: string, signal: AbortSignal) => Promise<FireData | null>;
    onStep: (step: number) => void;
  },
): Promise<FireData> {
  const { signal, onStep } = options;
  signal.throwIfAborted();
  onStep(0);
  await pause(signal);
  onStep(1);
  const data =
    input.kind === 'catalog'
      ? await options.loadFire(input.fireId, signal)
      : mockUploadResult(input);
  signal.throwIfAborted();
  if (!data) throw new Error('This fire is no longer available. Choose another catalog entry.');
  if (data.result.satellite_images.summer !== ANALYSIS_YEAR)
    throw new Error('This export does not cover summer 2026. Choose a 2026 result.');
  await pause(signal);
  onStep(2);
  await pause(signal);
  return data;
}
