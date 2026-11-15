import type { ScaleLinear } from 'd3-scale';
import type { NdviYear } from '@/data/recoverySchema';
import { consecutiveRuns } from '@/data/landsat';

type Series = 'burned' | 'reference';

/**
 * Line styles of the two NDVI series, shared by the full chart and the
 * headline sparkline: burned solid burgundy, unburned dashed green.
 * `spark` is the lighter weight used without axes.
 */
const STYLE: Record<'chart' | 'spark', Record<Series, { stroke: string; width: number }>> = {
  chart: {
    burned: { stroke: 'var(--burn)', width: 2 },
    reference: { stroke: 'var(--forest)', width: 2 },
  },
  spark: {
    burned: { stroke: 'var(--burn-text)', width: 2 },
    reference: { stroke: 'var(--forest)', width: 1.5 },
  },
};

/**
 * The burned and unburned NDVI lines, reference first so the burn group draws
 * on top. A year without a clear observation breaks the line (never bridged).
 */
export function NdviLines({
  rows,
  x,
  y,
  weight = 'chart',
}: {
  rows: NdviYear[];
  x: ScaleLinear<number, number>;
  y: ScaleLinear<number, number>;
  weight?: 'chart' | 'spark';
}) {
  return (
    <>
      {(['reference', 'burned'] as const).map((key) =>
        consecutiveRuns(rows, key).map((run, i) => (
          <path
            key={`${key}${i}`}
            d={run.map((r, k) => `${k ? 'L' : 'M'}${x(r.year)} ${y(r[key]!.median)}`).join('')}
            fill="none"
            stroke={STYLE[weight][key].stroke}
            strokeWidth={STYLE[weight][key].width}
            strokeDasharray={key === 'reference' ? '4 3' : undefined}
            strokeLinejoin="round"
            strokeLinecap={weight === 'spark' ? 'round' : undefined}
          />
        )),
      )}
    </>
  );
}
