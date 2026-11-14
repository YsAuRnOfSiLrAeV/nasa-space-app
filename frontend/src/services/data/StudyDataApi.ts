/**
 * The one place the app reads its data files. It owns the URLs, status
 * handling and validation for both: the study (manifest + points, produced by
 * `npm run data`) and the globe's land mask (produced by `npm run data:globe`).
 * Hooks hold React state on top of it; components never fetch or parse files.
 *
 * DOM-free and config-free: the base URL and fetch are injected, so tests pass
 * a fake fetch and the app's instance lives in `./index.ts`.
 */
import { z } from 'zod';
import { decodeDots } from '../../components/graphics/sphere';
import {
  ManifestSchema,
  PointCollectionSchema,
  type Manifest,
  type PointCollection,
} from '../../data/schema';
import { RecoveryFileSchema, type RecoveryFile } from '../../data/recoverySchema';
import { APPEEARS_PRODUCT } from '../../data/appeears';
import {
  FireObservationIndexSchema,
  validateFireObservations,
  type FireObservations,
} from '../../data/fireObservations';
import { CanadianContextSchema, type CanadianContext } from '../../data/contextSchema';
import {
  FireIndexSchema,
  FireResultSchema,
  FireCellsSchema,
  validateFireCells,
  type DemoFire,
  type FireData,
  type FireResult,
} from '../../data/fireSchema';

export interface StudyData {
  manifest: Manifest;
  points: PointCollection;
}

/** Land mask for the dotted globe, decoded to [lon, lat] pairs. */
export interface LandMask {
  dots: [number, number][];
  source: string;
}

const LandDotsFileSchema = z.object({
  source: z.string(),
  count: z.number().int().positive(),
  lonlat: z.array(z.number()).min(2),
});

/** A failure with a message written for the reader of the error state. */
export class DataLoadError extends Error {}

