/**
 * Where each plant stands: a deterministic jittered-grid scatter over the height
 * field. Density follows a broad noise field (stands and clearings), thins on
 * steep slopes and stays out of the stream; species follow elevation (conifers
 * higher, broadleaf lower, toward the water). Pure and DOM-free.
 */
import { fbm, hash2, rng, slopeAt, type HeightField } from './heightField';
import type { StandParams } from './recoveryAdapter';

export type PlantKind = 'spruce' | 'fir' | 'pine' | 'broadleaf' | 'snag' | 'shrub';

export interface Plant {
  kind: PlantKind;
  x: number;
  y: number;
  z: number;
  /** Height in scene units (the unit geometry is 1 tall). */
  height: number;
  /** Rotation about the vertical axis, radians. */
  yaw: number;
  /** Small lean, radians (snags and edge trees). */
  lean: number;
  /**
   * Fixed 0..1 order in which this plant appears (low ranks first) when a year shows
   * only part of the stand. Hashed from the position, so it never changes.
   */
  rank: number;
  /** Fixed 0..1 position in the year's height distribution (tall trees high). */
  heightRank: number;
}

const KINDS = ['spruce', 'fir', 'pine', 'broadleaf', 'snag'] as const;

/** Typical mature height (scene units) per silhouette. */
const HEIGHT: Record<PlantKind, [number, number]> = {
  spruce: [6.5, 10],
  fir: [5.5, 8.5],
  pine: [7.5, 11],
  broadleaf: [4.5, 7],
  snag: [4, 8],
  shrub: [0.9, 1.8],
};

export function scatterPlants(field: HeightField, stand: StandParams): Plant[] {
  const random = rng(stand.seed);
  const half = field.size / 2;
  const inset = 1.6;
  const plants: Plant[] = [];
  const range = field.max - field.min || 1;

  const openness = (x: number, z: number) => fbm(x / 26 + 40, z / 26 + 9, stand.seed % 997, 3);

  const place = (kind: PlantKind, x: number, z: number, scale = 1) => {
    const [lo, hi] = HEIGHT[kind];
    // Shrubs and fire-killed snags keep their height whatever the stand's scale.
    const h =
      (lo + (hi - lo) * random()) *
      scale *
      (kind === 'shrub' || kind === 'snag' ? 1 : stand.heightScale);
    const ix = Math.round(x * 1000);
    const iz = Math.round(z * 1000);
    plants.push({
      kind,
      x,
      y: field.sample(x, z),
      z,
      height: h,
      yaw: random() * Math.PI * 2,
      lean: kind === 'snag' ? (random() - 0.5) * 0.18 : (random() - 0.5) * 0.05,
      rank: hash2(ix, iz, stand.seed),
      heightRank: hash2(iz, ix, stand.seed + 7),
    });
  };

  // Trees on a jittered grid.
  const s = stand.spacing;
  for (let z = -half + inset; z <= half - inset; z += s) {
    for (let x = -half + inset; x <= half - inset; x += s) {
      const px = Math.min(half - inset, Math.max(-half + inset, x + (random() - 0.5) * s * 0.9));
      const pz = Math.min(half - inset, Math.max(-half + inset, z + (random() - 0.5) * s * 0.9));
      if (field.streamDistance(px, pz) < 2.4) continue;
      const slope = slopeAt(field, px, pz);
      const open = openness(px, pz);
      // Forest where the openness field is low enough for the stand's cover.
      const density =
        Math.min(1, Math.max(0, (stand.cover - open) * 3.2)) * (1 - Math.min(0.7, slope * 0.55));
      if (random() > density) continue;
      const e = (field.sample(px, pz) - field.min) / range;
      place(pickKind(stand, e, random()), px, pz);
    }
  }

  // Shrubs: open ground, clearings and the stream banks.
  const area = field.size * field.size;
  const shrubs = Math.round((area / 100) * stand.shrubDensity);
  for (let n = 0; n < shrubs; n++) {
    const x = -half + inset + random() * (field.size - inset * 2);
    const z = -half + inset + random() * (field.size - inset * 2);
    const d = field.streamDistance(x, z);
    if (d < 1.2) continue;
    const open = openness(x, z);
    const bank = d < 6 ? 0.6 : 0;
    if (random() > Math.min(1, Math.max(0, (open - stand.cover + 0.25) * 2.5) + bank)) continue;
    place('shrub', x, z);
  }
  return plants;
}

/** Elevation-weighted species pick: conifers on the heights, broadleaf in the lows. */
function pickKind(stand: StandParams, e: number, r: number): PlantKind {
  const w = {
    spruce: stand.mix.spruce * (0.6 + e),
    fir: stand.mix.fir * (0.7 + e * 0.8),
    pine: stand.mix.pine * (0.5 + e * 1.2),
    broadleaf: stand.mix.broadleaf * (1.6 - e * 1.3),
    snag: stand.mix.snag,
  };
  const total = KINDS.reduce((sum, k) => sum + w[k], 0);
  let acc = 0;
  for (const k of KINDS) {
    acc += w[k] / total;
    if (r <= acc) return k;
  }
  return 'spruce';
}
