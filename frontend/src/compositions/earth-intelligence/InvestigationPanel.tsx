import { mapHref, type MapState } from '@/app/route';
import { fireLabel } from '@/domain/fire/fireLabel';
import { config } from '@/config';
import type { DemoFire } from '@/data/fireSchema';
import type { FireCatalog } from '@/hooks/useFireCatalog';
import type { CatalogFilters } from '@/domain/fire/catalogSearch';
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
  scientificContext,
  filters,
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
  scientificContext?: ReactNode;
  /** Search and filters of the fire list, held by the explorer. */
  filters?: [CatalogFilters, (filters: CatalogFilters) => void];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [toolsRequested, setToolsRequested] = useState(false);
  const [previousMode, setPreviousMode] = useState(state.mode);
  if (state.mode !== previousMode) {
    setPreviousMode(state.mode);
    setCollapsed(false);
  }
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
        <nav aria-label="Where you are" className={styles.crumbs}>
          <button type="button" onClick={onPlanet}>
            Globe
          </button>
          <span aria-hidden="true">›</span>
          {state.mode === 'examples' && state.fireId ? (
            <>
              <a href={mapHref({ mode: 'examples', presentation: 'explore', fireId: null })}>
                Fires
              </a>
              <span aria-hidden="true">›</span>
              <span aria-current="page">{fireLabel(state.fireId)}</span>
            </>
          ) : (
            <span aria-current="page">
              {state.mode === 'examples' ? 'Fires' : 'Find Your Fire'}
            </span>
          )}
        </nav>
        {state.mode === 'examples' ? (
          <>
            <a
              className={styles.drawAction}
              href={mapHref({
                mode: 'find-your-fire',
                presentation: 'explore',
                fireId: null,
                draw: true,
              })}
            >
              Draw Your Polygon
            </a>
            {fireDetail}
            {!state.fireId && (
              <p>
                {config.fireDataIsExample
                  ? 'Supplied fire catalog. Spatial datasets and perimeter-only summaries are labelled separately. Ranking scores and modeled estimates are distinct from measured observations.'
                  : 'Published, precomputed fire results.'}
              </p>
            )}
            <FireCatalogList
              catalog={catalog}
              selectedId={state.fireId}
              onSelect={onFireSelect}
              filters={filters}
            />
          </>
        ) : (
          <>
            <a
              className={styles.action}
              href={mapHref({ mode: 'examples', presentation: 'explore', fireId: null })}
            >
              Browse Examples
            </a>
            {search ?? <FindYourFireNotice />}
            {fireDetail}
          </>
        )}
        {scientificContext}
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
