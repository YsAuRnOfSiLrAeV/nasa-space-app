import { useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { AxisText } from '@/components/visualizations/svgAxes';
import type { DemoFireComparison } from '@/data/calibrationEvidence';
import { useElementWidth } from '@/hooks/useElementWidth';
import { KindMark } from '../ChapterFrame';
import styles from '../research.module.css';

const BARS = [
  { key: 'optical', label: 'Optical proxy', color: 'var(--evidence-optical)' },
  { key: 'modelCalibrated', label: 'Calibrated model', color: 'var(--evidence-model)' },
] as const;

const BAR = 12;
const BAR_GAP = 5;
const HEAD = 18;
const GROUP = HEAD + BARS.length * BAR + BAR_GAP;
const GROUP_GAP = 34;
const TOP = 6;
const BOTTOM = 30;

/**
 * Chapter 1: two readings of each fire's recovery as bars, measured against the
 * GEDI reference drawn as a line across them. The reference is a different kind of
 * number from the two readings, so it is a different kind of mark. One 0–100% axis;
 * every mark carries its value; the full table is in the supporting material.
 */
export function RecoveryComparisonChart({
  rows,
  notes = {},
}: {
  rows: DemoFireComparison[];
  /** A short annotation beside a fire's model bar, keyed by fire name. */
  notes?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(280, useElementWidth(ref) || 720);
  const narrow = width < 520;
  const left = narrow ? 0 : 160;
  const right = width - 44;
  const x = scaleLinear().domain([0, 100]).range([left, right]);
  const group = GROUP + (narrow ? 20 : 0);
  const height = TOP + rows.length * group + (rows.length - 1) * GROUP_GAP + BOTTOM;
  const plotBottom = height - BOTTOM;

  return (
    <div className={styles.chartStack}>
      <ul className={styles.legend} aria-label="Legend">
        <li>
          <span aria-hidden className={styles.legendBar} style={{ background: BARS[0].color }} />
          <KindMark kind="observation" label="Optical proxy (NDVI rule, provisional)" />
        </li>
        <li>
          <span aria-hidden className={styles.legendBar} style={{ background: BARS[1].color }} />
          <KindMark kind="estimate" label="Calibrated model" />
        </li>
        <li>
          <span aria-hidden className={styles.legendLine} />
          <KindMark kind="reference" label="GEDI lidar" />
        </li>
      </ul>
      <div ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Recovery as a percentage of the neighbouring forest's height. ${rows
            .map(
              (r) =>
                `${r.fire}: optical proxy ${r.optical}%, calibrated model ${r.modelCalibrated}%, GEDI ${r.gedi}%.`,
            )
            .join(' ')}`}
        >
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={TOP}
                y2={plotBottom + 4}
                stroke="var(--rule)"
                strokeDasharray={t === 0 || t === 100 ? undefined : 'var(--chart-grid-dash)'}
              />
              <AxisText x={x(t)} y={plotBottom + 17}>
                {t}%
              </AxisText>
            </g>
          ))}
          <AxisText x={right} y={height - 1} anchor="end">
            % of neighbouring forest height
          </AxisText>
          {rows.map((row, i) => {
            const y0 = TOP + i * (group + GROUP_GAP);
            const bars0 = y0 + (narrow ? 20 : 0) + HEAD;
            const gx = x(row.gedi);
            return (
              <g key={row.fire} data-fire={row.fire}>
                <text
                  x={0}
                  y={narrow ? y0 + 12 : bars0 + 11}
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--foreground)"
                  style={{ fontFamily: 'var(--font-section)' }}
                >
                  {row.fire}
                </text>
                <AxisText
                  x={narrow ? right : 0}
                  y={narrow ? y0 + 12 : bars0 + 26}
                  anchor={narrow ? 'end' : 'start'}
                >
                  {`ref. forest ${row.neighbourM.toFixed(1)} m`}
                </AxisText>
                {BARS.map((s, j) => {
                  const value = row[s.key];
                  const y = bars0 + j * (BAR + BAR_GAP);
                  const note = s.key === 'modelCalibrated' ? notes[row.fire] : undefined;
                  return (
                    <g key={s.key} data-series={s.key}>
                      <title>{`${row.fire} · ${s.label}: ${value}%`}</title>
                      <rect x={x(0)} y={y} width={x(value) - x(0)} height={BAR} fill={s.color} />
                      <text
                        // A label that would sit under the GEDI line moves past it.
                        x={gx > x(value) - 3 && gx < x(value) + 36 ? gx + 8 : x(value) + 6}
                        y={y + BAR - 1.5}
                        fontSize={11}
                        fontWeight={600}
                        fill="var(--foreground)"
                        style={{ fontFamily: 'var(--font-data)' }}
                      >
                        {value}%
                        {note && !narrow && (
                          <tspan fontWeight={400} fill="var(--muted-foreground)">
                            {`  ${note}`}
                          </tspan>
                        )}
                      </text>
                    </g>
                  );
                })}
                <g data-series="gedi">
                  <title>{`${row.fire} · GEDI lidar: ${row.gedi}%`}</title>
                  <line
                    x1={gx}
                    x2={gx}
                    y1={bars0 - 5}
                    y2={bars0 + BARS.length * BAR + BAR_GAP + 5}
                    stroke="var(--background)"
                    strokeWidth={5}
                  />
                  <line
                    x1={gx}
                    x2={gx}
                    y1={bars0 - 5}
                    y2={bars0 + BARS.length * BAR + BAR_GAP + 5}
                    stroke="var(--evidence-gedi)"
                    strokeWidth={2}
                  />
                  <text
                    x={gx}
                    y={bars0 - 9}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--foreground)"
                    style={{ fontFamily: 'var(--font-data)' }}
                  >
                    GEDI {row.gedi}%
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** One fire's three readings as a compact comparison, for the opening band. */
export function HeadlineComparison({ row, note }: { row: DemoFireComparison; note: string }) {
  const readings = [
    {
      kind: 'observation',
      label: 'Optical proxy',
      value: row.optical,
      color: 'var(--evidence-optical)',
    },
    {
      kind: 'estimate',
      label: 'Calibrated model',
      value: row.modelCalibrated,
      color: 'var(--evidence-model)',
    },
    { kind: 'reference', label: 'GEDI lidar', value: row.gedi, color: 'var(--evidence-gedi)' },
  ] as const;
  return (
    <figure className={styles.headline} aria-label={`${row.fire}: three readings of recovery`}>
      <ul>
        {readings.map((r) => (
          <li key={r.kind}>
            <KindMark kind={r.kind} label={r.label} />
            <span className={styles.headlineTrack} aria-hidden>
              <span style={{ width: `${r.value}%`, background: r.color }} />
            </span>
            <b>{r.value}%</b>
          </li>
        ))}
      </ul>
      <figcaption>{note}</figcaption>
    </figure>
  );
}

/** The same study values as a table, including the columns the chart leaves out. */
export function RecoveryComparisonTable({ rows }: { rows: DemoFireComparison[] }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <caption>
          Calibration-study values, % of neighbouring forest height (reference forest in metres).
        </caption>
        <thead>
          <tr>
            <th scope="col">Fire</th>
            <th scope="col">Reference forest, m</th>
            <th scope="col">Optical proxy, %</th>
            <th scope="col">Model (raw), %</th>
            <th scope="col">Model (calibrated), %</th>
            <th scope="col">GEDI, %</th>
            <th scope="col">GEDI points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fire}>
              <th scope="row">{r.fire}</th>
              <td>{r.neighbourM.toFixed(1)}</td>
              <td>{r.optical}</td>
              <td>{r.modelRaw}</td>
              <td>{r.modelCalibrated}</td>
              <td>{r.gedi}</td>
              <td>{r.gediPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
