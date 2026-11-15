import type { HEIGHT_ACCURACY } from '@/data/calibrationEvidence';
import styles from '../research.module.css';
import { BarPanel, BarRow, BarScale } from './BarPanel';

const pct = (value: number, max: number) => `${(value / max) * 100}%`;

/**
 * Chapter 3: three small panels, each with its own axis and unit (never two scales
 * on one axis): mean absolute error in metres, R², and the point-level bias that
 * shows predictions compressed toward the mean.
 */
export function HeightAccuracyChart({ accuracy }: { accuracy: typeof HEIGHT_ACCURACY }) {
  const { point, fire } = accuracy;
  const MAE_MAX = 4;
  const BIAS_MAX = 8;
  return (
    <div className={styles.panels}>
      <BarPanel
        label="Mean absolute error in metres"
        title={<> Typical error </>}
        unit={<> mean absolute error (MAE), metres · lower is better </>}
      >
        <BarRow
          label={point.label}
          value={`${point.maeM.toFixed(1)} m`}
          width={pct(point.maeM, MAE_MAX)}
          tone="weak"
        />
        <BarRow
          label={fire.label}
          value={`${fire.maeM.toFixed(1)} m`}
          width={pct(fire.maeM, MAE_MAX)}
          marker={{
            at: pct(fire.baselineMaeM, MAE_MAX),
            label: `baseline ${fire.baselineMaeM.toFixed(1)} m`,
          }}
        />
        <BarScale ticks={['0', '1', '2', '3', '4 m']} />
      </BarPanel>

      <BarPanel
        label="R squared"
        title={<> Variation explained </>}
        unit={<> R², from 0 to 1 · 1 is perfect </>}
      >
        <BarRow
          label={point.label}
          value={point.r2.toFixed(2)}
          width={pct(point.r2, 1)}
          tone="weak"
        />
        <BarRow label={fire.label} value={fire.r2.toFixed(2)} width={pct(fire.r2, 1)} />
        <BarScale ticks={['0', '0.25', '0.5', '0.75', '1']} />
      </BarPanel>

      <BarPanel
        label="Point-level bias in metres by true height"
        title={<> Bias at point level </>}
        unit={<> metres · prediction minus GEDI </>}
      >
        <Diverging
          label="Short stands, under 5 m"
          value={point.biasLowM}
          max={BIAS_MAX}
          note="overestimated"
        />
        <Diverging
          label="Tall stands, 10 m and over"
          value={point.biasHighM}
          max={BIAS_MAX}
          note="underestimated"
        />
        <BarScale ticks={['−8', '−4', '0', '+4', '+8 m']} />
      </BarPanel>
    </div>
  );
}

function Diverging({
  label,
  value,
  max,
  note,
}: {
  label: string;
  value: number;
  max: number;
  note: string;
}) {
  const half = `${(Math.abs(value) / max) * 50}%`;
  return (
    <div className={styles.barRow}>
      <p>
        {label}{' '}
        <b>
          {value > 0 ? '+' : '−'}
          {Math.abs(value).toFixed(1)} m
        </b>{' '}
        <small>{note}</small>
      </p>
      <div className={styles.track} data-diverging>
        <span
          className={styles.fill}
          style={value >= 0 ? { left: '50%', width: half } : { right: '50%', width: half }}
        />
      </div>
    </div>
  );
}
