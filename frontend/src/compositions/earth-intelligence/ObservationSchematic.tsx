import { FOREST_3D_HREF } from '@/app/route';
import cartography from './ScientificLanding.module.css';

const W = 240;
const COL = 112;
const GAP = W - COL * 2;
const GROUND = 78;

/** A conifer in elevation: a trunk and branch whorls widening toward the base. */
function conifer(x: number, height: number, key: string) {
  const top = GROUND - height;
  const whorls = Math.max(2, Math.round(height / 7));
  const d = [`M${x} ${GROUND}V${top}`];
  for (let i = 1; i <= whorls; i++) {
    const y = top + (i * (height * 0.82)) / whorls;
    const half = 1.2 + (i / whorls) * height * 0.16;
    d.push(`M${x - half} ${y + 2.4}L${x} ${y - 0.6}L${x + half} ${y + 2.4}`);
  }
  return <path key={key} d={d.join('')} />;
}

// Fixed, hand-set stands. Illustration only: no value here is a measurement.
const REGROWING = [7, 18, 26, 38, 47, 58, 66, 77, 87, 98, 106].map((x, i) => ({
  x,
  h: 11 + ((i * 7) % 9),
}));
const MATURE = [14, 38, 60, 84, 104].map((x, i) => ({ x: COL + GAP + x, h: 56 + ((i * 11) % 18) }));

/**
 * FIG. 02: the core idea in one picture. Two stands look equally green from
 * orbit (top), yet their structure, what L-band radar and lidar respond to,
 * differs (bottom). Labelled as a schematic on the figure itself.
 */
export function ObservationSchematic({ className }: { className?: string }) {
  return (
    <figure
      className={className}
      aria-label="Schematic: a regrowing burn and an unburned forest can look equally green to optical satellites while their structure differs."
    >
      <div className={cartography.panelLabel}>
        <span className={cartography.figureIndex}>FIG. 02 / COMPARISON</span>
        <span>SCHEMATIC</span>
      </div>
      <div className={cartography.schematicColumns} aria-hidden="true">
        <span>Regrowing burn</span>
        <span>Unburned forest</span>
      </div>
      <p className={cartography.schematicRow}>Optical · surface greenness</p>
      <svg viewBox={`0 0 ${W} 8`} className={cartography.schematicBand} aria-hidden="true">
        <rect x={0} y={0} width={COL} height={8} />
        <rect x={COL + GAP} y={0} width={COL} height={8} />
      </svg>
      <p className={cartography.schematicRow}>Structure · L-band radar, lidar</p>
      <svg
        viewBox={`0 0 ${W} ${GROUND + 1}`}
        className={cartography.schematicStand}
        aria-hidden="true"
      >
        <g>
          {REGROWING.map((t, i) => conifer(t.x, t.h, `r${i}`))}
          {MATURE.map((t, i) => conifer(t.x, t.h, `m${i}`))}
        </g>
        <path d={`M0 ${GROUND}H${COL}M${COL + GAP} ${GROUND}H${W}`} data-ground />
      </svg>
      <figcaption className={cartography.panelCaption}>
        <span>Conceptual illustration, not measured forest geometry.</span>
        <a href={FOREST_3D_HREF} className={cartography.panelLink}>
          Open the 3D forest block →
        </a>
      </figcaption>
    </figure>
  );
}
