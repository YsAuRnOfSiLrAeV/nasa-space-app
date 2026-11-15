import { useMemo, useState } from 'react';
import type { FireData } from '@/data/fireSchema';
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
  const [layer, setLayer] = useState<GridLayerId>('stage');
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);

  const [selection, setSelection] = useState<InvestigationSelection>({
    fireId,
    cell: null,
    year: null,
  });
  const current = selectionForFire(selection, fireId);
  if (current !== selection) setSelection(current);

  const forecast = useMemo(() => (data ? readForecast(data.result) : null), [data]);
  const curve = forecast?.status === 'valid' ? forecast.curve : null;
  const forecastYear = curve ? clampYear(curve, current.year ?? curve.summer) : null;

  return {
    fireId,
    /** Load state of the fire's result and cells. */
    fire: data ? { status: 'ready' as const, data } : fire.state,
    retry: fire.retry,
    data,
    optical,
    layer,
    setLayer,
    overlays,
    setOverlays,
    inspected: current.cell,
    inspect: (cell: number) => {
      if (fireId) setSelection((previous) => ({ ...selectionForFire(previous, fireId), cell }));
    },
    /** Move the camera to a cell (the one deliberate camera action of the inspector). */
    showCell: (cell: number) => {
      if (data)
        mapView?.focus(cellCentre(data.result.map_grid, cell), { minZoom: 11, durationMs: 900 });
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
