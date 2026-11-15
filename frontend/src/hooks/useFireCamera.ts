import { useEffect, useRef } from 'react';
import type { MapPresentation } from '@/app/route';
import type { StudyMapController } from '@/components/map/StudyMapController';
import type { DemoFire, FireResult } from '@/data/fireSchema';
import { gridBounds } from '@/domain/fire/fireGrid';
import { geometryBounds } from '@/services/search/geometryBounds';

type FireCamera = Pick<StudyMapController, 'showWholeEarth' | 'focusBounds' | 'focus'>;
type FocusBounds = [[number, number], [number, number]];

export function fireFocusBounds(
  perimeter: FireResult['fire']['perimeter'],
  grid: FireResult['map_grid'] | null,
): FocusBounds | null {
  if (perimeter) {
    const [west, south, east, north] = geometryBounds(perimeter);
    return [
      [west, south],
      [east, north],
    ];
  }
  return grid ? gridBounds(grid) : null;
}

/**
 * One camera transition per selected fire, after data and the existing map are ready.
 * Route parsing/history remain outside this hook. Layer, cell and forecast changes
 * are not camera inputs. A pending frame is cancelled when selection changes.
 */
export function useFireCamera({
  mapView,
  fireId,
  presentation,
  bounds,
  failed,
  entry,
}: {
  mapView: FireCamera | null;
  fireId: string | null;
  presentation: MapPresentation;
  bounds: FocusBounds | null;
  failed: boolean;
  entry: Pick<DemoFire, 'center_lonlat'> | undefined;
}) {
  const flown = useRef<string | null>(null);
  const lastPresentation = useRef(presentation);
  const fromPlanet = useRef(presentation === 'fire');
  useEffect(() => {
    if (lastPresentation.current === 'intro' && presentation === 'fire') fromPlanet.current = true;
    lastPresentation.current = presentation;
  }, [presentation]);

  useEffect(() => {
    if (!fireId) {
      flown.current = null;
      return;
    }
    if (!mapView || flown.current === fireId) return;
    if (!bounds && !(failed && entry)) return;
    const id = requestAnimationFrame(() => {
      flown.current = fireId;
      const far = fromPlanet.current;
      fromPlanet.current = false;
      if (far) mapView.showWholeEarth();
      if (bounds)
        void mapView.focusBounds(bounds, {
          durationMs: far ? 3200 : 2000,
          curve: far ? 1.6 : undefined,
        });
      else if (entry) mapView.focus(entry.center_lonlat, { minZoom: 7, durationMs: 2000 });
    });
    return () => cancelAnimationFrame(id);
  }, [mapView, fireId, bounds, failed, entry]);
}
