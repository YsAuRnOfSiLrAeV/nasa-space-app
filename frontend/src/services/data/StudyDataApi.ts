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
import { CatalogPerimetersSchema, type CatalogPerimeters } from '@/data/catalogPerimeters';
import { ApplicabilityZonesSchema, type ApplicabilityZones } from '@/data/applicabilityZones';
import {
  BundleFormatError,
  bundleIndexEntry,
  loadBundleV2,
  parseBundleIndex,
  type BundleEntry,
} from '@/data/bundleV2';
import { decodeDots } from '../../domain/globe/sphere';
import { parseLandRings, type LandRing } from '../../domain/globe/landOutline';
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
  ExportCellsSchema,
  parseFireCells,
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
  maxCachedFires?: number;
  bundleBaseUrl?: string;
  /** Folder that holds the data files, without a trailing slash. */
  baseUrl: string;
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Whether an image URL decodes. The app injects the browser's image loader. */
  probeImage?: ImageProbe;
}

export type ImageProbe = (url: string, signal?: AbortSignal) => Promise<boolean>;

export class StudyDataApi {
  private readonly maxCachedFires: number;
  private readonly bundleBaseUrl?: string;
  private bundleEntries: BundleEntry[] = [];
  private bundleSummer = 2026;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly probeImage: ImageProbe;
  /** Fire exports are immutable during a visit: loaded once, unless a fresh copy is asked for. */
  private readonly fires = new Map<string, FireData>();
  private readonly fireVersions = new Map<string, number>();
  private fireRevision = 0;
  /** The latest catalog request: fire loads reuse it instead of asking for the file again. */
  private fireIndex: Promise<DemoFire[]> | null = null;

