import type { FireResult } from '@/data/fireSchema';
import { useFireObservations } from '@/hooks/useFireObservations';
import { ImageryExplorer } from '@/pages/recovery/ImageryExplorer';
import { NdviHistory } from '@/pages/recovery/NdviHistory';
import styles from './Fire.module.css';

/** Historical optical observations remain separate from the structural forecast. */
export function FireObservationHistory({ result }: { result: FireResult }) {
  const { state, retry } = useFireObservations(result);
  return (
    <section aria-labelledby="fire-optical-history-title">
      <h2 id="fire-optical-history-title" className={styles.sectionTitle}>
        Landsat imagery and greenness history
      </h2>
      {state.status === 'loading' && (
        <p role="status" className="text-sm">
          Loading this fire’s optical observations…
        </p>
      )}
      {state.status === 'absent' && (
        <div className={styles.notice}>
          <p>
            No Landsat observation record has been linked to {result.fire.name.en} (
            {result.fire.year}) yet.
          </p>
          <p className="mt-2">
            Before-and-after imagery and annual NDVI will appear here when matching observations are
            published. The supplied optical indicator above remains a separate summary.
          </p>
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className={styles.notice}>
          <p>{state.message}</p>
          <button type="button" className={styles.catalogRetry} onClick={retry}>
            Retry optical observations
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <div key={state.data.link.group_id} className="space-y-5">
          <div className={styles.notice}>
            <p>
              Observation record: sampling group{' '}
              <span className="font-mono">{state.data.link.group_id}</span> · fire year{' '}
              {state.data.record.fire_year}.
            </p>
            <p className="mt-2">{state.data.link.basis}</p>
            <p className="mt-2">
              NDVI summarizes sampled burned and reference locations, rather than every cell of the
              fire perimeter. These historical observations remain unchanged when you move the
              forecast slider.
            </p>
          </div>
          <section aria-labelledby="fire-landsat-title" className="min-w-0 space-y-5">
            <h3 id="fire-landsat-title" className="text-sm font-medium">
              Before-and-after Landsat comparison
            </h3>
            <ImageryExplorer landsat={state.data.record} points={[]} />
          </section>
          <section aria-labelledby="fire-ndvi-title" className="min-w-0 space-y-5">
            <h3 id="fire-ndvi-title" className="text-sm font-medium">
              Annual summer NDVI
            </h3>
            <NdviHistory landsat={state.data.record} />
          </section>
        </div>
      )}
    </section>
  );
}
