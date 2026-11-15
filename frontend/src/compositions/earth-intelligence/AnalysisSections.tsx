import { recoveryHref } from '@/app/route';
import { NumberedSection } from '@/components/shell/NumberedSection';
import { HeightDistribution } from '@/components/visualizations/HeightDistribution';
import { SignalEvidence } from '@/components/visualizations/SignalEvidence';
import { cn } from '@/lib/utils';
import type { StudyView } from '../types';
import type { BurnFocus, SiteSelection } from './useEarthView';
import primitives from '@/components/shell/primitives.module.css';
import { BurnRegister } from './BurnRegister';
import { ForestPointCloud } from './ForestPointCloud';
import { SiteReadout } from './SiteReadout';

export function AnalysisSections({
  study,
  selection,
  burn,
  animate,
}: {
  study: StudyView;
  selection: SiteSelection;
  burn: BurnFocus;
  animate: boolean;
}) {
  return (
    <>
      <NumberedSection n="01" title="Fire years" meta="MODIS MCD64A1">
        <BurnRegister
          groups={study.burnGroups}
          focusId={burn.group?.id ?? null}
          onLocate={burn.locate}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Pick a year to fly to it. Groups of sampled points by fire year and 0.25° cell, not fire
          perimeters. Age is counted to the 2026 radar acquisitions.
        </p>
        {burn.group && (
          <a href={recoveryHref(burn.group.id)} className={cn(primitives.ghost, 'mt-3')}>
            Recovery evidence for {burn.group.label} <span aria-hidden>↗</span>
          </a>
        )}
      </NumberedSection>
      <NumberedSection n="02" title="Forest in 3D" meta="GEDI L2A · rh98">
        <ForestPointCloud located={study.located} focus={burn.group} animate={animate} />
      </NumberedSection>
      <NumberedSection n="03" title="Canopy height" meta="1 m bins">
        <HeightDistribution points={study.points} />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          GEDI lidar observations in 1 m bins, not model predictions. Dashed lines mark the 5 m and
          10 m stage breaks.
        </p>
      </NumberedSection>
      <NumberedSection n="04" title="Signal response" meta="Spearman ρ">
        <SignalEvidence points={study.points} />
      </NumberedSection>
      <NumberedSection n="05" title="Site readout" meta="Select on map">
        <SiteReadout
          point={selection.point}
          index={selection.index}
          total={selection.total}
          onStep={selection.step}
        />
      </NumberedSection>
    </>
  );
}
