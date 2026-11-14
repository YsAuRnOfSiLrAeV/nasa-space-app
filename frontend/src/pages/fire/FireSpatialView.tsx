import { useMemo, useState } from 'react';
import type { FireData } from '@/data/fireSchema';
import { useCanadianContext } from '@/hooks/useCanadianContext';
import { FireMap, type FireLayer } from './FireMap';
import { CONFIDENCE_NAMES, percent, STAGE_NAMES, suppliedCellIds } from './fireSpatial';
import styles from './Fire.module.css';

const LAYERS: { id: FireLayer; label: string; legend: string[] }[] = [
  { id: 'stage', label: 'Model height stage', legend: [...STAGE_NAMES] },
  { id: 'recovery', label: 'Structural recovery', legend: ['0%', '50%', '100% or above'] },
  { id: 'ndvi', label: 'Optical greenness (NDVI)', legend: ['0 or below', '0.5', '1'] },
  { id: 'confidence', label: 'Model confidence', legend: [...CONFIDENCE_NAMES] },
];

export function FireSpatialView({
  data,
  year = data.result.satellite_images.summer,
}: {
  data: FireData;
  year?: number;
}) {
  const projected = year > data.result.satellite_images.summer;
  const [layer, setLayer] = useState<FireLayer>(
    data.result.warnings.includes('MOCK_RESULT') ? 'recovery' : 'stage',
  );
  const [showLidar, setShowLidar] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const context = useCanadianContext(data.result.fire.id);
  const ids = useMemo(() => suppliedCellIds(data), [data]);
  const [picked, setPicked] = useState<number | null>(null);
  const selected =
    picked ?? ids.find((id) => data.cells.model.recovery[id] !== null) ?? ids[0] ?? null;
  const { result } = data;
  const activeLayer = projected ? 'recovery' : layer;
  const legend = LAYERS.find((entry) => entry.id === activeLayer)!.legend;

  return (
    <section aria-labelledby="fire-map-title">
      <h2 id="fire-map-title" className={styles.sectionTitle}>
        Recovery across the fire · {year}
        {projected ? ' · forecast preview' : ''}
      </h2>
      <div className={styles.toolbar}>
        <label className={styles.control}>
          Map layer
          <select
            className={styles.select}
            value={activeLayer}
            disabled={projected}
            onChange={(event) => setLayer(event.target.value as FireLayer)}
          >
            {LAYERS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          <input
            type="checkbox"
            checked={showWater}
            disabled={!context.data}
            onChange={(event) => setShowWater(event.target.checked)}
          />
          Government lake boundaries
        </label>
        <label className={styles.control}>
          <input
            type="checkbox"
            checked={showLidar}
            onChange={(event) => setShowLidar(event.target.checked)}
          />
          GEDI points
        </label>
      </div>
      <div className={styles.workspace}>
        <div>
          <FireMap
            data={data}
            layer={activeLayer}
            showLidar={showLidar}
            selectedCell={selected}
            onSelect={setPicked}
            context={context.data}
            showWater={showWater}
          />
          <ul
            className={styles.legend}
            aria-label={`${LAYERS.find((entry) => entry.id === activeLayer)!.label} legend`}
          >
            {legend.map((label, index) => (
              <li key={label}>
                <span
                  aria-hidden
                  className={styles.swatch}
                  style={{ background: `var(--stage-${index})` }}
                />
                {label}
              </li>
            ))}
            {result.fire.perimeter && <li>Solid outline · fire perimeter</li>}
            <li>Dashed outline · grid extent</li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Empty cells have no supplied value for the selected layer. Reference cells are dimmed
            and retain their supplied values.{' '}
            {projected
              ? `Burned-cell recovery is an illustrative preview for ${year}. GEDI points remain supplied measurements, not future heights.`
              : `Recovery layers show summer ${result.satellite_images.summer}.`}
          </p>
          {context.data && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Geographic context includes {context.data.water.features.length} mapped lake polygons
              of at least {context.data.source.minimum_area_ha} ha. This geographic reference has
              its own source date and describes the area around the example geometry. Snapshot
              retrieved {context.data.fetched_at.slice(0, 10)}. {context.data.source.attribution}{' '}
              <a
                className="underline underline-offset-4"
                href={context.data.source.url}
                target="_blank"
                rel="noreferrer"
              >
                Dataset and source details
              </a>
            </p>
          )}
          {!context.data && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {context.loading
                ? 'Loading Canadian geographic context…'
                : context.error
                  ? 'Canadian geographic context could not be loaded.'
                  : 'Canadian geographic context is not available for this fire.'}
            </p>
          )}
          {!result.fire.perimeter && (
            <p className="mt-2 text-xs text-muted-foreground">
              A fire perimeter has not been supplied.
            </p>
          )}
        </div>
        <aside aria-label="Cell details" className="space-y-5">
          <label className="grid gap-2 text-sm">
            Inspect a cell
            <select
              className={styles.select}
              value={selected ?? ''}
              disabled={ids.length === 0}
              onChange={(event) => setPicked(Number(event.target.value))}
            >
              {ids.length === 0 && <option value="">No cells supplied</option>}
              {ids.map((id) => (
                <option key={id} value={id}>
                  Row {Math.floor(id / result.map_grid.columns) + 1}, column{' '}
                  {(id % result.map_grid.columns) + 1}
                </option>
              ))}
            </select>
          </label>
          {selected !== null && <CellReadout data={data} index={selected} />}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {ids.length.toLocaleString()} of{' '}
            {(result.map_grid.columns * result.map_grid.rows).toLocaleString()} cells contain at
            least one supplied field. Cell size {result.map_grid.cell_size_m} m.
          </p>
          <details className="text-xs leading-relaxed">
            <summary className="cursor-pointer py-2">
              GEDI measurements ({result.lidar_points.length})
            </summary>
            <ul className="space-y-2 text-muted-foreground">
              {result.lidar_points.map((point, index) => (
                <li key={index}>
                  {point.lat.toFixed(4)}°, {point.lon.toFixed(4)}° · {point.height_m} m
                </li>
              ))}
              {result.lidar_points.length === 0 && <li>No GEDI coordinates supplied.</li>}
            </ul>
          </details>
        </aside>
      </div>
    </section>
  );
}

function CellReadout({ data: { cells }, index }: { data: FireData; index: number }) {
  const stage = cells.model.stage[index];
  const confidence = cells.map.confidence[index];
  const ndvi = cells.optics.ndvi[index];
  const zone = cells.map.zone[index];
  return (
    <dl className={styles.readout} aria-live="polite">
      <dt>Zone</dt>
      <dd>{zone == null ? 'Not supplied' : zone === 1 ? 'Burned' : 'Reference'}</dd>
      <dt>Model height stage</dt>
      <dd>{stage == null ? 'Not supplied' : STAGE_NAMES[stage]}</dd>
      <dt>Structural recovery</dt>
      <dd>{percent(cells.model.recovery[index])}</dd>
      <dt>Probability above 5 m</dt>
      <dd>{percent(cells.model.p_forest_gt5[index])}</dd>
      <dt>Optical NDVI</dt>
      <dd>{ndvi == null ? 'Not supplied' : (ndvi / 100).toFixed(2)}</dd>
      <dt>Model coverage</dt>
      <dd>{confidence == null ? 'Not supplied' : CONFIDENCE_NAMES[confidence]}</dd>
      <dt>Repeat fire</dt>
      <dd>{cells.map.reburn_year[index] ?? 'Not supplied'}</dd>
    </dl>
  );
}
