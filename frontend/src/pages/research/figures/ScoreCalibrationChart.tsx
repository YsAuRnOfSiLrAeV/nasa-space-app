import { useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { AxisText } from '@/components/visualizations/svgAxes';
import type { CountryCalibration, Region } from '@/data/calibrationEvidence';
import { useElementWidth } from '@/hooks/useElementWidth';
import { verdict } from './scoreVerdict';
import styles from '../research.module.css';

const REGIONS: Record<Region, string> = {
  continental: 'Continental',
  mediterranean: 'Mediterranean',
  savanna: 'Savanna',
};

/** Where each country's label sits relative to its mark, so close marks do not collide. */
const LABEL: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' }> = {
  Canada: { dx: 9, dy: -7, anchor: 'start' },
  Greece: { dx: -9, dy: 12, anchor: 'end' },
  Turkey: { dx: 9, dy: 13, anchor: 'start' },
  Ukraine: { dx: 9, dy: 12, anchor: 'start' },
  Zambia: { dx: 9, dy: 4, anchor: 'start' },
  Tanzania: { dx: -9, dy: -6, anchor: 'end' },
  USA: { dx: 9, dy: 4, anchor: 'start' },
  Spain: { dx: 9, dy: 12, anchor: 'start' },
};

const DOMAIN: [number, number] = [0.4, 1];
const TICKS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const M = { top: 14, right: 16, bottom: 44, left: 48 };

function Mark({ region, x, y }: { region: Region; x: number; y: number }) {
  const common = { fill: 'var(--evidence-model)', stroke: 'var(--background)', strokeWidth: 2 };
  if (region === 'continental') return <circle cx={x} cy={y} r={5.5} {...common} />;
  if (region === 'mediterranean')
    return <rect x={x - 5} y={y - 5} width={10} height={10} {...common} />;
  return (
    <rect
      x={x - 5}
      y={y - 5}
      width={10}
      height={10}
      transform={`rotate(45 ${x} ${y})`}
      {...common}
    />
  );
}

/**
 * Chapter 4: mean relative score against the real share of forest above 5 m, one
 * mark per country (shape = region), with the diagonal a calibrated probability
 * would follow. The axes start at 0.4 to separate the marks; this is a scatter,
 * so no bar length is distorted.
 */
export function ScoreCalibrationChart({ rows }: { rows: CountryCalibration[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const size = Math.min(460, Math.max(280, useElementWidth(ref) || 460));
  const x = scaleLinear()
    .domain(DOMAIN)
    .range([M.left, size - M.right]);
  const y = scaleLinear()
    .domain(DOMAIN)
    .range([size - M.bottom, M.top]);
  return (
    <div className={styles.calibration}>
      <div ref={ref} className={styles.calibrationPlot}>
        <ul className={styles.shapeKey} aria-label="Legend">
          {(Object.keys(REGIONS) as Region[]).map((r) => (
            <li key={r}>
              <svg width={14} height={14} aria-hidden>
                <Mark region={r} x={7} y={7} />
              </svg>
              {REGIONS[r]}
            </li>
          ))}
          <li>
            <svg width={18} height={14} aria-hidden>
              <line
                x1={0}
                x2={18}
                y1={12}
                y2={2}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
              />
            </svg>
            Calibrated probability
          </li>
        </ul>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`Mean relative score against the real share of GEDI points taller than 5 m. ${rows
            .map((r) => `${r.country}: score ${r.meanScore}, real share ${r.actualShare}.`)
            .join(' ')}`}
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={M.top}
                y2={size - M.bottom}
                stroke="var(--rule)"
                strokeDasharray="var(--chart-grid-dash)"
              />
              <line
                x1={M.left}
                x2={size - M.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--rule)"
                strokeDasharray="var(--chart-grid-dash)"
              />
              <AxisText x={x(t)} y={size - M.bottom + 15}>
                {t.toFixed(1)}
              </AxisText>
              <AxisText x={M.left - 7} y={y(t)} dy="0.32em" anchor="end">
                {t.toFixed(1)}
              </AxisText>
            </g>
          ))}
          <line
            x1={x(DOMAIN[0])}
            y1={y(DOMAIN[0])}
            x2={x(DOMAIN[1])}
            y2={y(DOMAIN[1])}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
          />
          <AxisText x={(M.left + size - M.right) / 2} y={size - 8}>
            Mean relative score (p_forest_gt5)
          </AxisText>
          <text
            transform={`translate(12 ${(M.top + size - M.bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted-foreground)"
            style={{ fontFamily: 'var(--font-data)' }}
          >
            Real share of GEDI points above 5 m
          </text>
          <AxisText x={x(0.47)} y={y(0.93)} anchor="start">
            score too low ↑
          </AxisText>
          <AxisText x={x(0.99)} y={y(0.47)} anchor="end">
            score too high ↓
          </AxisText>
          {rows.map((r) => {
            const l = LABEL[r.country] ?? { dx: 9, dy: 4, anchor: 'start' as const };
            const cx = x(r.meanScore);
            const cy = y(r.actualShare);
            return (
              <g key={r.country}>
                <title>{`${r.country}: mean score ${r.meanScore.toFixed(2)}, real share ${r.actualShare.toFixed(2)}, AUC ${r.auc.toFixed(2)}`}</title>
                <Mark region={r.region} x={cx} y={cy} />
                <text
                  x={cx + l.dx}
                  y={cy + l.dy}
                  textAnchor={l.anchor}
                  fontSize={11}
                  fill="var(--foreground)"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  {r.country}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.dataTable}>
          <caption>
            Each country tested with a model trained elsewhere. Ranking skill (AUC): 0.5 is chance,
            1 is perfect. Probability error (Brier score): lower is better; if it is not below the
            base rate’s, the score adds nothing as a probability.
          </caption>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Real share</th>
              <th scope="col">Mean score</th>
              <th scope="col">Ranking skill (AUC)</th>
              <th scope="col">Probability error (base rate)</th>
              <th scope="col">As a probability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.country}>
                <th scope="row">
                  {r.country}
                  <small>{REGIONS[r.region]}</small>
                </th>
                <td>{r.actualShare.toFixed(2)}</td>
                <td>{r.meanScore.toFixed(2)}</td>
                <td>{r.auc.toFixed(2)}</td>
                <td>
                  {r.brier.toFixed(3)} ({r.brierNull.toFixed(3)})
                </td>
                <td>{verdict(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