export interface StudyDataApiConfig {
  /** Folder that holds the data files, without a trailing slash. */
  baseUrl: string;
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export class StudyDataApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: StudyDataApiConfig) {
    this.baseUrl = config.baseUrl;
    // Bound: calling an unbound window.fetch as a method throws "Illegal invocation".
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async loadStudy(signal?: AbortSignal): Promise<StudyData> {
    const [manifest, points] = await Promise.all([
      this.getJson('manifest.json', ManifestSchema, 'npm run data', signal),
      this.getJson('points.geojson', PointCollectionSchema, 'npm run data', signal),
    ]);
    return { manifest, points };
  }

  async loadLandMask(signal?: AbortSignal): Promise<LandMask> {
    const file = await this.getJson(
      'land-dots.json',
      LandDotsFileSchema,
      'npm run data:globe',
      signal,
    );
    return { dots: decodeDots(file.lonlat), source: file.source };
  }

  async loadFireIndex(signal?: AbortSignal): Promise<DemoFire[]> {
    const file = 'demo/index.json';
    const response = await this.reach(file, signal);
    if (!response.ok)
      throw new DataLoadError(
        `The demonstration fire catalog failed to load (HTTP ${response.status}).`,
      );
    return this.parse(response, file, FireIndexSchema, 'the team’s fire export', false);
  }

  async loadCanadianContext(fireId: string, signal?: AbortSignal): Promise<CanadianContext | null> {
    const path = `context/${encodeURIComponent(fireId)}.json`;
    const response = await this.reach(path, signal);
    if (
      response.status === 404 ||
      (response.ok && (response.headers.get('content-type') ?? '').includes('text/html'))
    )
      return null;
    const data = await this.parse(response, path, CanadianContextSchema, 'npm run data:context');
    if (data.fire_id !== fireId)
      throw new DataLoadError('The geographic context does not match the selected fire.');
    return data;
  }

  async loadFire(fireId: string, signal?: AbortSignal): Promise<FireData | null> {
    const entry = (await this.loadFireIndex(signal)).find((fire) => fire.id === fireId);
    if (!entry) return null;
    const path = `demo/${entry.result}`;
    const result = await this.parse(
      await this.reach(path, signal),
      path,
      FireResultSchema,
      'the team’s fire export',
      false,
    );
    if (
      result.fire.id !== entry.id ||
      result.fire.year !== entry.year ||
      result.satellite_images.summer !== entry.summer
    ) {
      throw new DataLoadError('The fire result does not match its catalog entry.');
    }
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    const cellsPath = `${folder}${result.files.cells}`;
    const cells = await this.parse(
      await this.reach(cellsPath, signal),
      cellsPath,
      FireCellsSchema,
      'the team’s fire export',
      false,
    );
    try {
      validateFireCells(cells, result.map_grid);
    } catch {
      throw new DataLoadError('The fire grid dimensions do not match its cell arrays.');
    }
    return {
      result,
      cells,
      opticalImageUrl: result.files.optical_image
        ? this.url(`${folder}${result.files.optical_image}`)
        : null,
    };
  }

  /** Optional registry lives with demo exports so team-mode builds carry its associations. */
  async loadFireObservations(
    result: FireResult,
    signal?: AbortSignal,
  ): Promise<FireObservations | null> {
    const path = 'demo/observations.json';
    const response = await this.reach(path, signal);
    if (
      response.status === 404 ||
      (response.ok && (response.headers.get('content-type') ?? '').includes('text/html'))
    )
      return null;
    const index = await this.parse(
      response,
      path,
      FireObservationIndexSchema,
      'the team’s fire observation mapping',
      false,
    );
    const link = index.links.find((entry) => entry.fire_id === result.fire.id);
    if (!link) return null;
    if (link.fire_year !== result.fire.year)
      throw new DataLoadError('The optical observation mapping has the wrong fire year.');
    const record = await this.loadRecovery(link.group_id, signal);
    if (!record)
      throw new DataLoadError('The linked Landsat observation record has not been published.');
    try {
      validateFireObservations(result, link, record);
    } catch (error) {
      throw new DataLoadError(
        error instanceof Error ? error.message : 'The optical observation mapping is invalid.',
      );
    }
    return { link, record };
  }

  /**
   * Landsat imagery and NDVI history for one burn-scar group (`npm run data:landsat`).
   * Optional: resolves to null when the group has not been fetched.
   */
  async loadRecovery(
    groupId: string,
    signal?: AbortSignal,
    source: 'landsat' | 'appeears' = 'landsat',
  ): Promise<RecoveryFile | null> {
    const file = `${source === 'landsat' ? 'recovery' : 'appeears'}/${encodeURIComponent(groupId)}.json`;
    const res = await this.reach(file, signal);
    // A missing file is a 404, or the dev server's index.html fallback.
    if (
      res.status === 404 ||
      (res.ok && (res.headers.get('content-type') ?? '').includes('text/html'))
    ) {
      return null;
    }
    const data = await this.parse(
      res,
      file,
      RecoveryFileSchema,
      `npm run data:${source} -- --group ${groupId}`,
    );
    if (data.group_id !== groupId)
      throw new DataLoadError('The optical record does not match the selected sampling group.');
    if (source === 'appeears' && data.source.collection !== APPEEARS_PRODUCT)
      throw new DataLoadError('The AppEEARS record has an unexpected vegetation product.');
    // Image paths in the file are relative to the data folder: resolve them here,
    // so components render the URLs they are given and never build one.
    return {
      ...data,
      images: data.images.map((i) => ({
        ...i,
        natural: this.url(i.natural),
        swir: this.url(i.swir),
      })),
    };
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path}`;
  }

  /** Fetch, check and validate one required file. Aborts are rethrown untouched. */
  private async getJson<T>(
    file: string,
    schema: z.ZodType<T>,
    rebuild: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const res = await this.reach(file, signal);
    if (res.status === 404) {
      throw new DataLoadError(`${file} not found. Run \`${rebuild}\` to generate it.`);
    }
    return this.parse(res, file, schema, rebuild);
  }

  private async reach(file: string, signal?: AbortSignal): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}/${file}`, { signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new DataLoadError(`Could not reach ${file}. Check your connection and try again.`);
    }
  }

  private async parse<T>(
    res: Response,
    file: string,
    schema: z.ZodType<T>,
    rebuild: string,
    useCommand = true,
  ): Promise<T> {
    if (!res.ok) throw new DataLoadError(`${file} failed to load (HTTP ${res.status}).`);
    const json: unknown = await res.json().catch(() => {
      throw new DataLoadError(`${file} is not valid JSON.`);
    });
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new DataLoadError(
        `${file} does not match the data contract (${first?.path.join('.') || 'root'}: ${first?.message}). ${useCommand ? `Re-run \`${rebuild}\`.` : `Check ${rebuild}.`}`,
      );
    }
    return parsed.data;
  }
}
