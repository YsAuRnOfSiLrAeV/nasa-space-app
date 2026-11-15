import { type MapState } from '@/app/route';
import { config } from '@/config';
import type { DemoFire } from '@/data/fireSchema';
import type { FireCatalog } from '@/hooks/useFireCatalog';
import { useState, type ReactNode, type RefObject } from 'react';
import { MapSidePanel } from '../MapSidePanel';
import { FindYourFireNotice } from './FindYourFireNotice';
import { FireCatalogList } from './FireCatalogList';
import styles from './MapShell.module.css';

export function InvestigationPanel({
  state,
  catalog,
  onFireSelect,
  onPlanet,
  headingRef,
  fireDetail,
  search,
  children,
}: {
  state: MapState;
  catalog: FireCatalog;
  onFireSelect: (fire: DemoFire) => void;
  onPlanet: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** The selected example fire, shown above the fire list. */
  fireDetail?: ReactNode;
  search?: ReactNode;
  children?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [toolsRequested, setToolsRequested] = useState(false);
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
            {fireDetail}
            {!state.fireId && (
              <p>
                {config.fireDataIsExample
                  ? 'One documentation example and labelled development fixtures. Calibrated team exports are not available yet.'
                  : 'Published, precomputed fire results.'}
              </p>
            )}
            {state.fireId && <h3 className={styles.listHead}>Switch fire</h3>}
            <FireCatalogList catalog={catalog} selectedId={state.fireId} onSelect={onFireSelect} />
          </>
        ) : (
          <>
            {search ?? <FindYourFireNotice />}
            {fireDetail}
          </>
        )}
        {children && (
          <details
            className={styles.studyDetails}
            onToggle={(event) => {
              if (event.currentTarget.open) setToolsRequested(true);
            }}
          >
            <summary>Existing Ontario study tools</summary>
            {toolsRequested && children}
          </details>
        )}
      </div>
    </MapSidePanel>
  );
}