  constructor(config: StudyDataApiConfig) {
    this.maxCachedFires = Math.max(1, Math.floor(config.maxCachedFires ?? 3));
    this.bundleBaseUrl = config.bundleBaseUrl;
    this.baseUrl = config.baseUrl;
    // No DOM here: without an injected probe, optional images count as absent.
    this.probeImage = config.probeImage ?? (() => Promise.resolve(false));
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

  /**
   * Natural Earth land rings for the landing globe. The file is a bundled asset, so
   * the caller passes its URL; it is not under the data folder.
   */
  async loadLandOutline(url: string, signal?: AbortSignal): Promise<LandRing[]> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, { signal });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new DataLoadError('The land outline could not be reached.');
    }
    if (!response.ok)
      throw new DataLoadError(`The land outline failed to load (HTTP ${response.status}).`);
    try {
      return parseLandRings(await response.json());
    } catch {
      throw new DataLoadError('The land outline file is not valid.');
    }
  }

  /** Whether an optional image (such as a fire's `optical.png`) exists and decodes. */
  imageLoads(url: string, signal?: AbortSignal): Promise<boolean> {
    return this.probeImage(url, signal);
  }

  loadFireIndex(signal?: AbortSignal): Promise<DemoFire[]> {
    const request = this.fetchFireIndex(signal);
    this.fireIndex = request;
    // A failed or cancelled request is never reused.
    request.catch(() => {
      if (this.fireIndex === request) this.fireIndex = null;
    });
    return request;
  }

  /** Lightweight catalog geometry only; never fetches an individual fire's detail files. */
  async loadFirePerimeters(signal?: AbortSignal): Promise<CatalogPerimeters | null> {
    if (!this.bundleBaseUrl) return null;
    const response = await this.fetchImpl(`${this.bundleBaseUrl}/perimeters.geojson`, { signal });
    if (!response.ok) throw new DataLoadError('Catalog perimeters could not be loaded.');
    return CatalogPerimetersSchema.parse(await response.json());
  }

  async loadApplicabilityZones(signal?: AbortSignal): Promise<ApplicabilityZones | null> {
    if (!this.bundleBaseUrl) return null;
    const response = await this.fetchImpl(`${this.bundleBaseUrl}/confidence_zones.geojson`, {
      signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new DataLoadError('Supplied applicability zones could not be loaded.');
    return ApplicabilityZonesSchema.parse(await response.json());
  }

  private async fetchFireIndex(signal?: AbortSignal): Promise<DemoFire[]> {
    const file = 'demo/index.json';
    const response = await this.reach(file, signal);
    if (!response.ok)
      throw new DataLoadError(
        `The demonstration fire catalog failed to load (HTTP ${response.status}).`,
      );
    const legacy = await this.parse(
      response,
      file,
      FireIndexSchema,
      'the team’s fire export',
      false,
    );
    if (!this.bundleBaseUrl) return legacy;
    const bundle = await this.bundleFile(
      'the supplied fire index',
      async () =>
        parseBundleIndex(await this.readBundleJson(`${this.bundleBaseUrl}/index.json`, signal)),
      signal,
    );
    this.bundleEntries = bundle.fires;
    this.bundleSummer = bundle.summer;
    // Retain v1 fixtures on disk and in v1-only configurations; replace their
    // Examples cards only when the corresponding supplied real export exists.
    const replacedFixtures: Record<string, string> = {
      quebec_1995_fixture: 'quebec_1995_1218',
      quebec_2010_fixture: 'quebec_2010_557',
      ontario_1988_fixture: 'ontario_1988_21',
    };
    return [
      ...legacy.filter(
        (entry) =>
          !bundle.fires.some((fire) => fire.id === (replacedFixtures[entry.id] ?? entry.id)),
      ),
      ...bundle.fires.map((entry) => bundleIndexEntry(entry, bundle.summer)),
    ];
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

  /** A fire already loaded during this visit, without a request. */
  cachedFire(fireId: string): FireData | undefined {
    return this.fires.get(fireId);
  }

  /** Invalidate loaded exports and prevent older requests from repopulating the cache. */
  clearFireCache(fireId?: string): void {
    if (fireId === undefined) {
      this.fires.clear();
      this.fireVersions.clear();
      this.fireIndex = null;
    } else {
      this.fires.delete(fireId);
      this.fireVersions.set(fireId, ++this.fireRevision);
    }
  }

  /** One fire's result and cells; `null` when the catalog has no such fire. */
  async loadFire(
    fireId: string,
    signal?: AbortSignal,
    options: { fresh?: boolean } = {},
  ): Promise<FireData | null> {
    signal?.throwIfAborted();
    if (options.fresh) this.fires.delete(fireId);
    const cached = this.fires.get(fireId);
    if (cached) {
      this.fires.delete(fireId);
      this.fires.set(fireId, cached);
      return cached;
    }
    const version = ++this.fireRevision;
    this.fireVersions.set(fireId, version);
    const data = await this.fetchFire(fireId, signal, options.fresh);
    signal?.throwIfAborted();
    if (data && this.fireVersions.get(fireId) === version) {
      this.fires.set(fireId, data);
      while (this.fires.size > this.maxCachedFires)
        this.fires.delete(this.fires.keys().next().value!);
    }
    return data;
  }

  private async fetchFire(
    fireId: string,
    signal?: AbortSignal,
    fresh = false,
  ): Promise<FireData | null> {
    // The catalog already asked for is reused; if that request failed or was cancelled
    // by its own caller, this one asks again. A retry always asks for a fresh copy.
    const index =
      (!fresh && (await this.fireIndex?.catch(() => null))) || (await this.loadFireIndex(signal));
    const entry = index.find((fire) => fire.id === fireId);
    if (!entry) return null;
    const bundleEntry = this.bundleEntries.find((fire) => fire.id === fireId);
    if (bundleEntry && this.bundleBaseUrl) {
      const base = this.bundleBaseUrl;
      const summer = this.bundleSummer;
      return this.bundleFile(
        `fire ${fireId}`,
        () =>
          loadBundleV2(
            base,
            bundleEntry,
            summer,
            (url) => this.readBundleJson(url, signal),
            signal,
          ),
        signal,
      );
    }
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
    const rawCells = await this.parse(
      await this.reach(cellsPath, signal),
      cellsPath,
      ExportCellsSchema,
      'the team’s fire export',
      false,
    );
    let cells;
    try {
      cells = parseFireCells(rawCells, result.map_grid);
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

  /** One JSON file of a supplied bundle. A missing file and an HTML fallback page both fail here. */
  private async readBundleJson(url: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, { signal });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new DataLoadError(`Could not reach ${url}. Check your connection and try again.`);
    }
    if (!response.ok)
      throw new DataLoadError(
        `Bundle resource could not be loaded: ${url} (HTTP ${response.status}).`,
      );
    try {
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new DataLoadError(`Bundle resource is missing or is not valid JSON: ${url}.`);
    }
  }

  /** Turn a bundle format failure into a message a reader can act on; aborts pass through. */
  private async bundleFile<T>(
    what: string,
    load: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      return await load();
    } catch (error) {
      if (signal?.aborted || !(error instanceof BundleFormatError)) throw error;
      throw new DataLoadError(`The supplied export of ${what} cannot be used. ${error.message}`);
    }
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
