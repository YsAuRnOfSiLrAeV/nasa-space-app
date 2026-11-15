import { expect, it, vi } from 'vitest';
import { rasterImageUrl } from './gridRasterImage';

it('encodes a non-square raster without transposing or flipping its RGBA pixels', () => {
  const pixels = new Uint8ClampedArray(Array.from({ length: 24 }, (_, i) => i * 10));
  const image = {
    data: new Uint8ClampedArray(24),
    width: 2,
    height: 3,
    colorSpace: 'srgb',
  } as ImageData;
  const context = { createImageData: vi.fn(() => image), putImageData: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn(() => 'png') };
  expect(rasterImageUrl(pixels, 2, 3, () => canvas)).toBe('png');
  expect([canvas.width, canvas.height]).toEqual([2, 3]);
  expect(image.data).toEqual(pixels);
  expect(context.putImageData).toHaveBeenCalledWith(image, 0, 0);
  expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
});

it('leaves the raster unavailable when the browser cannot create a 2D context', () => {
  expect(
    rasterImageUrl(new Uint8ClampedArray(4), 1, 1, () => ({
      width: 0,
      height: 0,
      getContext: () => null,
      toDataURL: () => {
        throw new Error('must not encode');
      },
    })),
  ).toBe('');
});
