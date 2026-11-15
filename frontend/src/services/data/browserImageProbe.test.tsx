import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserImageProbe } from './browserImageProbe';

class TestImage {
  static last: TestImage;
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    TestImage.last = this;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('browser image adapter', () => {
  it.each(['load', 'error'] as const)('reports %s and releases abort listeners', async (kind) => {
    vi.stubGlobal('Image', TestImage);
    const abort = new AbortController();
    const remove = vi.spyOn(abort.signal, 'removeEventListener');
    const pending = browserImageProbe('/optical.png', abort.signal);
    expect(TestImage.last.src).toBe('/optical.png');
    if (kind === 'load') TestImage.last.onload!();
    else TestImage.last.onerror!();
    expect(await pending).toBe(kind === 'load');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(TestImage.last.onload).toBeNull();
    expect(TestImage.last.onerror).toBeNull();
  });

  it('cancels decoding and cleans up handlers on abort', async () => {
    vi.stubGlobal('Image', TestImage);
    const abort = new AbortController();
    const pending = browserImageProbe('/optical.png', abort.signal);
    abort.abort();
    expect(await pending).toBe(false);
    expect(TestImage.last.src).toBe('');
    expect(TestImage.last.onload).toBeNull();
  });

  it('does not create an image for an already-aborted probe', async () => {
    const factory = vi.fn();
    vi.stubGlobal('Image', factory);
    const abort = new AbortController();
    abort.abort();
    expect(await browserImageProbe('/optical.png', abort.signal)).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });
});
