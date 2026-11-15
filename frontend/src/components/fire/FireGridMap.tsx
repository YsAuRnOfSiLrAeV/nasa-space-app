import type { FireData } from '@/data/fireSchema';
import type { GridLayerId } from '@/domain/fire/fireGrid';
import type { FireOverlayVisibility } from '@/domain/fire/overlays';
import { useFireGridLayers } from '@/hooks/useFireGridLayers';
import { useEffect, useRef, useState } from 'react';
import type { FirePointer } from '@/components/map/fireLayers';
import { describeCell, GRID_LAYERS } from '@/domain/fire/fireGrid';
import { pickGridTarget, type GridTarget } from '@/domain/fire/gridPicking';
import type { FireGridController } from './fireGridController';
import { CellDetails } from './CellDetails';
import { SpatialCellReadout } from './SpatialCellReadout';
import type { SpatialLayerId } from '@/domain/fire/spatialLayers';
import styles from './FireGrid.module.css';

interface FireGridMapProps {
  mapView: FireGridController | null;
  data: FireData;
  layer: GridLayerId;
  overlays: FireOverlayVisibility;
  opticalReady: boolean;
  inspected: number | null;
  timelineYear?: number | null;
  spatialLayer?: SpatialLayerId;
  onInspect: (cell: number) => void;
}

type Hover = (GridTarget | { kind: 'perimeter' }) & { x: number; y: number; pinned: boolean };

/** Integrates the existing map layers and pointer state; renders the categorical tooltip. */
export function FireGridMap(props: FireGridMapProps) {
  useFireGridLayers(props);
  const { mapView, data, layer, onInspect } = props;
  const [hover, setHover] = useState<Hover | null>(null);
  const latest = useRef({ data, layer, onInspect, overlays: props.overlays });
  useEffect(() => {
    latest.current = { data, layer, onInspect, overlays: props.overlays };
  });
  useEffect(() => {
    if (!mapView) return;
    const onPointer = (event: FirePointer) => {
      if (event.type === 'reset') return setHover(null);
      if (event.type === 'leave') return setHover((value) => (value?.pinned ? value : null));
      const current = latest.current;
      const pinned = event.type === 'click';
      const target =
        pickGridTarget(
          current.data,
          current.layer,
          current.overlays.cells === false ? null : event.lngLat,
          event.gediIndex,
        ) ?? (event.perimeterHit ? { kind: 'perimeter' as const } : null);
      const next: Hover | null = target ? { ...target, ...event.point!, pinned } : null;
      if (target?.kind === 'cell' && pinned) current.onInspect(target.cell.index);
      setHover((value) => (value?.pinned && !pinned ? value : next));
    };
    const off = mapView.onFirePointer(onPointer);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setHover(null);
    window.addEventListener('keydown', onKey);
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
    };
  }, [mapView]);

  const shown: Hover | null =
    hover?.kind === 'cell' && hover.cell.layerLabel !== GRID_LAYERS[layer].label
      ? { ...hover, cell: describeCell(data, layer, hover.cell.index) }
      : hover;

  if (
    !shown ||
    (shown.kind === 'cell' && props.overlays.cells === false) ||
    (shown.kind === 'gedi' && !props.overlays.gedi) ||
    (shown.kind === 'perimeter' && !props.overlays.perimeter)
  )
    return null;
  // Open towards the free side, then clamp so the description never leaves the screen.
  const gap = 14;
  const margin = 16;
  const width = Math.min(280, window.innerWidth - 2 * margin);
  const preferred =
    shown.x + gap + width > window.innerWidth - margin ? shown.x - gap - width : shown.x + gap;
  const left = Math.max(margin, Math.min(preferred, window.innerWidth - margin - width));
  const flipY = shown.y > window.innerHeight - 220;
  return (
    <div
      className={styles.tooltip}
      style={{
        left,
        top: shown.y,
        width,
        maxHeight: 'min(60vh, 480px)',
        overflowY: 'auto',
        pointerEvents: shown.pinned ? 'auto' : 'none',
        transform: `translateY(${flipY ? `calc(-100% - ${gap}px)` : `${gap}px`})`,
      }}
      data-pinned={shown.pinned || undefined}
      role={shown.pinned ? 'status' : undefined}
      aria-live={shown.pinned ? 'polite' : undefined}
    >
      {shown.kind === 'perimeter' ? (
        <>
          <p>Fire perimeter · {data.result.fire.id}</p>
          <p>
            {data.result.fire.year} · {data.result.fire.area_ha ?? 'Area not supplied'}
            {data.result.fire.area_ha != null ? ' ha' : ''}
          </p>
          <p>Geographic boundary · polygon.geojson</p>
        </>
      ) : shown.kind === 'gedi' ? (
        <>
          <p className={styles.tooltipTitle}>GEDI lidar footprint</p>
          <dl>
            <dt>Measured canopy</dt>
            <dd>{shown.band} band</dd>
            {shown.heightM !== undefined && (
              <>
                <dt>Measured canopy height</dt>
                <dd>{shown.heightM} m</dd>
                <dt>Source</dt>
                <dd>gedi.geojson · rh98_m · {data.result.fire.id}</dd>
              </>
            )}
          </dl>
        </>
      ) : data.bundle ? (
        <SpatialCellReadout data={data} index={shown.cell.index} year={props.timelineYear} />
      ) : (
        <CellDetails cell={shown.cell} titleClassName={styles.tooltipTitle} />
      )}
      {shown.pinned && <p className={styles.tooltipHint}>Esc or tap elsewhere to close</p>}
    </div>
  );
}
