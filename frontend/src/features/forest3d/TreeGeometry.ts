/**
 * Unit tree silhouettes (1 unit tall, base at the origin) for instancing.
 * Faceted on purpose: flat-shaded planes and jagged star-shaped branch tiers
 * read as an architectural model, not a game asset. Grayscale vertex colours
 * separate wood from foliage. Each kind also has an outline shell (the same
 * shape pushed out along smoothed normals, drawn back-faced in ink) that gives
 * the fine silhouette line of the drawing.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './heightField';
import type { PlantKind } from './scatter';

/** Grayscale values (sRGB) per material part. */
export const TONES = {
  bark: '#4a4a4a',
  conifer: '#8e8e8e',
  coniferDark: '#7a7a7a',
  broadleaf: '#b9b9b9',
  shrub: '#cfcfcf',
  snag: '#7c7c7c',
} as const;

function paint(geo: THREE.BufferGeometry, tone: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const c = new THREE.Color(tone);
  const n = g.attributes.position!.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Tapered trunk from y0 to y1. */
function trunk(y0: number, y1: number, r0: number, r1: number, tone: string = TONES.bark) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 7, 1);
  g.translate(0, (y0 + y1) / 2, 0);
  return paint(g, tone);
}

/**
 * One branch tier: a star-shaped skirt. `points` long branch tips alternate with
 * short notches; tips droop below the tier base, giving the serrated outline of
 * spruce and fir in elevation.
 */
function tier(
  y0: number,
  height: number,
  radius: number,
  points: number,
  rot: number,
  droop: number,
  tone: string,
  offset: [number, number] = [0, 0],
) {
  const ring: THREE.Vector3[] = [];
  const n = points * 2;
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2;
    const tip = k % 2 === 0;
    const r = tip ? radius : radius * 0.52;
    const y = tip ? y0 - droop * height : y0 + height * 0.12;
    ring.push(new THREE.Vector3(offset[0] + Math.cos(a) * r, y, offset[1] + Math.sin(a) * r));
  }
  const apex = new THREE.Vector3(offset[0], y0 + height, offset[1]);
  const under = new THREE.Vector3(offset[0], y0 + height * 0.18, offset[1]);
  const pos: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = ring[k]!;
    const b = ring[(k + 1) % n]!;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, apex.x, apex.y, apex.z);
    pos.push(b.x, b.y, b.z, a.x, a.y, a.z, under.x, under.y, under.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return paint(g, tone);
}

/** A lumpy crown: clustered low-poly spheres (faceted, not smooth). */
function cluster(
  centre: [number, number, number],
  spread: [number, number, number],
  count: number,
  rMin: number,
  rMax: number,
  tone: string,
  seed: number,
) {
  const random = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const r = rMin + (rMax - rMin) * random();
    const g = new THREE.IcosahedronGeometry(r, 1);
    // Flatten slightly: crowns are wider than tall.
    g.scale(1, 0.86, 1);
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random());
    g.translate(
      centre[0] + Math.cos(a) * d * spread[0],
      centre[1] + (random() - 0.5) * 2 * spread[1],
      centre[2] + Math.sin(a) * d * spread[2],
    );
    parts.push(paint(g, tone));
  }
  return parts;
}

/** A straight branch from `from` toward `dir`, `length` long. */
function branch(
  from: [number, number, number],
  dir: [number, number, number],
  length: number,
  r: number,
  tone: string = TONES.bark,
) {
  const g = new THREE.CylinderGeometry(r * 0.6, r, length, 5, 1);
  g.translate(0, length / 2, 0);
  const d = new THREE.Vector3(...dir).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
  g.translate(...from);
  return paint(g, tone);
}

function spruce(): THREE.BufferGeometry {
  const parts = [trunk(0, 0.9, 0.03, 0.012)];
  const tiers = 11;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = 0.1 + t * 0.78;
    const r = 0.2 * Math.pow(1 - t, 1.05) + 0.025;
    parts.push(tier(y, 0.17, r, 7, i * 0.83, 0.35, i % 2 ? TONES.conifer : TONES.coniferDark));
  }
  parts.push(tier(0.9, 0.1, 0.03, 4, 0, 0.2, TONES.coniferDark));
  return mergeGeometries(parts)!;
}

