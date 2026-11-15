import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataLoadError } from '@/services/data/StudyDataApi';
import { resourceState, startResourceRequest } from './resourceRequest';

afterEach(() => vi.restoreAllMocks());

describe('shared resource lifecycle', () => {
  it('keeps real zero values and distinguishes absent data', async () => {
    const publish = vi.fn();
    await startResourceRequest(async () => 0, publish).done;
    expect(publish).toHaveBeenLastCalledWith({ status: 'ready', data: 0 });
    await startResourceRequest(async () => null, publish).done;
    expect(publish).toHaveBeenLastCalledWith({ status: 'absent' });
  });

  it('handles synchronous throws and rejected loads as reader-facing errors', async () => {
    const publish = vi.fn();
    await startResourceRequest(() => {
      throw new DataLoadError('Failed');
    }, publish).done;
    expect(publish).toHaveBeenLastCalledWith({ status: 'error', message: 'Failed' });
    await startResourceRequest(async () => {
      throw new DataLoadError('Offline');
    }, publish).done;
    expect(publish).toHaveBeenLastCalledWith({ status: 'error', message: 'Offline' });
  });

  it('logs unexpected failures while keeping their internals out of UI messages', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const publish = vi.fn();
    const error = new Error('Internal debugging details');
    await startResourceRequest(async () => {
      throw error;
    }, publish).done;
    expect(log).toHaveBeenCalledWith(error);
    expect(publish).toHaveBeenLastCalledWith({
      status: 'error',
      message: 'Unexpected error while loading data.',
    });
  });

  it.each(['resolve', 'reject'] as const)(
    'suppresses a late %s after cancellation',
    async (outcome) => {
      let resolve!: (value: string) => void;
      let reject!: (reason: Error) => void;
      const pending = new Promise<string>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const publish = vi.fn();
      let signal!: AbortSignal;
      const request = startResourceRequest((abort) => {
        signal = abort;
        return pending;
      }, publish);
      await Promise.resolve();
      request.cancel();
      expect(signal.aborted).toBe(true);
      if (outcome === 'resolve') resolve('old fire');
      else reject(new Error('old error'));
      await request.done;
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('does not start a request cancelled before its loader runs', async () => {
    const load = vi.fn(async () => 'data');
    const publish = vi.fn();
    const request = startResourceRequest(load, publish);
    request.cancel();
    await request.done;
    expect(load).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('never selects another key or a result from an earlier retry', () => {
    const old = { key: 'A', attempt: 0, value: { status: 'ready' as const, data: 'old' } };
    expect(resourceState(null, 0, old)).toEqual({ status: 'idle' });
    expect(resourceState('B', 0, old)).toEqual({ status: 'loading' });
    expect(resourceState('A', 1, old)).toEqual({ status: 'loading' });
    expect(resourceState('A', 0, old)).toEqual(old.value);
  });

  it('shows a service cache immediately, but bypasses it when retrying', () => {
    const peek = vi.fn(() => 0);
    expect(resourceState('A', 0, null, peek)).toEqual({ status: 'ready', data: 0 });
    peek.mockClear();
    expect(resourceState('A', 1, null, peek)).toEqual({ status: 'loading' });
    expect(peek).not.toHaveBeenCalled();
  });
});
