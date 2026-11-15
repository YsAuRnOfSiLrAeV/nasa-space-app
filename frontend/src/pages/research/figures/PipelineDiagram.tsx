import type { InputFeature, VALIDATION_DESIGN } from '@/data/calibrationEvidence';
import styles from '../research.module.css';

const SENSORS: { sensor: InputFeature['sensor']; title: string }[] = [
  { sensor: 'Sentinel-1', title: 'Sentinel-1 · C-band radar' },
  { sensor: 'Optical', title: 'Optical imagery' },
  { sensor: 'NISAR', title: 'NISAR · L-band radar' },
];

/**
 * Chapter 2: the pipeline as five stages read left to right (top to bottom on a
 * phone). GEDI enters at the comparison stage as the reference, not as an input.
 */
export function PipelineDiagram({
  features,
  design,
}: {
  features: InputFeature[];
  design: typeof VALIDATION_DESIGN;
}) {
  return (
    <ol className={styles.pipeline}>
      <li>
        <p className={styles.stageNo}>1 · Observation</p>
        <h4>Satellite observations</h4>
        <ul className={styles.sensorList}>
          {SENSORS.map((s) => (
            <li key={s.sensor}>{s.title}</li>
          ))}
        </ul>
        <p>One summer of radar and optical imagery over each fire.</p>
      </li>
      <li>
        <p className={styles.stageNo}>2 · Features</p>
        <h4>Feature extraction</h4>
        <dl className={styles.featureGroups}>
          {SENSORS.map((s) => (
            <div key={s.sensor}>
              <dt>{s.sensor}</dt>
              <dd>
                {features
                  .filter((f) => f.sensor === s.sensor)
                  .map((f) => (
                    <span key={f.name} className={styles.chip} title={f.meaning}>
                      {f.name}
                    </span>
                  ))}
              </dd>
            </div>
          ))}
        </dl>
        <p>{features.length} inputs per point.</p>
      </li>
      <li>
        <p className={styles.stageNo}>3 · Model estimate</p>
        <h4>Height model</h4>
        <ul className={styles.plainList}>
          {design.models.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p>Estimates canopy height from the {features.length} inputs.</p>
      </li>
      <li data-reference>
        <p className={styles.stageNo}>4 · Reference measurement</p>
        <h4>GEDI comparison</h4>
        <ul className={styles.plainList}>
          <li>{design.targetPlain}</li>
          <li>
            {design.points.toLocaleString('en')} points · {design.fires} fires · {design.country}
          </li>
          <li>{design.splitPlain}</li>
          <li>{design.calibrationPlain}</li>
        </ul>
      </li>
      <li>
        <p className={styles.stageNo}>5 · Result</p>
        <h4>Fire-level estimates</h4>
        <p>
          Point estimates are aggregated to one value per fire, where the error is smallest. Cells
          keep only a stage category.
        </p>
      </li>
    </ol>
  );
}

/** The seven inputs as a table: which sensor and band each one comes from. */
export function FeatureTable({ features }: { features: InputFeature[] }) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <caption>The seven model inputs. GEDI is the reference, not an input.</caption>
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Sensor</th>
            <th scope="col">Band</th>
            <th scope="col">What it is</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.name}>
              <th scope="row">{f.name}</th>
              <td>{f.sensor}</td>
              <td>{f.band}</td>
              <td>{f.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
