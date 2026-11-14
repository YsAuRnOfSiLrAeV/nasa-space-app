import { useId } from 'react';
import { FOREST_3D_HREF } from '@/app/route';
import { cn } from '@/lib/utils';
import { StudyStateView } from '@/components/shell/StudyStateView';
import type { StudyLoad, StudyView } from '../types';
import { ArrowRight } from './marks';
import { SOURCES_PANEL_ID } from './SourcesPanel';
import { formatAcquisitionDates, regionPlot, wholeDegrees } from './readouts';
import styles from './EarthIntelligence.module.css';
import cartography from './ScientificLanding.module.css';

/**
 * The landing's lead: where, the finding in one sentence, how it was seen, and
 * the one primary action (the Ontario study, outlined in mint on the globe).
 * Fires are opened from their dots on the globe, nowhere else on this page.
 * The error with a retry replaces the action if loading failed.
 */
export function LandingLead({
  study,
  load,
  canEnter,
  onEnter,
}: {
  study: StudyView | null;
  load: StudyLoad;
  canEnter: boolean;
  onEnter: () => void;
}) {
  return (
    <div className={cartography.lead}>
      <p className={cartography.fieldNote}>
        <span aria-hidden="true" />
        FIELD NOTES / 001 · CANADIAN FORESTS
      </p>
      <p className={cartography.headline}>A forest is more than its greenness.</p>
      <p className={cartography.description}>
        Observe the difference between surface greenness and forest structure.
      </p>
      <div className="pointer-events-auto mt-5 flex flex-col items-stretch gap-2.5 sm:items-start [&>*]:whitespace-nowrap">
        {study ? (
          <button
            type="button"
            className={cn(styles.primary, 'disabled:opacity-50')}
            disabled={!canEnter}
            onClick={onEnter}
          >
            <span>Explore the Ontario study</span>
            <span aria-hidden>
              <ArrowRight />
            </span>
          </button>
        ) : load.status === 'error' ? (
          <div className="w-full max-w-[24rem]">
            <StudyStateView load={load} />
          </div>
        ) : (
          <p role="status" className="sr-only">
            Loading the study data…
          </p>
        )}
        {/* Secondary: the 3D illustration of forest structure (always available). */}
        <a href={FOREST_3D_HREF} className={cartography.secondaryLink}>
          Forest structure in 3D
          <span aria-hidden>
            <ArrowRight />
          </span>
        </a>
      </div>
    </div>
  );
}

/**
 * "Layers & notes": the globe's legend and its caveats, as a disclosure (no
 * modal). States plainly what is geography, observation, fire and illustration.
 */
export function GlobeLegend({
  footprints,
  site,
  className,
}: {
  footprints: number | null;
  site: string | null;
  className?: string;
}) {
  const id = useId();
  return (
    <details className={cn(styles.legend, className)}>
      <summary aria-controls={id}>Layers &amp; notes</summary>
      <div id={id} className={styles.legendBody}>
        <ul>
          <li>
            <i aria-hidden data-swatch="land" />
            <span>
              <b>Land and coastline</b> Natural Earth 1:110m.
            </span>
          </li>
          <li>
            <i aria-hidden data-swatch="forest" />
            <span>
              <b>Study region and GEDI footprints</b>{' '}
              {footprints != null
                ? `${footprints} lidar footprints${site ? `, ${site}` : ''}, at their true positions.`
                : 'Not loaded.'}
            </span>
          </li>
          <li>
            <i aria-hidden data-swatch="fire" />
            <span>
              <b>Fires</b> Catalogued fires at their supplied coordinates. Select one to
              investigate.
            </span>
          </li>
          <li>
            <i aria-hidden data-swatch="grid" />
            <span>
              <b>Geographic reference</b> Orthographic projection. Meridians every 30° and parallels
              every 20°. Land outlines provide geographic context, not terrain elevation or forest
              coverage.
            </span>
          </li>
        </ul>
        <p>
          Optical satellites see greenness. NISAR’s L-band radar responds to trunks and branches.
          GEDI samples canopy height. The globe’s slow drift is display only.
        </p>
      </div>
    </details>
  );
}

/**
 * Wide screens: the figure index that closes the plate, like the list of
 * figures in a report, with the legend and Sources. It also states plainly that
 * the contour ground is decoration, not measured terrain.
 */
