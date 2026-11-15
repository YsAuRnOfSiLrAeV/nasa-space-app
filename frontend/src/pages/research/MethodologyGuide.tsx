import { mapHref } from '@/app/route';
import { useMapNavigation } from '@/app/mapNavigation';
import styles from './research.module.css';

export function MethodologyGuide() {
  const map = useMapNavigation();
  return (
    <section
      id="methodology-guide"
      className={styles.methodGuide}
      aria-labelledby="methodology-guide-title"
    >
      <h2 id="methodology-guide-title" tabIndex={-1} className={styles.minorHead}>
        Methodology at a glance
      </h2>
      <p>
        Read the Explorer as three distinct kinds of evidence: sensor observations, modeled forest
        state, and projected recovery. A map of examples demonstrates the interface; it is not
        independent validation.
      </p>
      <dl className={styles.limits}>
        <div>
          <dt>Observed and sensor-derived</dt>
          <dd>
            GEDI footprints provide lidar-derived canopy-height metrics in metres. Radar backscatter
            and optical vegetation indices are sensor signals; neither is a direct tree-height
            measurement.
          </dd>
        </div>
        <div>
          <dt>Modeled state</dt>
          <dd>
            Cell height and recovery are model estimates. The relative forest score ranks cells; it
            is not a calibrated probability. Missing cells remain empty. Recovery is relative to the
            supplied reference forest, whose selection can affect the percentage.
          </dd>
        </div>
        <div>
          <dt>Projected recovery</dt>
          <dd>
            The fire-level forecast and its uncertainty come directly from the selected export. The
            separate cell timeline contains modeled historical and future estimates. Neither is a
            new observation or a prediction calculated by this frontend.
          </dd>
        </div>
        <div>
          <dt>Where validation applies</dt>
          <dd>
            Solid regions are provider-verified; dashed, lighter regions are extrapolated and not
            directly validated. Model-1 state regions, model-2 growth regions and model-2 scenario
            regions have separate meanings. Outside supplied regions, no applicability claim is
            made.
          </dd>
        </div>
      </dl>
      <details>
        <summary>Sensor roles and primary documentation</summary>
        <dl className={styles.limits}>
          <div>
            <dt>NISAR · L-band radar</dt>
            <dd>
              Provides radar backscatter signals related to forest structure. The model can use HH,
              HV and their difference; these signals do not directly measure the height displayed in
              a modeled cell.{' '}
              <a
                href="https://www.nasa.gov/missions/nisar/nasa-isro-radar-mission-to-provide-dynamic-view-of-forests-wetlands/"
                target="_blank"
                rel="noreferrer"
              >
                NASA: NISAR and forests
              </a>
              .
            </dd>
          </div>
          <div>
            <dt>Sentinel-1 · C-band radar</dt>
            <dd>
              Provides complementary VV, VH and their difference. Backscatter responds to
              surface/vegetation structure and moisture, so changes cannot be interpreted as tree
              growth alone.{' '}
              <a
                href="https://sentiwiki.copernicus.eu/web/s1-mission"
                target="_blank"
                rel="noreferrer"
              >
                Copernicus: Sentinel-1 mission
              </a>
              .
            </dd>
          </div>
          <div>
            <dt>Optical vegetation indices</dt>
            <dd>
              NDVI uses red and near-infrared reflectance to describe greenness. Green vegetation
              can return before tall forest; NDVI is not a canopy-height measurement. Clouds and
              season matter.{' '}
              <a
                href="https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/"
                target="_blank"
                rel="noreferrer"
              >
                NASA: measuring vegetation
              </a>
              .
            </dd>
          </div>
          <div>
            <dt>GEDI · lidar reference</dt>
            <dd>
              Waveform-derived canopy and relative-height metrics provide reference measurements for
              evaluating modeled heights. Footprints are samples, not a continuous field of measured
              tree heights.{' '}
              <a
                href="https://gedi.umd.edu/dataproducts/products/"
                target="_blank"
                rel="noreferrer"
              >
                GEDI: product definitions
              </a>
              .
            </dd>
          </div>
        </dl>
        <p>
          A sensor role does not establish an acquisition for every fire. Check the selected export
          metadata: absent NISAR or Sentinel scene metadata remains unavailable. Simulated inputs
          must not be presented as observations.
        </p>
      </details>
      <details>
        <summary>Calibration limits and reliability</summary>
        <p>
          The calibration chapters below describe held-out study results, not per-cell confidence
          intervals. Good ranking does not establish probability calibration. Many exported
          demonstration fires were seen during training, so their maps do not prove generalization.
        </p>
        <p>
          The project calibration review reports temporal mismatch between GEDI and imagery,
          provisional NISAR calibration, terrain/cloud-handling limitations and reference-forest
          uncertainty. Excluding out-of-training-range pixels can make summaries optimistic. Savanna
          reference-height and seasonal assumptions need particular care.
        </p>
        <p>
          Geographic overlap is not model accuracy or a guarantee for a particular cell. Provider
          ranking grades summarize regional validation and do not convert to confidence percentages.
          Read each selected fire's reliability text, warning codes, excluded share and supplied
          forecast interval. Unsupported forecasts stay unavailable.
        </p>
        <p>
          Explorer source: forestrecovery 0.14.0 exports and their documented confidence
          classifications. Calibration figures: the separately credited project height/calibration
          studies. New backend analysis remains unavailable.
        </p>
      </details>
      <a href={mapHref(map)}>Return to Explorer</a>
    </section>
  );
}
