import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { BurnGroup } from '@/domain/study/burnGroups';
import { groupRecovery, type GroupRecovery } from '@/domain/study/recovery';
import { APP_TITLE } from '@/components/shell/brand';
import type { StudyView } from '@/domain/study/studyView';
import { useRecoveryData, type RecoveryDataState } from '@/hooks/useRecoveryData';

export interface RecoveryGroup {
  /** The group's measured summary; null until the study data exists. */
  r: GroupRecovery | null;
  /** The URL named a group that does not exist; the largest group is shown instead. */
  notFound: boolean;
  landsatState: RecoveryDataState;
  /** The page's scroll container and main heading: reset and focused on every group change. */
  scrollRef: RefObject<HTMLDivElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * Resolves the group named in the URL, loads its optional Landsat file, and
 * keeps the document title, scroll position and focus in step with it.
 */
export function useRecoveryGroup(study: StudyView | null, groupId: string | null): RecoveryGroup {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requested: BurnGroup | undefined =
    study && groupId ? study.burnGroups.find((g) => g.id === groupId) : undefined;
  const group = requested ?? study?.burnGroups[0] ?? null;
  const r = useMemo(
    () => (group && study ? groupRecovery(group, study.located) : null),
    [group, study],
  );
  const { state: landsatState } = useRecoveryData(group?.id ?? null);

  useEffect(() => {
    document.title = group ? `Recovery · burned ${group.fireYear} · ${APP_TITLE}` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [group]);

  // A new page or group starts at the top, with focus on its heading.
  const shownId = group?.id;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [shownId]);

  return {
    r,
    notFound: Boolean(study && groupId && !requested),
    landsatState,
    scrollRef,
    headingRef,
  };
}
