import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { BundleAvailability } from '@/components/fire/BundleAvailability';
import { CellInspector } from '@/components/fire/CellInspector';
import { FireResultDetails } from '@/components/fire/FireResultDetails';
import { FireResults } from '@/components/fire/FireResults';
import { SpatialLayerPicker } from '@/components/fire/SpatialLayerPicker';
import { config } from '@/config';
import { DEVELOPMENT_FIXTURE, warningText } from '@/data/fireWarnings';
import { layerCoverage, overlayAvailability } from '@/domain/fire/fireGrid';
import type { FireInvestigationState } from '@/hooks/useFireInvestigation';
import { MapSidePanel } from '../MapSidePanel';
import { GridLayerPicker, OverlayToggles } from './FireControls';
import styles from './MapShell.module.css';

/**
 * The right panel while a fire is open: the map's settings first (what the cells
 * show, which overlays are drawn, geographic applicability), then the fire's
 * secondary information in compact sections. The timeline and forecast year are
 * in the bottom bar, not here.
 */
export function FireSettingsPanel({
  investigation,
  headingRef,
  zones,
}: {
  investigation: FireInvestigationState;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Geographic applicability layer controls. */
  zones?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { fireId, fire, data, forecast, forecastYear, overlays, optical } = investigation;
  const available = useMemo(() => (data ? overlayAvailability(data) : null), [data]);
  const coverage = useMemo(
    () =>
      data
        ? {
            stage: layerCoverage(data.cells, 'stage'),
            probability: layerCoverage(data.cells, 'probability'),
          }
        : null,
    [data],
  );
  const fixture = data?.result.warnings.includes(DEVELOPMENT_FIXTURE) ?? false;
  const warnings =
    data?.result.warnings.filter(
      (warning) =>
        warning !== DEVELOPMENT_FIXTURE && !data.bundle?.source.model2.warnings?.includes(warning),
    ) ?? [];

  return (
    <MapSidePanel
      label="Map settings"
      className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}
      pinned={
        <div className={styles.panelHead}>
          <h2 ref={headingRef} tabIndex={-1}>
            Map settings
          </h2>
          <span className={styles.panelHeadActions}>
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-controls="settings-body"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          </span>
        </div>
      }
    >
      <div id="settings-body" hidden={collapsed} className={styles.panelBody}>
        {fire.status === 'loading' && <p role="status">Loading the fire result and grid…</p>}
        {fire.status === 'absent' && (
          <div role="alert" className={styles.note}>
            <p>“{fireId}” is not in the example fire catalog. Choose another under Other fires.</p>
          </div>
        )}
        {fire.status === 'error' && (
          <div role="alert" className={styles.note}>
            <p>{fire.message}</p>
            <p>The map stays available. Other fires are unaffected.</p>
            <button type="button" onClick={investigation.retry}>
              Try loading again
            </button>
          </div>
        )}

        {data && available && coverage && forecast && (
          <>
            {data.bundle ? (
              <SpatialLayerPicker
                data={data}
                layer={investigation.timelineYear != null ? 'recovery' : investigation.spatialLayer}
                onLayer={investigation.setSpatialLayer}
              />
            ) : (
              <GridLayerPicker
                layer={investigation.layer}
                coverage={coverage}
                onLayer={investigation.setLayer}
              />
            )}
            <OverlayToggles
              overlays={overlays}
              available={available}
              optical={optical}
              onChange={investigation.setOverlays}
            />
            {zones}

            {fixture ? (
              <div role="note" className={styles.fixture}>
                <p className="font-medium text-foreground">Development fixture</p>
                <p>{warningText(DEVELOPMENT_FIXTURE).replace(/^Development fixture\.\s*/, '')}</p>
              </div>
            ) : (
              config.fireDataIsExample &&
              !data.bundle && (
                <div role="note" className={styles.note}>
                  <p className="font-medium text-foreground">Documentation example</p>
                  <p>
                    Values and geometry are copied from Deliverables to demonstrate the interface.
                  </p>
                </div>
              )
            )}

            <Section title="Recovery results and forecast">
              <FireResults
                data={data}
                forecast={forecast}
                year={forecastYear ?? data.result.satellite_images.summer}
              />
            </Section>
            {(!data.bundle || data.bundle.cells.length > 0) && (
              <Section title="Inspect a cell">
                <CellInspector
                  data={data}
                  layer={investigation.layer}
                  cell={investigation.inspected}
                  timelineYear={investigation.timelineYear}
                  onCell={investigation.inspect}
                  onShowOnMap={investigation.showCell}
                />
              </Section>
            )}
            <Section title="Data supplied for this fire">
              <BundleAvailability data={data} />
            </Section>
            {warnings.length > 0 && (
              <Section title={`Result warnings (${warnings.length})`}>
                <ul>
                  {warnings.map((w) => (
                    <li key={w}>
                      {warningText(w)} <span className="font-mono text-xs">({w})</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            <FireResultDetails data={data} forecast={forecast} />
          </>
        )}
      </div>
    </MapSidePanel>
  );
}

/** A compact, collapsed-by-default section of secondary information. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.section}>
      <summary>{title}</summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}