export function LandingFooter({
  footprints,
  site,
  sourcesOpen,
  onSources,
}: {
  footprints: number | null;
  site: string | null;
  sourcesOpen: boolean;
  onSources: () => void;
}) {
  return (
    <footer
      className={cn(styles.footer, cartography.figureIndexBar, styles.hudIn, 'max-lg:hidden')}
    >
      <ol aria-label="Figures">
        <li>
          <b>01</b> Geographic context
        </li>
        <li>
          <b>01A</b> Observation window
        </li>
        <li>
          <b>02</b> Observation comparison
        </li>
        <li>Orbits: real inclinations, illustrative positions</li>
        <li>Ground: decorative contours, not measured terrain</li>
      </ol>
      <p className={styles.footerKinds}>Independent research · Space Apps 2026</p>
      <div className={styles.footerActions}>
        <GlobeLegend footprints={footprints} site={site} />
        <button
          type="button"
          className={styles.footerButton}
          aria-expanded={sourcesOpen}
          aria-controls={SOURCES_PANEL_ID}
          onClick={onSources}
        >
          Sources
        </button>
      </div>
    </footer>
  );
}

/**
 * Wide screens, bottom right: the study region as an instrument panel. A plot of
 * every sample site at its true position inside the region's bounding box, then
 * the record's readouts. All values come from the manifest and the point file.
 */
export function StudyRecord({ study, className }: { study: StudyView; className?: string }) {
  const { counts, fire_years, nisar_dates } = study.manifest;
  const dates = formatAcquisitionDates(nisar_dates);
  return (
    <section
      aria-labelledby="ei-record"
      className={cn(styles.record, styles.hudIn, 'pointer-events-auto', className)}
    >
      <header className={styles.recordHead}>
        <h2 id="ei-record" className={styles.label}>
          Study region
        </h2>
        <span className={styles.labelMuted}>Observations</span>
      </header>
      <RegionPlot study={study} />
      <dl className={styles.readouts}>
        <div>
          <dt>Sample sites</dt>
          <dd>{counts.points}</dd>
        </div>
        <div>
          <dt>Fire years</dt>
          <dd>{fire_years.length ? fire_years.join(' · ') : 'None'}</dd>
        </div>
        <div>
          <dt>NISAR acquisitions</dt>
          <dd>{dates ?? 'None'}</dd>
        </div>
      </dl>
    </section>
  );
}

const PLOT_W = 256;
const MARGIN = { right: 34, bottom: 18 };

/**
 * Every sample site at its true position. Burned sites are amber squares,
 * unburned reference sites are hollow off-white circles: shape and colour both
 * differ, so the two never depend on hue alone.
 */
function RegionPlot({ study }: { study: StudyView }) {
  const bbox = study.manifest.bbox;
  const [west, south, east, north] = bbox;
  const { height, at } = regionPlot(bbox, PLOT_W);
  const { burned, unburned } = study.manifest.counts;
  const burnedPts = study.located.filter((p) => p.status === 'burned');
  const unburnedPts = study.located.filter((p) => p.status !== 'burned');
  return (
    <figure className={styles.plot}>
      <svg
        role="img"
        aria-label={`Map of the ${study.manifest.counts.points} sample sites inside the study region, ${south.toFixed(2)} to ${north.toFixed(2)} degrees north and ${Math.abs(west).toFixed(2)} to ${Math.abs(east).toFixed(2)} degrees west: ${burned} burned, ${unburned} unburned.`}
        viewBox={`0 0 ${PLOT_W + MARGIN.right} ${height + MARGIN.bottom}`}
        className="block h-auto w-full overflow-visible"
      >
        {/* Graticule at whole degrees, with its labels outside the frame. */}
        <g className={styles.plotGrid}>
          {wholeDegrees(west, east).map((lon) => {
            const { x } = at(lon, north);
            return (
              <g key={`lon${lon}`}>
                <line x1={x} x2={x} y1={0} y2={height} />
                <text x={x} y={height + 13} textAnchor="middle">
                  {Math.abs(lon)}°W
                </text>
              </g>
            );
          })}
          {wholeDegrees(south, north).map((lat) => {
            const { y } = at(west, lat);
            return (
              <g key={`lat${lat}`}>
                <line x1={0} x2={PLOT_W} y1={y} y2={y} />
                <text x={PLOT_W + 6} y={y + 3}>
                  {lat}°N
                </text>
              </g>
            );
          })}
        </g>
        <rect x={0} y={0} width={PLOT_W} height={height} className={styles.plotFrame} />
        <g className={styles.plotReference}>
          {unburnedPts.map((p) => {
            const q = at(p.lon, p.lat);
            return <circle key={p.point_id} cx={q.x} cy={q.y} r={2.1} />;
          })}
        </g>
        <g className={styles.plotBurned}>
          {burnedPts.map((p) => {
            const q = at(p.lon, p.lat);
            return <rect key={p.point_id} x={q.x - 2} y={q.y - 2} width={4} height={4} />;
          })}
        </g>
      </svg>
      <figcaption className={styles.plotKey}>
        <span>
          <i aria-hidden className={styles.keyBurned} />
          Burned <b>{burned}</b>
        </span>
        <span>
          <i aria-hidden className={styles.keyReference} />
          Unburned <b>{unburned}</b>
        </span>
      </figcaption>
    </figure>
  );
}
