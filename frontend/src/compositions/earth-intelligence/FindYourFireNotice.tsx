import { mapHref } from '@/app/route';
import { useResource } from '@/hooks/useResource';
import { backendApi } from '@/services/api';
import type { BackendStatus } from '@/services/api';
import styles from './MapShell.module.css';

function availability(status: BackendStatus | null): string {
  if (!status) return 'Checking backend availability…';
  switch (status.state) {
    case 'online':
      return 'Backend online. Its health check is available; fire processing is not connected.';
    case 'not-configured':
      return 'Backend not configured. Calculation is currently unavailable.';
    case 'offline':
      return `Backend unavailable: ${status.reason}. Calculation is currently unavailable.`;
  }
}

/** Find Your Fire, before processing is connected: what is missing and the backend's state. */
export function FindYourFireNotice() {
  const backend = useResource('backend-status', (signal) => backendApi.status(signal));
  return (
    <>
      <p>
        Selecting a catalog fire and processing it will be available here. Search and polygon
        drawing are not connected in this phase.
      </p>
      <div role="status" className={styles.note}>
        {availability(
          backend.state.status === 'ready'
            ? backend.state.data
            : backend.state.status === 'error'
              ? { state: 'offline', reason: backend.state.message }
              : null,
        )}
      </div>
      <button type="button" onClick={backend.retry}>
        Check backend again
      </button>
      <a
        className={styles.action}
        href={mapHref({ mode: 'examples', presentation: 'explore', fireId: null })}
      >
        View example fires
      </a>
    </>
  );
}
