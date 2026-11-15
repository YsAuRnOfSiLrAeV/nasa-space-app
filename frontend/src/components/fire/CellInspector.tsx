import { useId, useMemo, useState } from 'react';
import type { FireData } from '@/data/fireSchema';
import { CellDetails } from './CellDetails';
import { SpatialCellReadout } from './SpatialCellReadout';
import {
  categorySummary,
  describeCell,
  GRID_LAYERS,
  nextSuppliedCell,
  type GridLayerId,
} from '../../domain/fire/fireGrid';
import styles from './FireGrid.module.css';

/**
 * Keyboard and screen-reader access to the grid: a per-category count table (the
 * text equivalent of the map) and a row/column inspector whose cell is outlined on
 * the map. Shows categories only, like the tooltip.
 */
export function CellInspector({
  data,
  layer,
  cell,
  timelineYear = null,
  onCell,
  onShowOnMap,
}: {
  data: FireData;
  layer: GridLayerId;
  /** Inspected cell index, or null before any cell is chosen. */
  cell: number | null;
  /** The cell timeline's year while it is shown: the readout then follows it. */
  timelineYear?: number | null;
  onCell: (index: number) => void;
  onShowOnMap?: (index: number) => void;
}) {
  const id = useId();
  const { columns, rows } = data.result.map_grid;
  const summary = useMemo(() => categorySummary(data.cells, layer), [data, layer]);
  const first = useMemo(() => nextSuppliedCell(data.cells, -1, 1), [data]);
  const current = cell ?? first;
  const described = current === null ? null : describeCell(data, layer, current);
  const row = current === null ? 1 : Math.floor(current / columns) + 1;
  const column = current === null ? 1 : (current % columns) + 1;
  const clamp = (value: number, max: number) =>
    Math.min(max, Math.max(1, Number.isFinite(value) ? Math.round(value) : 1));
  const go = (r: number, c: number) =>
    onCell((clamp(r, rows) - 1) * columns + clamp(c, columns) - 1);
  const step = (direction: 1 | -1) => {
    const next = nextSuppliedCell(data.cells, current ?? -1, direction);
    if (next !== null) onCell(next);
  };
  const any = (area: 'burned' | 'reference' | 'other') => summary.some((r) => r.counts[area] > 0);
  const areas = (['burned', 'reference', 'other'] as const).filter(any);
  const areaName = { burned: 'Burned', reference: 'Reference', other: 'Not assessed' };

  return (
    <section className={styles.inspector} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Cells without the map</h3>
      {!data.bundle && (
        <table className={styles.summary}>
          <caption>
            Cells per {GRID_LAYERS[layer].label.toLowerCase()} category and area (counts only)
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              {areas.map((a) => (
                <th key={a} scope="col">
                  {areaName[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary
              .filter((r) => areas.some((a) => r.counts[a] > 0))
              .map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    <span
                      aria-hidden
                      className={`${styles.swatch} ${r.token ? '' : styles.empty}`}
                      style={r.token ? { background: `var(${r.token})` } : undefined}
                    />
                    {r.label}
                  </th>
                  {areas.map((a) => (
                    <td key={a}>{r.counts[a].toLocaleString()}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <fieldset className={styles.picker}>
        <legend>Inspect a cell</legend>
        <NumberField label="Row" max={rows} value={row} onCommit={(r) => go(r, column)} />
        <NumberField label="Column" max={columns} value={column} onCommit={(c) => go(row, c)} />
        <div className={styles.pickerActions}>
          <button type="button" onClick={() => step(-1)} disabled={first === null}>
            Previous cell with data
          </button>
          <button type="button" onClick={() => step(1)} disabled={first === null}>
            Next cell with data
          </button>
          {onShowOnMap && current !== null && (
            <button type="button" onClick={() => onShowOnMap(current)}>
              Show on map
            </button>
          )}
        </div>
      </fieldset>
      <output className={styles.readout} aria-live="polite">
        {data.bundle && current !== null ? (
          <SpatialCellReadout data={data} index={current} year={timelineYear} />
        ) : described ? (
          <CellDetails cell={described} titleClassName={styles.tooltipTitle} />
        ) : (
          'This grid has no supplied cells.'
        )}
      </output>
    </section>
  );
}

/** A 1-based spinbutton that lets the field be empty while typing; commits valid numbers. */
function NumberField({
  label,
  max,
  value,
  onCommit,
}: {
  label: string;
  max: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<{ for: number; text: string } | null>(null);
  const text = draft && draft.for === value ? draft.text : String(value);
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={text}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n) && n >= 1 && n <= max) {
            setDraft(null);
            onCommit(n);
          } else setDraft({ for: value, text: e.target.value });
        }}
        onBlur={() => setDraft(null)}
      />
      <small>of {max}</small>
    </label>
  );
}
