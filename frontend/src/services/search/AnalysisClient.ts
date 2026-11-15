import { z } from 'zod';
import { ErrorSchema, RunSchema, SummersSchema, type Run } from './contracts';
import { FireResultSchema, parseFireCells, type FireData } from '@/data/fireSchema';

export function pause(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export class AnalysisClient {
  constructor(
    private base: string | null,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<T> {
    if (!this.base) throw new Error('Calculation is currently unavailable.');
    const response = await this.fetcher(`${this.base.replace(/\/$/, '')}${path}`, {
      method: body ? 'POST' : 'GET',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      ...(body
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    });
    if (!response.ok) {
      const error = ErrorSchema.safeParse(await response.json().catch(() => null));
      throw new Error(
        error.success
          ? `${error.data.message ?? 'Request failed'} (${error.data.code})`
          : `REQUEST_FAILED (${response.status})`,
      );
    }
    return schema.parse(await response.json());
  }
  async summers(fireId: string, signal: AbortSignal) {
    return (
      await this.request(
        `/summers?${new URLSearchParams({ fire_id: fireId })}`,
        SummersSchema,
        signal,
      )
    ).summers;
  }
  start(fireId: string, summer: number, signal: AbortSignal) {
    return this.request('/runs', RunSchema, signal, { fire_id: fireId, summer });
  }
  async poll(run: Run, signal: AbortSignal, update: (run: Run) => void): Promise<Run> {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (run.status === 'pending') {
      update(run);
      if (Date.now() >= deadline) throw new Error('PROCESSING_TIMEOUT');
      await pause(1500, signal);
      run = await this.request(`/runs/${encodeURIComponent(run.id)}`, RunSchema, signal);
    }
    return run;
  }
  async result(url: string, signal: AbortSignal): Promise<FireData> {
    const reach = async (path: string) => {
      const response = await this.fetcher(path, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      });
      if (!response.ok) throw new Error(`RESULT_FAILED (${response.status})`);
      return response.json();
    };
    const result = FireResultSchema.parse(await reach(url));
    const cells = parseFireCells(
      await reach(new URL(result.files.cells, url).href),
      result.map_grid,
    );
    signal.throwIfAborted();
    return {
      result,
      cells,
      opticalImageUrl: result.files.optical_image
        ? new URL(result.files.optical_image, url).href
        : null,
    };
  }
}
