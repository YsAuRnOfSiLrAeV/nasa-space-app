import { useEffect, useRef } from 'react';
import type { MapPresentation } from '@/app/route';
import type { StudyMapController } from '@/components/map/StudyMapController';
import type { DemoFire, FireResult } from '@/data/fireSchema';
import { gridBounds } from '@/domain/fire/fireGrid';

type FireCamera = Pick<StudyMapController, 'showWholeEarth' | 'focusBounds' | 'focus'>;

/**
 * One camera transition per selected fire, after data and the existing map are ready.
 * Route parsing/history remain outside this hook. Layer, cell and forecast changes
 * are not camera inputs. A pending frame is cancelled when selection changes.
 */
export function useFireCamera({
  mapView,
  fireId,
  presentation,
  grid,
  failed,
  entry,
}: {
  mapView: FireCamera | null;
  fireId: string | null;
  presentation: MapPresentation;
  grid: FireResult['map_grid'] | null;
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
    if (!grid && !(failed && entry)) return;
    const id = requestAnimationFrame(() => {
      flown.current = fireId;
      const far = fromPlanet.current;
      fromPlanet.current = false;
      if (far) mapView.showWholeEarth();
      if (grid)
        void mapView.focusBounds(gridBounds(grid), {
          durationMs: far ? 3200 : 2000,
          curve: far ? 1.6 : undefined,
        });
      else if (entry) mapView.focus(entry.center_lonlat, { minZoom: 7, durationMs: 2000 });
    });
    return () => cancelAnimationFrame(id);
  }, [mapView, fireId, grid, failed, entry]);
}
