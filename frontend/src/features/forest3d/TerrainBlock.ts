/**
 * The cut-out terrain block: an irregular surface, its four section walls down
 * to a flat base (like a model cut from a landscape), water lying in the valley,
 * fine contour linework on top, strata lines on the walls and an ink outline
 * on the block edges. Grayscale, matte, no glow.
 */
import * as THREE from 'three';
import { createBurnMask, outlineRings, type BurnShape } from './burn';
import { contourSegments, type HeightField } from './heightField';

export const BLOCK_TONES = {
  surface: '#efefed',
  scorched: '#d6d4cf',
  wall: '#dcdcd9',
  base: '#9c9c9a',
  water: '#a7a9ab',
  contour: '#a3a3a0',
  contourIndex: '#7a7a78',
  strata: '#9a9a97',
  ink: '#161616',
} as const;

export interface TerrainBlock {
  group: THREE.Group;
  /** Depth of the base below the lowest ground, scene units. */
  base: number;
  waterLevel: number;
  dispose: () => void;
}

const line = (color: string, opacity = 1) =>
  new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });

export function buildTerrainBlock(field: HeightField, burn?: BurnShape | null): TerrainBlock {
  const { size, res, heights } = field;
  const half = size / 2;
  const base = -9;
  const waterLevel = field.min + (field.max - field.min) * 0.075;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  // Surface.
  const surface = keep(new THREE.PlaneGeometry(size, size, res - 1, res - 1));
  surface.rotateX(-Math.PI / 2);
  const sp = surface.attributes.position!;
  for (let k = 0; k < sp.count; k++) {
    // After rotateX(-π/2) the plane's rows run from z = -half to +half and its
    // columns from x = -half to +half: the same order as the field.
    const i = k % res;
    const j = Math.floor(k / res);
    sp.setY(k, heights[j * res + i]!);
  }
  surface.computeVertexNormals();
  // Ground inside the burn is a little darker, so the burn reads even where no tree stands.
  const mask = burn ? createBurnMask(burn) : null;
  if (mask) {
    const base = new THREE.Color(BLOCK_TONES.surface);
    const scorched = new THREE.Color(BLOCK_TONES.scorched);
    const colors = new Float32Array(sp.count * 3);
    for (let k = 0; k < sp.count; k++) {
      const c = mask(sp.getX(k), sp.getZ(k)) ? scorched : base;
      colors.set([c.r, c.g, c.b], k * 3);
    }
    surface.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const surfaceMat = keep(
    new THREE.MeshStandardMaterial({
      color: mask ? '#ffffff' : BLOCK_TONES.surface,
      vertexColors: Boolean(mask),
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  const top = new THREE.Mesh(surface, surfaceMat);
  top.receiveShadow = true;
  group.add(top);

  // Section walls: from the ground (or the water, where it is higher) down to the base.
  const edge = (t: number, side: number): [number, number] => {
    const s = -half + t * size;
    switch (side) {
      case 0:
        return [s, half]; // near (+z)
      case 1:
        return [half, -s]; // right (+x)
      case 2:
        return [-s, -half]; // far (-z)
      default:
        return [-half, s]; // left (-x)
    }
  };
  const wallPos: number[] = [];
  const wallTop = (x: number, z: number) => Math.max(field.sample(x, z), waterLevel);
  const steps = res - 1;
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < steps; k++) {
      const [x0, z0] = edge(k / steps, side);
      const [x1, z1] = edge((k + 1) / steps, side);
      const y0 = wallTop(x0, z0);
      const y1 = wallTop(x1, z1);
      wallPos.push(x0, y0, z0, x0, base, z0, x1, y1, z1);
      wallPos.push(x1, y1, z1, x0, base, z0, x1, base, z1);
    }
  }
  const walls = keep(new THREE.BufferGeometry());
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  walls.computeVertexNormals();
  const wallMat = keep(
    new THREE.MeshStandardMaterial({
      color: BLOCK_TONES.wall,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  const wallMesh = new THREE.Mesh(walls, wallMat);
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // Base slab underside.
  const bottom = keep(new THREE.PlaneGeometry(size, size));
  bottom.rotateX(Math.PI / 2);
  bottom.translate(0, base, 0);
  group.add(
    new THREE.Mesh(
      bottom,
      keep(new THREE.MeshStandardMaterial({ color: BLOCK_TONES.base, roughness: 1 })),
    ),
  );

  // Water: a flat sheet at the valley level, hidden under higher ground.
  const water = keep(new THREE.PlaneGeometry(size, size));
  water.rotateX(-Math.PI / 2);
  water.translate(0, waterLevel, 0);
  const waterMesh = new THREE.Mesh(
    water,
    keep(
      new THREE.MeshStandardMaterial({ color: BLOCK_TONES.water, roughness: 0.55, metalness: 0 }),
    ),
  );
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // The burn's outline, draped on the ground.
  if (burn) {
    const outline = keep(new THREE.BufferGeometry());
    const pos: number[] = [];
    for (const ring of outlineRings(burn))
      for (let k = 0; k < ring.length - 1; k++) {
        const [x0, z0] = ring[k]!;
        const [x1, z1] = ring[k + 1]!;
        const parts = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.2));
        for (let p = 0; p < parts; p++) {
          const a = p / parts;
          const b = (p + 1) / parts;
          const xa = x0 + (x1 - x0) * a;
          const za = z0 + (z1 - z0) * a;
          const xb = x0 + (x1 - x0) * b;
          const zb = z0 + (z1 - z0) * b;
          pos.push(xa, field.sample(xa, za) + 0.12, za, xb, field.sample(xb, zb) + 0.12, zb);
        }
      }
    outline.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    group.add(new THREE.LineSegments(outline, keep(line(BLOCK_TONES.ink, 0.9))));
  }

  // Contours on the surface, lifted a hair to sit on top.
  const interval = (field.max - field.min) / 24;
  const { minor, index } = contourSegments(field, interval, 5);
  const lift = (arr: number[]) => {
    for (let k = 1; k < arr.length; k += 3) arr[k]! += 0.04;
    return arr;
  };
  for (const [segs, color, opacity] of [
    [minor, BLOCK_TONES.contour, 0.8],
    [index, BLOCK_TONES.contourIndex, 1],
  ] as const) {
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(lift([...segs]), 3));
    group.add(new THREE.LineSegments(g, keep(line(color, opacity))));
  }

  // Strata on the walls: horizontal lines below the ground line, every `gap` units.
  const strata: number[] = [];
  const gap = 1.5;
  const out = 0.02;
  for (let side = 0; side < 4; side++) {
    for (let y = base + gap; y < field.max; y += gap) {
      for (let k = 0; k < steps; k++) {
        const [x0, z0] = edge(k / steps, side);
        const [x1, z1] = edge((k + 1) / steps, side);
        if (wallTop(x0, z0) - 0.2 < y || wallTop(x1, z1) - 0.2 < y) continue;
        const [nx, nz] =
          side === 0 ? [0, out] : side === 1 ? [out, 0] : side === 2 ? [0, -out] : [-out, 0];
        strata.push(x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz);
      }
    }
  }
  const strataGeo = keep(new THREE.BufferGeometry());
  strataGeo.setAttribute('position', new THREE.Float32BufferAttribute(strata, 3));
  group.add(new THREE.LineSegments(strataGeo, keep(line(BLOCK_TONES.strata, 0.9))));

  // Ink outline: the ground profile along each edge, the vertical corners, the base rectangle.
  const ink: number[] = [];
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < steps; k++) {
      const [x0, z0] = edge(k / steps, side);
      const [x1, z1] = edge((k + 1) / steps, side);
      ink.push(x0, wallTop(x0, z0) + 0.03, z0, x1, wallTop(x1, z1) + 0.03, z1);
    }
    const [cx, cz] = edge(0, side);
    const [dx, dz] = edge(1, side);
    ink.push(cx, base, cz, cx, wallTop(cx, cz), cz);
    ink.push(cx, base, cz, dx, base, dz);
  }
  const inkGeo = keep(new THREE.BufferGeometry());
  inkGeo.setAttribute('position', new THREE.Float32BufferAttribute(ink, 3));
  group.add(new THREE.LineSegments(inkGeo, keep(line(BLOCK_TONES.ink))));

  return {
    group,
    base,
    waterLevel,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
