import { useState, type ReactNode, type RefObject } from 'react';
import { mapHref, type MapState } from '@/app/route';
import { config } from '@/config';
import type { DemoFire } from '@/data/fireSchema';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import type { FireCatalog } from '@/hooks/useFireCatalog';
import { MapSidePanel } from '../MapSidePanel';
import styles from './MapShell.module.css';

export function InvestigationPanel({
  state,
  catalog,
  onFireSelect,
  onPlanet,
  headingRef,
  children,
}: {
  state: MapState;
  catalog: FireCatalog;
  onFireSelect: (fire: DemoFire) => void;
  onPlanet: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const backend = useBackendStatus(state.mode === 'search');
  const selected = catalog.fires.find((fire) => fire.id === state.fireId);
  return (
    <MapSidePanel
      label="Fire investigation"
      className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}
      pinned={
        <div className={styles.panelHead}>
          <h2 ref={headingRef} tabIndex={-1}>
            {state.mode === 'examples' ? 'Example fires' : 'Find Your Fire'}
          </h2>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls="investigation-body"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? 'Expand panel' : 'Collapse panel'}
          </button>
        </div>
      }
    >
      <div id="investigation-body" hidden={collapsed} className={styles.panelBody}>
        <button type="button" className={styles.action} onClick={onPlanet}>
          Back to Globe
        </button>
        {state.mode === 'examples' ? (
          <>
            <p>
              {config.fireDataIsExample
                ? 'Documentation example. Calibrated team exports are not available yet.'
                : 'Published, precomputed fire results.'}
            </p>
            {catalog.status === 'loading' && <p role="status">Loading available fires…</p>}
            {catalog.status === 'error' && (
              <div role="alert">
                <p>The fire catalog could not be loaded.</p>
                <button type="button" onClick={catalog.retry}>
                  Retry catalog
                </button>
              </div>
            )}
            {catalog.status === 'ready' && catalog.fires.length === 0 && (
              <p role="status">
                No example fires have been published yet. The map remains available.
              </p>
            )}
            <ul className={styles.fireList} aria-label="Available example fires">
              {catalog.fires.map((fire) => (
                <li key={fire.id}>
                  <a
                    href={mapHref({ mode: 'examples', presentation: 'fire', fireId: fire.id })}
                    aria-current={fire.id === state.fireId ? 'true' : undefined}
                    onClick={(event) => {
                      if (
                        event.button ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      onFireSelect(fire);
                    }}
                  >
                    <span>
                      {fire.name.en} <small>· {fire.year}</small>
                    </span>
                    <small>
                      {fire.recovery_today_avg == null
                        ? 'Recovery not supplied'
                        : `${Math.round(fire.recovery_today_avg * 100)}% recovery`}{' '}
                      · Summer {fire.summer}
                    </small>
                  </a>
                </li>
              ))}
            </ul>
            {state.fireId && (
              <div className={styles.note}>
                <p>
                  Selected: {selected?.name.en ?? state.fireId}. The existing recovery view is open
                  beside this panel.
                </p>
                <a href={mapHref({ ...state, presentation: 'explore', fireId: null })}>
                  Close fire result
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            <p>
              Selecting a catalog fire and processing it will be available here. Search and polygon
              drawing are not connected in this phase.
            </p>
            <div role="status" className={styles.note}>
              {!backend.status
                ? 'Checking backend availability…'
                : backend.status.state === 'online'
                  ? 'Backend online. Its health check is available; fire processing is not connected.'
                  : backend.status.state === 'not-configured'
                    ? 'Backend not configured. Calculation is currently unavailable.'
                    : `Backend unavailable: ${backend.status.reason}. Calculation is currently unavailable.`}
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
        )}
        {children && (
          <details className={styles.studyDetails}>
            <summary>Existing Ontario study tools</summary>
            {children}
          </details>
        )}
      </div>
    </MapSidePanel>
  );
}
