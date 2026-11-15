import { useMemo, useState } from 'react';
import type { FireData } from '@/data/fireSchema';
import type { SpatialLayerId } from '@/domain/fire/spatialLayers';
import { useOpticalImage } from '@/hooks/useOpticalImage';
import type { FireOverlayVisibility } from '@/components/map/fireLayers';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { cellCentre, type GridLayerId } from '@/domain/fire/fireGrid';
import { clampYear, readForecast } from '@/domain/fire/growthForecast';
import { useFireData } from '@/hooks/useFireData';
import {
  selectionForFire,
  type InvestigationSelection,
} from '@/domain/fire/investigationSelection';

const DEFAULT_OVERLAYS: FireOverlayVisibility = {
  cells: true,
  perimeter: true,
  zone: true,
  gedi: true,
  optical: false,
};

/**
 * Everything the selected fire's investigation holds, in one place: its data, the
 * grid layer and overlays, the inspected cell and the forecast year. The map layer,
 * the panel and the year slider all read this; none of it touches the camera or URL.
 *
 * The inspected cell and the forecast year belong to one fire: another fire starts
 * with no cell and at its own observation summer.
 */
export function useFireInvestigation(
  fireId: string | null,
  mapView: StudyMapController | null,
  supplied?: FireData | null,
) {
  const fire = useFireData(fireId);
  const data =
    supplied?.result.fire.id === fireId
      ? supplied
      : fire.state.status === 'ready'
        ? fire.state.data
        : null;
  const optical = useOpticalImage(data?.opticalImageUrl ?? null);
  const [selectedLayer, setLayer] = useState<GridLayerId | null>(null);
  const layer = selectedLayer ?? (data?.bundle ? 'probability' : 'stage');
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const [spatial, setSpatial] = useState<{ fireId: string | null; layer: SpatialLayerId }>({
    fireId,
    layer: 'score',
  });
  if (spatial.fireId !== fireId) setSpatial({ fireId, layer: 'score' });

  const [selection, setSelection] = useState<InvestigationSelection>({
    fireId,
    cell: null,
    year: null,
    timelineYear: null,
  });
  const current = selectionForFire(selection, fireId);
  if (current !== selection) setSelection(current);

  const forecast = useMemo(
    () => (data ? readForecast(data.result, data.bundle?.source.model2) : null),
    [data],
  );
  const curve = forecast?.status === 'valid' ? forecast.curve : null;
  const forecastYear = curve ? clampYear(curve, current.year ?? curve.summer) : null;

  return {
    fireId,
    timelineYear: current.timelineYear,
    setTimelineYear: (timelineYear: number | null) => {
      // One year for the map and the whole-fire readout: a cell year also moves the forecast year.
      if (fireId)
        setSelection((previous) => {
          const current = selectionForFire(previous, fireId);
          return { ...current, timelineYear, year: timelineYear ?? current.year };
        });
    },
    /** Load state of the fire's result and cells. */
    fire: data ? { status: 'ready' as const, data } : fire.state,
    retry: fire.retry,
    data,
    optical,
    layer,
    spatialLayer: spatial.fireId === fireId ? spatial.layer : ('score' as SpatialLayerId),
    setSpatialLayer: (layer: SpatialLayerId) => {
      setSpatial({ fireId, layer });
      setSelection((previous) => ({ ...selectionForFire(previous, fireId), timelineYear: null }));
    },
    setLayer,
    overlays,
    setOverlays,
    inspected: current.cell,
    inspect: (cell: number) => {
      if (fireId) setSelection((previous) => ({ ...selectionForFire(previous, fireId), cell }));
    },
    /** Move the camera to a cell (the one deliberate camera action of the inspector). */
    showCell: (cell: number) => {
      if (data) {
        const supplied = data.bundle?.cells.find(
          (record) => record.row * data.result.map_grid.columns + record.col === cell,
        );
        const center: [number, number] = supplied
          ? [supplied.lon, supplied.lat]
          : cellCentre(data.result.map_grid, cell);
        mapView?.focus(center, { minZoom: 11, durationMs: 900 });
      }
    },
    forecast,
    /** The valid forecast curve, or null when the fire has none to draw. */
    curve,
    forecastYear,
    pickYear: (year: number) => {
      if (fireId) setSelection((previous) => ({ ...selectionForFire(previous, fireId), year }));
    },
  };
}

export type FireInvestigationState = ReturnType<typeof useFireInvestigation>;
