/**
 * The illustrated forest at one (possibly fractional) year: ground layers,
 * burned snags, back-row trees behind a light haze, front-row trees, then
 * low ground plants. Everything comes from the deterministic scene model.
 */
import { memo, type ReactNode } from 'react';
import {
  GROUND_Y,
  SCENE_H,
  SCENE_W,
  groundAt,
  type Scene,
  type SceneSnag,
  type SceneTree,
} from '@/domain/forest/growth';
import { SPECIES, type SpeciesId } from '@/domain/forest/species';
import { PLATE as C } from './palette';
import { Tree } from './trees';

const f = (n: number) => Math.round(n * 10) / 10;

function groundPath(seed: number) {
  let d = `M0 ${f(groundAt(0, seed))}`;
  for (let x = 20; x <= SCENE_W; x += 20) d += `L${x} ${f(groundAt(x, seed))}`;
  return `${d}L${SCENE_W} ${SCENE_H}L0 ${SCENE_H}Z`;
}

function Snag({ s, seed }: { s: SceneSnag; seed: number }) {
  const base = groundAt(s.x, seed);
  const w = 3 + s.height * 0.025;
  // Standing → lying: rotate about the base towards the lean side.
  const angle = (s.lean >= 0 ? 1 : -1) * (s.lean * 57 + s.fallen * 86);
  const h = s.height * (s.depth ? 0.65 : 1);
  const top = -h;
  const d = `M${f(-w)} 0 L${f(-w * 0.55)} ${f(top * 0.82)} L${f(-w * 0.2)} ${f(top)} L${f(w * 0.15)} ${f(top * 0.9)} L${f(w * 0.4)} ${f(top * 0.95)} L${f(w * 0.6)} ${f(top * 0.8)} L${f(w)} 0 Z`;
  return (
    <g transform={`translate(${f(s.x)} ${f(base + s.fallen * 3)}) rotate(${f(angle)})`}>
      <path d={d} fill={C.char} stroke={C.charEdge} strokeWidth="0.8" />
      {/* Stub branches on standing snags. */}
      {s.fallen < 0.2 && (
        <path
          d={`M0 ${f(top * 0.55)} l${f(-w * 3)} ${f(-w * 1.5)} M0 ${f(top * 0.7)} l${f(w * 2.6)} ${f(-w * 1.2)}`}
          stroke={C.char}
          strokeWidth="1.4"
        />
      )}
    </g>
  );
}

function GroundPlant({ g, seed }: { g: Scene['ground'][number]; seed: number }) {
  const y = groundAt(g.x, seed);
  const a = g.amount;
  const k = g.size;
  switch (g.kind) {
    case 'grass': {
      const h = 13 * k * a;
      return (
        <path
          d={`M${g.x} ${y} q-3 ${-h * 0.6} -6 ${-h} M${g.x} ${y} q0 ${-h * 0.7} 1 ${-h * 1.15} M${g.x} ${y} q3 ${-h * 0.6} 6 ${-h * 0.9} M${g.x} ${y} q-1 ${-h * 0.5} -3 ${-h * 0.75}`}
          fill="none"
          stroke={C.grass}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      );
    }
    case 'fireweed': {
      const h = 34 * k * a;
      return (
        <g>
          <line x1={g.x} y1={y} x2={g.x} y2={f(y - h)} stroke={C.fireweedLeaf} strokeWidth="1.2" />
          <path
            d={`M${g.x} ${f(y - h * 0.35)} l-6 -3 M${g.x} ${f(y - h * 0.5)} l6 -3`}
            stroke={C.fireweedLeaf}
            strokeWidth="1.2"
          />
          {[0.72, 0.8, 0.88, 0.96].map((t) => (
            <circle
              key={t}
              cx={g.x + ((t * 10) % 3) - 1}
              cy={f(y - h * t)}
              r={f(1.9 * a + 0.4)}
              fill={C.fireweed}
            />
          ))}
        </g>
      );
    }
    case 'shrub': {
      const w = 16 * k * a;
      return (
        <g>
          <ellipse cx={g.x} cy={f(y - w * 0.32)} rx={f(w)} ry={f(w * 0.45)} fill={C.shrub} />
          {a > 0.6 && (
            <>
              <circle cx={g.x - w * 0.4} cy={f(y - w * 0.3)} r="1.4" fill={C.berry} />
              <circle cx={g.x + w * 0.3} cy={f(y - w * 0.45)} r="1.4" fill={C.berry} />
            </>
          )}
        </g>
      );
    }
    case 'moss':
      return (
        <ellipse
          cx={g.x}
          cy={f(y + 1)}
          rx={f(22 * k * a)}
          ry={f(3.2 * a)}
          fill={g.x % 2 ? C.moss : C.mossLight}
        />
      );
    case 'litter':
      return (
        <path
          d={`M${g.x} ${f(y + 2)} l7 -1 M${g.x + 10} ${f(y + 3)} l5 1`}
          stroke={C.litter}
          strokeWidth="1.4"
          opacity={a}
        />
      );
  }
}