function fir(): THREE.BufferGeometry {
  const parts = [trunk(0, 0.85, 0.035, 0.015)];
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = 0.08 + t * 0.74;
    const r = 0.27 * Math.pow(1 - t, 0.8) + 0.04;
    parts.push(tier(y, 0.22, r, 9, i * 1.21, 0.22, TONES.coniferDark));
  }
  parts.push(tier(0.84, 0.16, 0.05, 5, 0.4, 0.2, TONES.conifer));
  return mergeGeometries(parts)!;
}

/** Pine: a long bare trunk and an irregular, off-centre crown near the top. */
function pine(): THREE.BufferGeometry {
  const parts = [trunk(0, 0.92, 0.032, 0.016)];
  const crown: [number, number, number, number][] = [
    [0.56, 0.16, 0.05, -0.03],
    [0.66, 0.19, -0.06, 0.04],
    [0.76, 0.15, 0.04, 0.05],
    [0.85, 0.11, -0.02, -0.03],
  ];
  crown.forEach(([y, r, ox, oz], i) =>
    parts.push(tier(y, 0.14, r, 6, i * 1.7, 0.18, TONES.conifer, [ox, oz])),
  );
  parts.push(branch([0, 0.5, 0], [0.8, 0.5, 0.1], 0.12, 0.01));
  parts.push(branch([0, 0.6, 0], [-0.7, 0.6, -0.2], 0.1, 0.01));
  return mergeGeometries(parts)!;
}

function broadleaf(): THREE.BufferGeometry {
  const parts = [trunk(0, 0.55, 0.04, 0.022)];
  parts.push(branch([0, 0.38, 0], [0.5, 1, 0.2], 0.26, 0.018));
  parts.push(branch([0, 0.42, 0], [-0.55, 1, -0.15], 0.24, 0.016));
  parts.push(branch([0, 0.48, 0], [0.1, 1, -0.6], 0.2, 0.014));
  parts.push(...cluster([0, 0.7, 0], [0.18, 0.1, 0.18], 9, 0.1, 0.17, TONES.broadleaf, 7));
  return mergeGeometries(parts)!;
}

/** Snag: a bare, broken trunk with a few stubs (the fire's standing dead). */
function snag(): THREE.BufferGeometry {
  const parts = [trunk(0, 1, 0.034, 0.01, TONES.snag)];
  parts.push(branch([0, 0.45, 0], [0.8, 0.4, 0.2], 0.12, 0.012, TONES.snag));
  parts.push(branch([0, 0.62, 0], [-0.7, 0.5, 0.3], 0.1, 0.01, TONES.snag));
  parts.push(branch([0, 0.78, 0], [0.3, 0.6, -0.7], 0.08, 0.008, TONES.snag));
  return mergeGeometries(parts)!;
}

function shrub(): THREE.BufferGeometry {
  return mergeGeometries(cluster([0, 0.4, 0], [0.32, 0.12, 0.32], 6, 0.24, 0.38, TONES.shrub, 3))!;
}

const BUILDERS: Record<PlantKind, () => THREE.BufferGeometry> = {
  spruce,
  fir,
  pine,
  broadleaf,
  snag,
  shrub,
};

/** Outline thickness, in unit-geometry space, per kind (trees are scaled ~5–11×). */
const OUTLINE: Record<PlantKind, number> = {
  spruce: 0.0045,
  fir: 0.0045,
  pine: 0.0045,
  broadleaf: 0.006,
  snag: 0.004,
  shrub: 0.018,
};

/** The silhouette shell: welded, smoothed normals, pushed outward. */
function outlineOf(geo: THREE.BufferGeometry, width: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position!.clone());
  const welded = mergeVertices(g, 1e-4);
  welded.computeVertexNormals();
  const p = welded.attributes.position!;
  const n = welded.attributes.normal!;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) + n.getX(i) * width,
      p.getY(i) + n.getY(i) * width,
      p.getZ(i) + n.getZ(i) * width,
    );
  }
  welded.deleteAttribute('normal');
  return welded;
}

export interface TreeShape {
  body: THREE.BufferGeometry;
  outline: THREE.BufferGeometry;
}

export function buildTreeShapes(): Record<PlantKind, TreeShape> {
  const out = {} as Record<PlantKind, TreeShape>;
  for (const kind of Object.keys(BUILDERS) as PlantKind[]) {
    const body = BUILDERS[kind]();
    out[kind] = { body, outline: outlineOf(body, OUTLINE[kind]) };
  }
  return out;
}
