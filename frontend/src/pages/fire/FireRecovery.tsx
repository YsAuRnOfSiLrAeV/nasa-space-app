import { config } from '@/config';
import type { FireData } from '@/data/fireSchema';
import { FireComparison } from './FireComparison';
import { FireObservationHistory } from './FireObservationHistory';
import { FireYearExplorer } from './FireYearExplorer';
import { FireTimeline } from './FireTimeline';
import { percent, STAGE_NAMES } from './fireSpatial';
import styles from './Fire.module.css';

/**
 * Warning codes the backend sends in result.json (DELIVERABLES tabs 1 and 8): it
 * sends codes only, the texts live here. Unknown codes still show, flagged.
 */
const WARNING_TEXT: Record<string, string> = {
  MOCK_RESULT:
    'Illustrative mock result. Values were generated locally to test the interface. No satellite observations or trained model were used.',
  AGE_OUT_OF_RANGE:
    'The result flags the fire age as outside the model’s validated range. Interpret its forecast with caution.',
  PARTIAL_CONFIDENCE:
    'Only part of this fire lies where the model was trained. Cells outside that zone are shown grey and carry no estimate.',
  OUT_OF_DOMAIN:
    'This forest is unlike the forests the model was trained on, so the model was not run. Any estimate here would be very inaccurate.',
};

/** The reference ("100% recovery") forest height, with its source named. ETH is approximate. */
function neighbourForest(nf: FireData['result']['neighbour_forest']): string {
  if (nf?.height_m == null) return 'Not supplied';
  const source = nf.source.toLowerCase();
  if (source === 'gedi') return `${nf.height_m} m · GEDI lidar`;
  if (source === 'eth') return `${nf.height_m} m · ETH Canopy Height (approximate, north of 51.6°)`;
  return `${nf.height_m} m · ${nf.source}`;
}

/**
 * When and how this fire was observed, straight from result.json
 * (satellite_images, map_grid). Missing sources read "Not supplied".
 */
function ObservationRecord({ result }: { result: FireData['result'] }) {
  const { nisar, sentinel1, sentinel2, summer } = result.satellite_images;
  const grid = result.map_grid;
  return (
    <section aria-labelledby="fire-observations" className={styles.observations}>
      <h2 id="fire-observations" className={styles.observationsHead}>
        Observation record <span>Summer {summer}</span>
      </h2>
      <dl>
        <div>
          <dt>NISAR · L-band radar</dt>
          <dd>{nisar?.date ?? 'Not supplied'}</dd>
          {nisar?.fire_covered != null && (
            <dd>{percent(nisar.fire_covered, 100)} of the fire covered</dd>
          )}
        </div>
        <div>
          <dt>Sentinel-1 · C-band radar</dt>
          <dd>{sentinel1 ? `${sentinel1.from} → ${sentinel1.to}` : 'Not supplied'}</dd>
          {sentinel1 && (
            <dd>
              {sentinel1.scenes} {sentinel1.scenes === 1 ? 'scene' : 'scenes'}
            </dd>
          )}
        </div>
        <div>
          <dt>Sentinel-2 · optical</dt>
          <dd>{sentinel2 ? `${sentinel2.from} → ${sentinel2.to}` : 'Not supplied'}</dd>
        </div>
        <div>
          <dt>Model grid</dt>
          <dd>
            {grid.columns} × {grid.rows} cells
          </dd>
          <dd>{grid.cell_size_m} m per cell</dd>
        </div>
      </dl>
    </section>
  );
}

/** Reusable result view for precomputed fires and future analysis results. */
export function FireRecovery({ data }: { data: FireData }) {
  const { result } = data;
  const model = result.model_result;
  const mock = result.warnings.includes('MOCK_RESULT');
  return (
    <div className={styles.content}>
      <div className="space-y-4">
        {config.fireDataIsExample && !mock && (
          <div className={styles.notice} role="note">
            <p className="font-medium text-foreground">Documentation example</p>
            <p>
              Values and geometry are copied from Deliverables to demonstrate the interface. The
              document supplies five cell entries and two GEDI coordinates. Unspecified cells are
              missing. These example summaries have not been validated against a complete fire
              dataset.
            </p>
          </div>
        )}
        {!mock && <ObservationRecord result={result} />}
        <dl className={styles.summary}>
          <div>
            <dt>{mock ? 'Illustrative mock recovery' : 'Modelled structural recovery'}</dt>
            <dd>{percent(model.recovery_today_avg, 100)}</dd>
          </div>
          <div>
            <dt>Area at ≥80% recovery</dt>
            <dd>{percent(model.area_recovered_80pct, 100)}</dd>
          </div>
          <div>
            <dt>Observation summer</dt>
            <dd>{result.satellite_images.summer} · July–August</dd>
          </div>
          <div>
            <dt>Fire area</dt>
            <dd>
              {result.fire.area_ha == null
                ? 'Not supplied'
                : `${result.fire.area_ha.toLocaleString()} ha`}
            </dd>
          </div>
        </dl>
        {model.stage_share && (
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Reported model height stages ·{' '}
            {model.stage_share
              .map((share, index) => `${STAGE_NAMES[index]} ${percent(share, 100)}`)
              .join(' · ')}
          </p>
        )}
        {result.warnings.length > 0 && (
          <div className={styles.notice}>
            <h2 className="mb-2 font-medium text-foreground">Result warnings</h2>
            <ul className="space-y-2">
              {result.warnings.map((warning) => (
                <li key={warning}>
                  {WARNING_TEXT[warning] ??
                    `The result includes warning ${warning.replaceAll('_', ' ').toLowerCase()}. Its meaning needs confirmation from the data provider.`}{' '}
                  <span className="font-mono text-xs">({warning})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <FireYearExplorer key={result.fire.id} data={data} />
      <FireComparison data={data} />
      <FireObservationHistory result={result} />
      <FireTimeline result={result} />
      <section aria-labelledby="fire-method-title">
        <h2 id="fire-method-title" className={styles.sectionTitle}>
          Data coverage and model basis
        </h2>
        <dl className={styles.readout}>
          <dt>Model version</dt>
          <dd>{model.model_version}</dd>
          <dt>Model region</dt>
          <dd>{model.region}</dd>
          <dt>NISAR fire coverage</dt>
          <dd>{percent(result.satellite_images.nisar?.fire_covered, 100)}</dd>
          <dt>Neighbouring forest height</dt>
          <dd>{neighbourForest(result.neighbour_forest)}</dd>
          <dt>Reported error versus lidar</dt>
          <dd>{percent(model.error_vs_lidar_pct)}</dd>
        </dl>
        <p className="mt-5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
          {mock ? (
            'This mock grid demonstrates the interface. Its values are illustrative and cannot establish forest condition. No forecast or scientific uncertainty has been generated.'
          ) : (
            <>
              The model was developed for Canadian forests using summer observations. NISAR radar
              provides structural information used by the model. Height stages and recovery
              percentages are model estimates. GEDI heights are lidar measurements. ETH reference
              heights, where used, are approximate.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
