import { useState } from 'react';
import type { Polygon } from 'geojson';

/** Kept by Explorer so mode switches and Landing do not discard a boundary. */
export function usePolygonDraft(requestDraw = false) {
  const [drawing, setDrawing] = useState(requestDraw);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [polygon, setPolygon] = useState<Polygon | null>(null);
  const [requested, setRequested] = useState(requestDraw);
  if (requested !== requestDraw) {
    setRequested(requestDraw);
    // Resume an unfinished draft, preserving any previous completed selection.
    if (requestDraw) setDrawing(true);
  }
  return { drawing, setDrawing, points, setPoints, polygon, setPolygon };
}
export type PolygonDraft = ReturnType<typeof usePolygonDraft>;
