import { EXPLORE_HREF, mapHref } from '@/app/route';
import { useMapNavigation } from '@/app/mapNavigation';
import { PageIntro, PageLayout } from '@/components/shell/PageLayout';
import { PendingNote } from '@/components/shell/PendingNote';
import ui from '@/components/shell/primitives.module.css';
import { useFireData } from '@/hooks/useFireData';
import { FireRecovery } from './FireRecovery';
import styles from './Fire.module.css';

/** A no-break space (written as a code so the source stays ASCII-clean). */
const NBSP = String.fromCharCode(0xa0);

export function FirePage({ fireId, embedded = false }: { fireId: string; embedded?: boolean }) {
  const { state, retry } = useFireData(fireId);
  const mapState = useMapNavigation();
  const result = state.status === 'ready' ? state.data.result : null;
  const content = (
    <>
      <PageIntro
        className={styles.intro}
        eyebrow="Forest recovery"
        // Non-breaking around the separator: the year never wraps away from the name.
        title={
          result ? `${result.fire.name.en}${NBSP}·${NBSP}${result.fire.year}` : 'Fire recovery'
        }
      >
        <p className="type-coord text-sm break-all text-muted-foreground">{fireId} · Canada</p>
        <p>
          <a
            href={
              embedded
                ? mapHref({ ...mapState, presentation: 'explore', fireId: null })
                : EXPLORE_HREF
            }
            className={ui.ghost}
          >
            Back to Map
          </a>
        </p>
      </PageIntro>
      {state.status === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading the fire result and recovery grid…
        </p>
      )}
      {state.status === 'absent' && (
        <PendingNote label="Fire not found">
          This fire is not listed in the available demonstration catalog. Return to Explore to
          choose an available fire.
        </PendingNote>
      )}
      {state.status === 'error' && (
        <div role="alert" className="space-y-4">
          <p>{state.message}</p>
          <button type="button" className={ui.ghost} onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {state.status === 'ready' && <FireRecovery data={state.data} />}
    </>
  );
  return embedded ? (
    <section aria-label="Selected fire recovery">{content}</section>
  ) : (
    <PageLayout section="explore">{content}</PageLayout>
  );
}
