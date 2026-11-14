import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PointProperties } from '@/data/schema';
import { rankSignals } from '@/components/study/signalEvidence';
import { SignalHeightPanel } from './SignalHeightPanel';

/**
 * "Which signal tracks canopy height?" as small multiples ordered by ρ, computed live
 * from the loaded points (not hardcoded), so it updates when regions are added.
 * `stack` suits a narrow panel; `row` sets the panels side by side on a wide page.
 */
export function SignalEvidence({
  points,
  layout = 'stack',
}: {
  points: PointProperties[];
  layout?: 'stack' | 'row';
}) {
  const ranked = useMemo(() => rankSignals(points), [points]);

  return (
    <section aria-labelledby="signal-evidence-title" className="space-y-4">
      <div>
        <h2 id="signal-evidence-title" className="font-heading text-sm font-medium">
          Which signal tracks canopy height?
        </h2>
        <p className="prose-text mt-1 text-xs">
          GEDI lidar height vs satellite signal, all {points.length} points. Spearman ρ: higher
          means a stronger monotone link. Dashed lines mark the 5 m and 10 m stage breaks.
        </p>
      </div>
      <div className={cn(layout === 'row' ? 'grid gap-x-8 gap-y-6 md:grid-cols-3' : 'space-y-4')}>
        {ranked.map(({ signal, rho }, i) => (
          <SignalHeightPanel
            key={signal.key}
            points={points}
            signal={signal}
            rho={rho}
            highlight={i === 0}
          />
        ))}
      </div>
    </section>
  );
}
