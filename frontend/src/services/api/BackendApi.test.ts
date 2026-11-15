import { describe, expect, it } from 'vitest';
import { BackendApi } from './BackendApi';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json' },
  });

function api(respond: (url: string) => Promise<Response> | Response, timeoutMs = 1000) {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return respond(String(input));
  }) as typeof fetch;
  return { client: new BackendApi({ baseUrl: '/api', fetch: fetchImpl, timeoutMs }), urls };
}

describe('team API health', () => {
  it('reports online when /health answers {"status": "ok"} (backend/api/main.py)', async () => {
    const { client, urls } = api(() => json({ status: 'ok' }));
    expect(await client.status()).toEqual({ state: 'online' });
    expect(urls).toEqual(['/api/health']);
  });

  it('is not configured without a base URL, and makes no request', async () => {
    let called = false;
    const client = new BackendApi({
      baseUrl: null,
      fetch: (async () => {
        called = true;
        return json({});
      }) as typeof fetch,
    });
    expect(await client.status()).toEqual({ state: 'not-configured' });
    expect(called).toBe(false);
  });

  it('reports offline on network failure, HTTP errors, HTML fallbacks and odd payloads', async () => {
    const cases: [() => Promise<Response> | Response, string][] = [
      [() => Promise.reject(new TypeError('fetch failed')), 'it could not be reached'],
      [() => json({ detail: 'x' }, { status: 502 }), 'it answered HTTP 502'],
      [
        () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
        'the address did not answer as the API',
      ],
      [() => json({ status: 'starting' }), 'its health check returned an unexpected answer'],
    ];
    for (const [respond, reason] of cases) {
      expect(await api(respond).client.status()).toEqual({ state: 'offline', reason });
    }
  });

  it('gives up after the timeout', async () => {
    const { client } = api(
      (url) =>
        new Promise<Response>((_, reject) => {
          void url;
          setTimeout(() => reject(new DOMException('timed out', 'TimeoutError')), 50);
        }),
      10,
    );
    // The fake fetch ignores the signal, so the rejection arrives after the timeout fired.
    expect(await client.status()).toEqual({
      state: 'offline',
      reason: 'it did not answer in time',
    });
  });

  it('rethrows when the caller aborts', async () => {
    const controller = new AbortController();
    const { client } = api(() => {
      controller.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    await expect(client.status(controller.signal)).rejects.toThrow('aborted');
  });
});
