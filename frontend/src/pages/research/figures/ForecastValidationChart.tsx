import { AxisText } from '@/components/visualizations/svgAxes';
import type { FORECAST_VALIDATION } from '@/data/calibrationEvidence';
import { recoveryAtAge } from '@/domain/fire/growthForecast';
import { scaleLinear } from 'd3-scale';
import styles from '../research.module.css';
import { BarPanel, BarRow, BarScale } from './BarPanel';

/**
 * Chapter 5: the three pieces of validation evidence, each on its own scale:
 * fire-level R² for the two growth models, interval coverage against its nominal
 * level, and the fire age beyond which a forecast is extrapolation.
 */
export function ForecastValidationChart({
  validation: v,
}: {
  validation: typeof FORECAST_VALIDATION;
}) {
  return (
    <div className={styles.panels}>
      <BarPanel
        label="Fire-level R squared of the growth models"
        title={<> Variation between fires explained </>}
        unit={<> R² · {v.fires} held-out fires · 1 is perfect </>}
      >
        <BarRow
          label="Comparison model"
          value={v.r2Comparison.toFixed(2)}
          width={v.r2Comparison * 100}
          tone="weak"
        />
        <BarRow
          label="Growth model with drivers"
          value={v.r2WithDrivers.toFixed(2)}
          width={v.r2WithDrivers * 100}
        />
        <BarScale ticks={['0', '0.25', '0.5', '0.75', '1']} />
      </BarPanel>

      <BarPanel
        label="Prediction interval coverage"
        title={<> Interval coverage </>}
        unit={<> share of held-out fires inside the interval </>}
      >
        <BarRow
          label="Observed coverage"
          value={`${v.observedCoveragePct}%`}
          width={v.observedCoveragePct}
          marker={{ at: `${v.nominalIntervalPct}%`, label: `nominal ${v.nominalIntervalPct}%` }}
        />
        <BarScale ticks={['0', '25', '50', '75', '100%']} />
        <p className={styles.panelNote}>
          Evidence about the method across fires. It is not an uncertainty interval for any one
          fire.
        </p>
      </BarPanel>

      <BarPanel
        label="Validated fire-age range"
        title={<> Fire age </>}
        unit={<> years since the fire </>}
      >
        <div className={styles.ageRibbon}>
          <span>
            <b>Up to {v.extrapolationBeyondYears} years</b>
            within the validated range
          </span>
          <span data-extrapolation>
            <b>Beyond {v.extrapolationBeyondYears} years</b>
            extrapolation
          </span>
        </div>
        <p className={styles.panelNote}>
          The {v.demoFiresInTraining} demonstration fires were in the growth model’s training data.
        </p>
      </BarPanel>
    </div>
  );
}

const W = 320;
const H = 170;
const P = { top: 12, right: 12, bottom: 30, left: 36 };

/**
 * The provisional curve's shape, with age in units of τ so that no fire-specific
 * number is implied. 80% falls at τ·ln 5 by the equation itself.
 */
export function ProvisionalCurve() {
  const x = scaleLinear()
    .domain([0, 3])
    .range([P.left, W - P.right]);
  const y = scaleLinear()
    .domain([0, 1])
    .range([H - P.bottom, P.top]);
  const path = Array.from({ length: 61 }, (_, i) => {
    const t = (i / 60) * 3;
    return `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(recoveryAtAge(t, 1)!).toFixed(1)}`;
  }).join('');
  const t80 = Math.log(5);
  return (
    <div className={styles.provisional}>
      <div>
        <p className={styles.tag} data-warning>
          Provisional · not confirmed by the model owner
        </p>
        <p className={styles.equation}>R(age) = 1 − exp(−age / τ)</p>
        <p>
          R is expected recovery as a share of the neighbouring forest’s height and τ a time
          constant exported per fire. The app infers this form from the exported parameters: it
          reproduces the exported years to 80% (τ · ln 5). It is an age-only curve, so a fire’s
          observed 2026 recovery estimate may sit above or below it.
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Shape of the provisional curve: recovery rises quickly, then levels off toward 100%, reaching 80% at about 1.6 times tau."
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={P.left}
              x2={W - P.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--rule)"
              strokeDasharray="var(--chart-grid-dash)"
            />
            <AxisText x={P.left - 6} y={y(t)} dy="0.32em" anchor="end">
              {`${t * 100}%`}
            </AxisText>
          </g>
        ))}
        {[0, 1, 2, 3].map((t) => (
          <AxisText key={t} x={x(t)} y={H - P.bottom + 14}>
            {t === 0 ? '0' : `${t}τ`}
          </AxisText>
        ))}
        <AxisText x={W - P.right} y={H - 2} anchor="end">
          fire age, in units of τ
        </AxisText>
        <line
          x1={P.left}
          x2={x(t80)}
          y1={y(0.8)}
          y2={y(0.8)}
          stroke="var(--muted-foreground)"
          strokeDasharray="2 3"
        />
        <line
          x1={x(t80)}
          x2={x(t80)}
          y1={y(0.8)}
          y2={H - P.bottom}
          stroke="var(--muted-foreground)"
          strokeDasharray="2 3"
        />
        <AxisText x={x(t80) + 5} y={y(0.8) + 13} anchor="start">
          80% at τ·ln 5
        </AxisText>
        <path
          d={path}
          fill="none"
          stroke="var(--evidence-model)"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </svg>
    </div>
  );
}
