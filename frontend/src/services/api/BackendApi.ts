/**
 * Client for the team API (backend/api/main.py, FastAPI on Cloud Run).
 *
 * This client only checks `GET /health` -> {"status": "ok"}. Fire search and
 * analysis runs go through `services/search/AnalysisClient.ts`; a finished run
 * returns the same files as the pipeline (DELIVERABLES tab 1), which the app
 * reads with `FireResultSchema` / `FireCellsSchema`.
 *
 * DOM-free and config-free: the base URL and fetch are injected (tests pass a
 * fake fetch; the app's instance lives in `./index.ts`).
 */
import { z } from 'zod';

const HealthSchema = z.object({ status: z.literal('ok') });

export type BackendStatus =
  { state: 'not-configured' } | { state: 'online' } | { state: 'offline'; reason: string };

export interface BackendApiConfig {
  /** API base URL without a trailing slash, or null when no backend is configured. */
  baseUrl: string | null;
  fetch?: typeof fetch;
  /** Give up on a request after this long (ms). */
  timeoutMs?: number;
}

export class BackendApi {
  private readonly baseUrl: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: BackendApiConfig) {
    this.baseUrl = config.baseUrl;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  /** Whether the service answers its health check. Never throws, except on abort. */
  async status(signal?: AbortSignal): Promise<BackendStatus> {
    if (!this.baseUrl) return { state: 'not-configured' };
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/health`, {
        signal: combined,
        headers: { accept: 'application/json' },
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      return {
        state: 'offline',
        reason: timeout.aborted ? 'it did not answer in time' : 'it could not be reached',
      };
    }
    if (!res.ok) return { state: 'offline', reason: `it answered HTTP ${res.status}` };
    // The dev server answers unknown paths with index.html: not the API.
    if (!(res.headers.get('content-type') ?? '').includes('json')) {
      return { state: 'offline', reason: 'the address did not answer as the API' };
    }
    const body: unknown = await res.json().catch(() => null);
    return HealthSchema.safeParse(body).success
      ? { state: 'online' }
      : { state: 'offline', reason: 'its health check returned an unexpected answer' };
  }
}
