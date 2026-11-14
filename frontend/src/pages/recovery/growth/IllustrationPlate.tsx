import { SPECIES } from '@/components/forest/species';
import type { Scene } from '@/components/forest/growth';
import { ForestScene } from './ForestScene';
import ui from '@/components/shell/primitives.module.css';
import { PLATE } from './palette';

const GROUND_NAMES = {
  grass: 'grasses',
  fireweed: 'fireweed',
  shrub: 'low shrubs',
  moss: 'moss',
  litter: 'leaf and needle litter',
} as const;

/** Text alternative for the drawing: what is drawn, explicitly not a measurement. */
function describe(scene: Scene, year: number, stageTitle: string) {
  const standing = scene.snags.filter((s) => s.fallen < 0.5).length;
  const names = [...new Set(scene.trees.map((t) => SPECIES[t.species].name.toLowerCase()))];
  const plants = [...new Set(scene.ground.map((g) => g.kind))]
    .map((k) => GROUND_NAMES[k])
    .join(', ');
  return `Illustration, not measured. Year ${year} after the fire, stage: ${stageTitle}. ${
    scene.trees.length
      ? `${scene.trees.length} trees drawn (${names.join(', ')}).`
      : 'No living trees yet.'
  } ${standing ? `${standing} burned trunks still standing.` : 'The burned trunks have fallen.'}${plants ? ` Ground: ${plants}.` : ' Ground: ash and bare soil.'}`;
}

/** The drawing on its paper plate, labelled as an illustration, with the year shown. */
export function IllustrationPlate({
  scene,
  seed,
  labels,
  year,
  fireYear,
  stageTitle,
}: {
  scene: Scene;
  seed: number;
  labels: boolean;
  year: number;
  fireYear: number;
  stageTitle: string;
}) {
  return (
    <figure className={ui.bezel}>
      <div className={ui.bezelCore} style={{ background: PLATE.paper }}>
        <ForestScene
          scene={scene}
          seed={seed}
          labels={labels}
          description={describe(scene, year, stageTitle)}
        />
        <span
          className="pointer-events-none absolute top-3 left-3 rounded-sm border px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase max-sm:top-2 max-sm:left-2 max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[8px] max-sm:tracking-[0.08em]"
          style={{ color: PLATE.ink, borderColor: PLATE.ink, background: `${PLATE.paper}cc` }}
        >
          Illustration · not measured
        </span>
        <span
          className="pointer-events-none absolute top-3 right-3 font-mono text-[11px] max-sm:top-2 max-sm:right-2 max-sm:text-[9px]"
          style={{ color: PLATE.ink }}
        >
          Year {year} · {fireYear + year}
        </span>
      </div>
    </figure>
  );
}
