interface RasterCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): Pick<CanvasRenderingContext2D, 'createImageData' | 'putImageData'> | null;
  toDataURL(type: string): string;
}

/** Browser encoding only. Pixel classification and geographic positioning belong to domain/. */
export function rasterImageUrl(
  pixels: Uint8ClampedArray,
  columns: number,
  rows: number,
  createCanvas: () => RasterCanvas = () => document.createElement('canvas'),
): string {
  const canvas = createCanvas();
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(columns, rows);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
