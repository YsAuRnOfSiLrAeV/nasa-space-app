import { useState } from 'react';
import { EXPLORE_HREF, FOREST_3D_HREF } from '@/app/route';
import { FigureRow } from '@/components/shell/FigureRow';
import { NumberedSection } from '@/components/shell/NumberedSection';
import { PageIntro, PageLayout } from '@/components/shell/PageLayout';
import { Reveal } from '@/components/shell/Reveal';
import { StudyStateView } from '@/components/shell/StudyStateView';
import ui from '@/components/shell/primitives.module.css';
import { SourcesList } from '@/components/study/SourcesList';
import type { BurnGroup } from '@/components/study/burnGroups';
import type { StudyLoad, StudyView } from '@/components/study/studyView';
import { ChartLegend } from '@/components/visualizations/ChartLegend';
import { HeightDistribution } from '@/components/visualizations/HeightDistribution';
import { SignalEvidence } from '@/components/visualizations/SignalEvidence';
import { ForestPointCloud } from '@/compositions/earth-intelligence/ForestPointCloud';
import { Telemetry } from '@/compositions/earth-intelligence/Telemetry';
import { formatYearRange, gediYearRange } from '@/data/sources';
import recovery from '@/pages/recovery/Recovery.module.css';
import { ObservedRecoverySection } from './ObservedRecoverySection';
import { ResearchContents, type ContentsEntry } from './ResearchContents';
import { Prose } from './Prose';
import { SamplingGroupPicker } from './SamplingGroupPicker';
import styles from './research.module.css';

/**
 * Research and methodology: the study as one document. Every chart is an
 * existing component reading the loaded study data; the text explains what each
 * one shows and where it stops being evidence.
 */
export function ResearchPage({ load, study }: { load: StudyLoad; study: StudyView | null }) {
  return (
    <PageLayout section="research">
      <PageIntro eyebrow="Research and methodology" title="Green again is not forest again">
        <Prose>
          How can satellite observations tell whether a forest has recovered after a wildfire?
          Grasses and shrubs return quickly, and optical greenness returns with them, so a burn scar
          can look recovered long before trees have grown back.
        </Prose>
        <Prose>
          NISAR, the NASA–ISRO radar mission, observes at L-band, a wavelength that interacts with
          trunks and branches as well as leaves. GEDI, a lidar on the International Space Station,
          measures canopy height directly in small footprints. This page compares the satellite
          signals against GEDI height at the same points.
        </Prose>
        {study && <Telemetry figures={study.figures} className="pt-2" />}
        <a href={FOREST_3D_HREF} className={styles.cta}>
          <span>
            <b>Forest structure in 3D</b>
            <small>Conceptual illustration · orbit and zoom</small>
          </span>
          <span aria-hidden>→</span>
        </a>
      </PageIntro>
      {study ? (
        <ResearchSections study={study} />
      ) : (
        <div className="max-w-[32rem]">
          <StudyStateView load={load} />
          {load.status === 'loading' && (
            <p className="text-sm text-muted-foreground">Loading the study data…</p>
          )}
        </div>
      )}
    </PageLayout>
  );
}

const SECTION = 'mt-14 md:mt-16';

/** The document's sections, in order: their anchors, numbers and titles. */
const SECTIONS = {
  signal: { id: 'research-signal', n: '01', title: 'Radar signal evidence' },
  gedi: { id: 'research-gedi', n: '02', title: 'GEDI validation' },
  height: { id: 'research-height', n: '03', title: 'Forest height distribution' },
  recovery: { id: 'research-recovery', n: '04', title: 'Observed recovery' },
  sources: { id: 'research-sources', n: '05', title: 'Methodology and data sources' },
} satisfies Record<string, ContentsEntry>;

function ResearchSections({ study }: { study: StudyView }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  // Until a group is picked, the largest one: the same default as the Recovery page.
  const group = study.burnGroups.find((g) => g.id === pickedId) ?? study.burnGroups[0] ?? null;

  const contents = Object.values(SECTIONS).filter((s) => group || s !== SECTIONS.recovery);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_11rem] xl:gap-x-12">
      <div className="min-w-0">
        <Reveal>
          <NumberedSection {...SECTIONS.signal} meta="Spearman ρ">
            <Prose className="mb-5">
              Each panel plots one satellite signal against the GEDI canopy height of the same
              point. ρ describes how consistently the signal rises with height across this sample.
              It is an association in these points, in this region: radar backscatter is not a
              measurement of tree height.
            </Prose>
            <SignalEvidence points={study.points} layout="row" />
          </NumberedSection>
        </Reveal>

        <Reveal className={SECTION}>
          <NumberedSection {...SECTIONS.gedi} meta="GEDI L2A · rh98">
            <GediReference study={study} group={group} onPick={setPickedId} />
          </NumberedSection>
        </Reveal>

        <Reveal className={SECTION}>
          <NumberedSection {...SECTIONS.height} meta="1 m bins">
            <HeightStages study={study} />
          </NumberedSection>
        </Reveal>

        {group && (
          <Reveal className={SECTION}>
            <NumberedSection {...SECTIONS.recovery} meta="Sampling groups">
              <ObservedRecoverySection study={study} group={group} onPick={setPickedId} />
            </NumberedSection>
          </Reveal>
        )}

        <Reveal className={SECTION}>
          <NumberedSection {...SECTIONS.sources}>
            <Prose className="mb-5">
              Every dataset behind this page, with how it was processed, its credit and its known
              limits.
            </Prose>
            <SourcesList
              manifest={study.manifest}
              points={study.points}
              className="max-w-[46rem]"
            />
          </NumberedSection>
        </Reveal>
      </div>
      <ResearchContents entries={contents} className="sticky top-32 hidden self-start xl:block" />
    </div>
  );
}

/** The sample points as lidar footprints, and what makes them the reference. */
function GediReference({
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
function HeightStages({ study }: { study: StudyView }) {
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
