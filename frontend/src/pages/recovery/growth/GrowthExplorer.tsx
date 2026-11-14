import { useMemo, useState } from 'react';
import type { RecoveryFile } from '@/data/recoverySchema';
import type { GroupRecovery } from '@/components/study/recovery';
import { illustrativeComposition } from '@/components/forest/composition';
import { MAX_YEAR, planForest, sceneAt, stageAt } from '@/components/forest/growth';
import { useMediaQuery, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { IllustrationPlate } from './IllustrationPlate';
import { ObservationRibbon, ObservationsForYear } from './ObservationsForYear';
import { PlaybackControls, YearScale, YearSlider } from './PlaybackControls';
import { SpeciesLegend } from './SpeciesLegend';
import { StageCard } from './StageCard';
import { useTween } from './useTween';
import { useYearPlayback } from './useYearPlayback';

/**
 * Explore forest growth: an illustrated boreal stand from the fire to year 30,
 * with the real observations for the matching calendar year beside it.
 */
export function GrowthExplorer({
  r,
  landsat,
  referenceYear,
}: {
  r: GroupRecovery;
  landsat: RecoveryFile | null;
  referenceYear: number;
}) {
  const fireYear = r.group.fireYear;
  const reduced = usePrefersReducedMotion();
  const composition = useMemo(() => illustrativeComposition(r.preFireClasses), [r.preFireClasses]);
  const plan = useMemo(() => planForest(r.group.id, composition.shares), [r.group.id, composition]);
  const playback = useYearPlayback(referenceYear - fireYear, MAX_YEAR);
  const year = playback.year;
  // In-scene names are legible only on wider screens; the species legend always identifies them.
  const wide = useMediaQuery('(min-width: 768px)');
  const [labelChoice, setLabels] = useState<boolean | null>(null);
  const labels = labelChoice ?? wide;
  const shown = useTween(year, reduced);
  const scene = useMemo(() => sceneAt(plan, shown), [plan, shown]);
  const stage = stageAt(year);
  const present = new Set(composition.shares.map((s) => s.id));
  const observed = { year, r, landsat, referenceYear };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <IllustrationPlate
            scene={scene}
            seed={plan.seed}
            labels={labels}
            year={year}
            fireYear={fireYear}
            stageTitle={stage.title}
          />
          <div className="space-y-2">
            <PlaybackControls playback={playback} labels={labels} onLabels={setLabels} />
            <YearSlider playback={playback} fireYear={fireYear} referenceYear={referenceYear} />
            <ObservationRibbon {...observed} />
            <YearScale fireYear={fireYear} referenceYear={referenceYear} max={MAX_YEAR} />
          </div>
        </div>
        <div className="space-y-4">
          <StageCard stage={stage} />
          <ObservationsForYear {...observed} />
        </div>
      </div>
      <SpeciesLegend present={present} basis={composition.basis} />
    </div>
  );
}
