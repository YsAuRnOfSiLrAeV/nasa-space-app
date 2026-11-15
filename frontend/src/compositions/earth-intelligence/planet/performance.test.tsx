import { afterEach, describe, expect, it, vi } from 'vitest';
import { readColors } from './frame';
import { createLeaderLayout } from './leaderLayout';

afterEach(() => vi.unstubAllGlobals());

describe('globe animation DOM work', () => {
  it('reads one computed style snapshot for the entire palette, preserving fallback colors', () => {
    const snapshot = vi.fn(() => ({
      getPropertyValue: (name: string) => (name === '--cartography-land' ? ' #123456 ' : ''),
    }));
    vi.stubGlobal('getComputedStyle', snapshot);
    const colors = readColors({} as Element);
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(colors.land).toBe('#123456');
    expect(colors.ocean).toBe('#171b20');
    expect(Object.keys(colors)).toHaveLength(16);
  });

  it('updates drifting leader anchors for 120 frames without repeating layout reads', () => {
    const stage = { getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20, height: 800 })) };
    const canvas = { getBoundingClientRect: vi.fn(() => ({ left: 30, top: 40, height: 400 })) };
    const frame = {
      offsetParent: {},
      getBoundingClientRect: vi.fn(() => ({ left: 100, top: 200, height: 40 })),
    };
    const layout = createLeaderLayout();
    const mark = { x0: 0, x1: 5, y0: 4, y1: 10 };
    expect(layout.path(mark, stage, canvas, frame)).toBe('M25 24L90 180M25 30L90 220');
    for (let i = 0; i < 120; i++) {
      const path = layout.path({ ...mark, x1: i }, stage, canvas, frame);
      expect(path).toContain(`M${20 + i} 24`);
    }
    expect(stage.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(frame.getBoundingClientRect).toHaveBeenCalledTimes(1);

    frame.getBoundingClientRect.mockReturnValue({ left: 200, top: 300, height: 50 });
    layout.invalidate();
    expect(layout.path(mark, stage, canvas, frame)).toBe('M25 24L190 280M25 30L190 330');
    expect(frame.getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it('hides leaders when their region or preview is hidden, and remeasures after reveal', () => {
    const bounds = { left: 0, top: 0, height: 100 };
    const stage = { getBoundingClientRect: vi.fn(() => bounds) };
    const frame: { offsetParent: object | null; getBoundingClientRect: () => typeof bounds } = {
      offsetParent: null,
      getBoundingClientRect: vi.fn(() => bounds),
    };
    const mark = { x0: 0, x1: 5, y0: 4, y1: 10 };
    const layout = createLeaderLayout();
    expect(layout.path(null, stage, stage, frame)).toBe('');
    expect(layout.path(mark, stage, stage, frame)).toBe('');
    expect(stage.getBoundingClientRect).not.toHaveBeenCalled();
    frame.offsetParent = {};
    layout.invalidate();
    expect(layout.path(mark, stage, stage, frame)).not.toBe('');
  });
});
