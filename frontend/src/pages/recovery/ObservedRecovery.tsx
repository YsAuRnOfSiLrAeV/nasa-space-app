import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import { NumberedSection } from '@/components/shell/NumberedSection';
import { observationTimeline, type GroupRecovery } from '@/components/study/recovery';
import { SourcesList } from '@/components/study/SourcesList';
import type { StudyView } from '@/components/study/studyView';
import type { RecoveryDataState } from '@/hooks/useRecoveryData';
import { PreFireCover } from './GroupEvidence';
import { ImageryExplorer } from './ImageryExplorer';
import { OpticalHistory } from './OpticalHistory';
import { ObservationTimeline } from './ObservationTimeline';
import { RecoveryAcrossAges } from './RecoveryAcrossAges';
import { SectionNote } from './SectionNote';
import { Reveal } from '@/components/shell/Reveal';
import { WithLandsat } from './WithLandsat';

/** The evidence view: everything shown is measured; missing data is stated, never filled in. */
export function ObservedRecovery({
  r,
  study,
  landsatState,
}: {
  r: GroupRecovery;
  study: StudyView;
  landsatState: RecoveryDataState;
}) {
  const fire = r.group.fireYear;
  return (
    <>
      <div className="mt-10 grid gap-x-10 gap-y-10 md:mt-12 lg:grid-cols-2">
        <Reveal>
          <NumberedSection n="01" title="Before the fire" meta="MODIS 2001 · Hansen 2000">
            <PreFireCover r={r} />
          </NumberedSection>
        </Reveal>
        <Reveal delay={120}>
          <NumberedSection n="02" title="Satellite imagery" meta="Landsat · before / after">
            <WithLandsat
              state={landsatState}
              what="satellite imagery"
              variant="panel"
              absent={`Landsat scenes from before ${fire} and after it exist in the public USGS archive, but they have not been fetched for this group. Nothing is shown in their place.`}
            >
              {(landsat) => <ImageryExplorer landsat={landsat} points={r.points} />}
            </WithLandsat>
          </NumberedSection>
        </Reveal>
      </div>

      <Reveal className="mt-14 md:mt-16">
        <NumberedSection n="03" title="Greenness history" meta="Optical NDVI · summer">
          <OpticalHistory key={r.group.id} groupId={r.group.id} landsatState={landsatState} />
        </NumberedSection>
      </Reveal>

      <Reveal className="mt-14 md:mt-16">
        <NumberedSection n="04" title="Observation timeline" meta="Observed years only">
          <SectionNote>
            A marker means a measurement exists for that year. GEDI, Sentinel and NISAR measured
            each point once; Landsat adds a summer value only for years with a clear scene.
          </SectionNote>
          <ObservationTimeline
            lanes={observationTimeline(
              r,
              study.manifest,
              landsatState.status === 'ready' ? landsatState.data : null,
            )}
            fireYear={fire}
            endYear={study.manifest.reference_year}
          />
        </NumberedSection>
      </Reveal>

      <Reveal className="mt-14 md:mt-16">
        <NumberedSection n="05" title="Recovery across fire ages" meta="Space-for-time">
          <SectionNote>
            Each column is a different burn group, ordered by years since the fire, with unburned
            forest on the right for comparison. Reading left to right compares places of different
            age; it is not one forest measured over time. Greenness and C-band radar respond to any
            vegetation, so a high value does not by itself mean the trees have returned.
          </SectionNote>
          <RecoveryAcrossAges study={study} groupId={r.group.id} />
        </NumberedSection>
      </Reveal>

      <Reveal className="mt-14 md:mt-16">
        <NumberedSection n="06" title="Sources and limits">
          <details>
            <summary className={cn(ui.micro, 'cursor-pointer')}>
              Datasets, credits and known limitations
            </summary>
            <SourcesList
              manifest={study.manifest}
              points={study.points}
              className="mt-4 max-w-[46rem]"
            />
          </details>
        </NumberedSection>
      </Reveal>
    </>
  );
}
