import { EXPLORE_HREF } from '@/app/route';
import { FigureRow } from '@/components/shell/FigureRow';
import { StudyStateView } from '@/components/shell/StudyStateView';
import ui from '@/components/shell/primitives.module.css';
import { ChartLegend } from '@/components/visualizations/ChartLegend';
import { HeightDistribution } from '@/components/visualizations/HeightDistribution';
import { ForestPointCloud } from '@/compositions/earth-intelligence/ForestPointCloud';
import { formatYearRange, gediYearRange } from '@/data/sources';
import type { BurnGroup } from '@/domain/study/burnGroups';
import type { StudyLoad, StudyView } from '@/domain/study/studyView';
import recovery from '@/pages/recovery/Recovery.module.css';
import { type ReactNode } from 'react';
import { Prose } from './Prose';
import { SamplingGroupPicker } from './SamplingGroupPicker';

export type ResearchSample = (render: (study: StudyView) => ReactNode) => ReactNode;
export interface ResearchSelection {
  sample: ResearchSample;
  group: BurnGroup | null;
  onPick: (groupId: string) => void;
}

/** Supporting charts need the Ontario sample; the chapters above do not. */
export function SampleUnavailable({ load }: { load: StudyLoad }) {
  return (
    <div className="max-w-[32rem] space-y-3">
      <Prose>
        {load.status === 'loading'
          ? 'Loading the Ontario study sample…'
          : 'The Ontario study sample could not be loaded. The chapter’s calibration evidence above does not depend on it.'}
      </Prose>
      <StudyStateView load={load} />
    </div>
  );
}

/** The sample points as lidar footprints, and what makes them the reference. */
export function GediReference({
  study,
  group,
  onPick,
}: {
  study: StudyView;
  group: BurnGroup | null;
  onPick: (groupId: string) => void;
}) {
  const { counts, reference_year } = study.manifest;
  const gediYears = gediYearRange(study.points);
  return (
    <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Prose>
          Every sample point is one GEDI footprint, drawn at its true position up to its measured
          canopy height. These heights are observations, not model output, and they are the
          reference each satellite signal is compared against.
        </Prose>
        <Prose>
          {gediYears && `GEDI measured these footprints in ${formatYearRange(gediYears)}; `}
          {gediYears ? 'the' : 'The'} radar and optical values are from summer {reference_year}. The
          same points are on the map in{' '}
          <a href={EXPLORE_HREF} className={recovery.link}>
            Explore
          </a>
          .
        </Prose>
        <FigureRow
          figures={[
            { id: 'points', value: String(counts.points), label: 'footprints' },
            { id: 'burned', value: String(counts.burned), label: 'burned' },
            { id: 'unburned', value: String(counts.unburned), label: 'unburned reference' },
          ]}
        />
      </div>
      <div className="min-w-0 space-y-4">
        {group && (
          <SamplingGroupPicker
            groups={study.burnGroups}
            currentId={group.id}
            onPick={onPick}
            label="Sampling group highlighted in the point cloud"
          />
        )}
        <ForestPointCloud located={study.located} focus={group} animate />
      </div>
    </div>
  );
}

const STAGE_LABELS = ['Under 5 m', '5–10 m', '10 m and taller'];

/** The measured heights, and how many points fall in each height stage. */
export function HeightStages({ study }: { study: StudyView }) {
  return (
    <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <HeightDistribution points={study.points} />
      <div className="space-y-5">
        <Prose>
          GEDI lidar observations in 1 m bins, not model predictions. Dashed lines mark the 5 m and
          10 m stage breaks.
        </Prose>
        <ChartLegend
          tone="plain"
          items={STAGE_LABELS.map((label, stage) => ({
            swatch: 'dot',
            color: `var(--stage-${stage})`,
            label: (
              <>
                {label}
                <span className={ui.micro}>
                  {' '}
                  · {study.manifest.counts.by_lidar_stage[stage]} pts
                </span>
              </>
            ),
          }))}
        />
      </div>
    </div>
  );
}