function TreeAt({ t, seed }: { t: SceneTree; seed: number }) {
  return (
    <g transform={`translate(${t.x} ${f(groundAt(t.x, seed))})`} opacity={t.opacity}>
      <Tree species={t.species} h={Math.round(t.height * 2) / 2} seed={t.key} stems={t.stems} />
    </g>
  );
}

/** Label the tallest front-row tree of each species with its name. */
function SpeciesLabels({ trees, seed }: { trees: SceneTree[]; seed: number }) {
  const best = new Map<SpeciesId, SceneTree>();
  for (const t of trees) {
    if (t.depth !== 0 || t.height < 30) continue;
    const cur = best.get(t.species);
    if (!cur || t.height > cur.height) best.set(t.species, t);
  }
  const out: ReactNode[] = [];
  for (const t of best.values()) {
    const y = groundAt(t.x, seed) - t.height - 10;
    out.push(
      <g key={t.key}>
        <line x1={t.x} x2={t.x} y1={f(y + 2)} y2={f(y + 9)} stroke={C.ink} strokeWidth="0.8" />
        <text
          x={t.x}
          y={f(y)}
          textAnchor="middle"
          fontSize="12"
          fill={C.ink}
          fontStyle="italic"
          stroke={C.paper}
          strokeWidth="3.5"
          paintOrder="stroke"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {SPECIES[t.species].name}
        </text>
      </g>,
    );
  }
  return <g>{out}</g>;
}

export const ForestScene = memo(function ForestScene({
  scene,
  seed,
  labels,
  description,
}: {
  scene: Scene;
  seed: number;
  labels: boolean;
  description: string;
}) {
  const back = scene.trees.filter((t) => t.depth === 1);
  const front = scene.trees.filter((t) => t.depth === 0);
  const ground = groundPath(seed);
  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      role="img"
      aria-label={description}
      className="block h-auto w-full"
    >
      {/* Flat sky (project rule: no gradients). */}
      <rect width={SCENE_W} height={SCENE_H} fill={C.paper} />

      {/* Back row, then a light haze for depth. */}
      {scene.snags
        .filter((s) => s.depth === 1)
        .map((s) => (
          <Snag key={s.key} s={s} seed={seed} />
        ))}
      {back.map((t) => (
        <TreeAt key={t.key} t={t} seed={seed} />
      ))}
      <rect width={SCENE_W} height={GROUND_Y + 10} fill={C.paper} opacity="0.38" />

      {/* Ground: soil, with ash on top that fades as the floor recovers. */}
      <path d={ground} fill={C.soil} />
      <path d={ground} fill={C.floor} opacity={f((1 - scene.ash) * 0.75)} />
      <path d={ground} fill={C.ash} opacity={f(scene.ash * 0.85)} />
      <path d={ground} fill="none" stroke={C.ink} strokeWidth="1" strokeOpacity="0.6" />

      {scene.snags
        .filter((s) => s.depth === 0)
        .map((s) => (
          <Snag key={s.key} s={s} seed={seed} />
        ))}
      {scene.ground
        .filter((g) => g.kind === 'moss' || g.kind === 'litter')
        .map((g) => (
          <GroundPlant key={g.key} g={g} seed={seed} />
        ))}
      {front.map((t) => (
        <TreeAt key={t.key} t={t} seed={seed} />
      ))}
      {scene.ground
        .filter((g) => g.kind !== 'moss' && g.kind !== 'litter')
        .map((g) => (
          <GroundPlant key={g.key} g={g} seed={seed} />
        ))}
      {labels && <SpeciesLabels trees={scene.trees} seed={seed} />}
    </svg>
  );
});
