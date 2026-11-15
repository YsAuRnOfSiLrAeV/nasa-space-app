import { CellInspector } from '@/components/fire/CellInspector';
import { FireResults } from '@/components/fire/FireResults';
import { FireResultDetails } from '@/components/fire/FireResultDetails';
import type { DemoFire } from '@/data/fireSchema';
import { DEVELOPMENT_FIXTURE, warningText } from '@/data/fireWarnings';
import { layerCoverage, overlayAvailability } from '@/domain/fire/fireGrid';
import type { FireInvestigationState } from '@/hooks/useFireInvestigation';
import { useMemo } from 'react';
import { config } from '@/config';
import { UNAVAILABLE } from '@/domain/fire/fireSummary';
import { GridLayerPicker, OverlayToggles } from './FireControls';
import styles from './MapShell.module.css';

/** The selected example fire in the investigation panel: state, layer controls and legend. */
export function FireInvestigation({
  investigation,
  entry,
  closeHref,
}: {
  investigation: FireInvestigationState;
  entry: DemoFire | undefined;
  closeHref: string;
}) {
  const {
    fireId,
    fire,
    retry: onRetry,
    data,
    layer,
    setLayer: onLayer,
    overlays,
    setOverlays: onOverlays,
    optical,
    inspected,
    inspect: onInspect,
    showCell: onShowCell,
    forecast,
    forecastYear,
  } = investigation;
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
  const name = data?.result.fire.name.en ?? entry?.name.en ?? fireId;
  const year = data?.result.fire.year ?? entry?.year;
  const fixture = data?.result.warnings.includes(DEVELOPMENT_FIXTURE) ?? false;

  const warnings = data?.result.warnings.filter((warning) => warning !== DEVELOPMENT_FIXTURE) ?? [];

  return (
    <section className={styles.fire} aria-labelledby="fire-title">
      <div>
        <p className={styles.eyebrow}>Selected fire</p>
        <h3 id="fire-title" className={styles.fireTitle}>
          {name}
          {year ? ` · ${year}` : ''}
        </h3>
        {data && (
          <dl className={styles.facts}>
            <dt>Fire year</dt>
            <dd>{data.result.fire.year}</dd>
            <dt>Fire area</dt>
            <dd data-value={data.result.fire.area_ha ?? 'missing'}>
              {data.result.fire.area_ha == null
                ? UNAVAILABLE
                : `${data.result.fire.area_ha.toLocaleString('en')} ha`}
            </dd>
            <dt>Observation summer</dt>
            <dd>{data.result.satellite_images.summer} · July–August</dd>
          </dl>
        )}
        <a className={styles.action} href={closeHref}>
          Back to fire list
        </a>
      </div>

      <>
        {' '}
        {fire.status === 'loading' && <p role="status">Loading the fire result and grid…</p>}
        {fire.status === 'absent' && (
          <div role="alert" className={styles.note}>
            <p>
              “{fireId}” is not in the example fire catalog. Choose one of the available fires
              below.
            </p>
          </div>
        )}
        {fire.status === 'error' && (
          <div role="alert" className={styles.note}>
            <p>{fire.message}</p>
            <p>The map stays available. Other fires are unaffected.</p>
            <button type="button" onClick={onRetry}>
              Try loading again
            </button>
          </div>
        )}
      </>

      {data && available && coverage && forecast && (
        <>
          <>
            {' '}
            {fixture ? (
              <div role="note" className={styles.fixture}>
                <p className="font-medium text-foreground">Development fixture</p>
                <p>{warningText(DEVELOPMENT_FIXTURE).replace(/^Development fixture\.\s*/, '')}</p>
              </div>
            ) : (
              config.fireDataIsExample && (
                <div role="note" className={styles.note}>
                  <p className="font-medium text-foreground">Documentation example</p>
                  <p>
                    Values and geometry are copied from Deliverables to demonstrate the interface.
                    Only the cells listed there are supplied; the rest of the grid is empty.
                  </p>
                </div>
              )
            )}
          </>

          <FireResults
            data={data}
            forecast={forecast}
            year={forecastYear ?? data.result.satellite_images.summer}
          />

          <h4 className={styles.listHead}>
            Map · summer {data.result.satellite_images.summer} grid
          </h4>
          <GridLayerPicker layer={layer} coverage={coverage} onLayer={onLayer} />
          <OverlayToggles
            overlays={overlays}
            available={available}
            optical={optical}
            onChange={onOverlays}
          />

          <CellInspector
            data={data}
            layer={layer}
            cell={inspected}
            onCell={onInspect}
            onShowOnMap={onShowCell}
          />

          <p>
            Hover over a cell, tap it, or use “Inspect a cell” above to see its categories. The grid
            shows summer {data.result.satellite_images.summer} only; forecast years do not recolour
            it. The background imagery is a generic basemap, not this fire’s optical scene.
          </p>

          {warnings.length > 0 && (
            <div className={styles.note}>
              <p className="font-medium text-foreground">Result warnings</p>
              <ul>
                {warnings.map((w) => (
                  <li key={w}>
                    {warningText(w)} <span className="font-mono text-xs">({w})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <FireResultDetails data={data} forecast={forecast} />
        </>
      )}
    </section>
  );
}
