import { recoveryHref } from '@/app/route';
import ui from '@/components/shell/primitives.module.css';
import type { BurnGroup } from '@/domain/study/burnGroups';
import { groupRecovery, observationTimeline } from '@/domain/study/recovery';
import type { StudyView } from '@/domain/study/studyView';
import { useRecoveryData } from '@/hooks/useRecoveryData';
import { cn } from '@/lib/utils';
import { ImageryExplorer } from '@/pages/recovery/ImageryExplorer';
import { ObservationTimeline } from '@/pages/recovery/ObservationTimeline';
import { OpticalHistory } from '@/pages/recovery/OpticalHistory';
import { RecoveryAcrossAges } from '@/pages/recovery/RecoveryAcrossAges';
import { WithLandsat } from '@/pages/recovery/WithLandsat';
import { useMemo, type ReactNode } from 'react';
import { Prose } from './Prose';
import { SamplingGroupPicker } from './SamplingGroupPicker';
import styles from './research.module.css';

/**
 * Observed recovery: the 2026 measurements across every fire age, then the
 * Landsat record of one sampling group. The charts are the Recovery page's own
 * components; a group is a set of sampled points, never a fire perimeter.
 */
export function ObservedRecoverySection({
  study,
  group,
  onPick,
}: {
  study: StudyView;
  group: BurnGroup;
  onPick: (groupId: string) => void;
}) {
  const r = useMemo(() => groupRecovery(group, study.located), [group, study.located]);
  const { state: landsatState } = useRecoveryData(group.id);
  const fire = group.fireYear;

  return (
    <div className="space-y-12">
      <Part title="Across fire ages" meta="Space-for-time">
        <Prose>
          Each column is a different burn group, ordered by years since the fire, with unburned
          forest on the right for comparison. Reading left to right compares places of different
          age; it is not one forest measured over time. Greenness and C-band radar respond to any
          vegetation, so a high value does not by itself mean the trees have returned.
        </Prose>
        <RecoveryAcrossAges study={study} groupId={group.id} />
      </Part>

      <div className="space-y-5">
        <Prose>
          The record below belongs to one sampling group: the points that burned in the same year
          within one 0.25° cell. Groups are sets of sampled points, not fire perimeters.
        </Prose>
        <SamplingGroupPicker
          groups={study.burnGroups}
          currentId={group.id}
          onPick={onPick}
          label="Sampling group for the Landsat record"
        />
        <p className="text-sm text-foreground">
          Sampling group {group.label}: {group.count} points burned in {fire}.
        </p>
      </div>

      {/* Keyed by group: each group's scene and year choices start fresh. */}
      <div key={group.id} className={cn('grid gap-x-10 gap-y-10 lg:grid-cols-2', styles.swap)}>
        <Part title="Satellite imagery" meta="Landsat · before / after">
          <WithLandsat
            state={landsatState}
            what="satellite imagery"
            variant="panel"
            absent={`Landsat scenes from before ${fire} and after it exist in the public USGS archive, but they have not been fetched for this group. Nothing is shown in their place.`}
          >
            {(landsat) => <ImageryExplorer landsat={landsat} points={r.points} />}
          </WithLandsat>
        </Part>
        <Part title="Greenness history" meta="Optical NDVI · summer">
          <OpticalHistory groupId={group.id} landsatState={landsatState} />
        </Part>
      </div>

      <Part title="Observation timeline" meta="Observed years only">
        <Prose>
          A marker means a measurement exists for that year. GEDI, Sentinel and NISAR measured each
          point once; Landsat adds a summer value only for years with a clear scene.
        </Prose>
        <ObservationTimeline
          lanes={observationTimeline(
            r,
            study.manifest,
            landsatState.status === 'ready' ? landsatState.data : null,
          )}
          fireYear={fire}
          endYear={study.manifest.reference_year}
        />
      </Part>

      <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <li>
          <a href={recoveryHref(group.id)} className={ui.ghost}>
            Full evidence for group {group.label}
          </a>
        </li>
        <li className="flex flex-wrap items-center gap-3">
          <a href={recoveryHref(group.id, 'growth')} className={ui.ghost}>
            Explore forest growth
          </a>
          <span className={ui.micro}>Illustration · not measured</span>
        </li>
      </ul>
    </div>
  );
}

/** A titled part of the section, one level below the numbered heading. */
function Part({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-5">
      <h3 className="flex items-baseline gap-3 type-section text-sm font-medium text-foreground">
        {title}
        <span aria-hidden className={ui.micro}>
          {meta}
        </span>
      </h3>
      {children}
    </section>
  );
}
