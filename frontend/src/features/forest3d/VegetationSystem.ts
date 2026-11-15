/**
 * Plants → instanced meshes: one InstancedMesh per silhouette for the body and
 * one for its ink outline shell, sharing the same instance matrices. A few
 * thousand plants stay a dozen draw calls.
 *
 * Every plant keeps its instance; `setHeights` rescales them in place (height 0
 * hides one), so a year change touches matrices only, never geometry.
 */
import * as THREE from 'three';
import { buildTreeShapes } from './TreeGeometry';
import type { Plant, PlantKind } from './scatter';

export const OUTLINE_INK = '#2b2b2b';

export interface Vegetation {
  group: THREE.Group;
  counts: Record<PlantKind, number>;
  /** One height per plant, in the order the plants were given; 0 hides a plant. */
  setHeights: (heights: ArrayLike<number>) => void;
  dispose: () => void;
}

export function buildVegetation(plants: Plant[]): Vegetation {
  const shapes = buildTreeShapes();
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const inkMat = new THREE.MeshBasicMaterial({ color: OUTLINE_INK, side: THREE.BackSide });
  const counts = {} as Record<PlantKind, number>;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const meshes: { body: THREE.InstancedMesh; ink: THREE.InstancedMesh; members: number[] }[] = [];

  const place = (
    body: THREE.InstancedMesh,
    ink: THREE.InstancedMesh,
    slot: number,
    pl: Plant,
    h: number,
  ) => {
    e.set(pl.lean, pl.yaw, pl.lean * 0.6);
    q.setFromEuler(e);
    // Sunk a little so trunks meet sloping ground without a gap.
    p.set(pl.x, pl.y - 0.15, pl.z);
    // A hidden plant is scaled to nothing (it stays in its slot for the next year).
    const size = h > 0 ? h : 1e-6;
    s.set(size, size, size);
    m.compose(p, q, s);
    body.setMatrixAt(slot, m);
    ink.setMatrixAt(slot, m);
  };

  for (const kind of Object.keys(shapes) as PlantKind[]) {
    const members = plants.flatMap((pl, index) => (pl.kind === kind ? [index] : []));
    counts[kind] = members.length;
    if (!members.length) continue;
    const body = new THREE.InstancedMesh(shapes[kind].body, bodyMat, members.length);
    const ink = new THREE.InstancedMesh(shapes[kind].outline, inkMat, members.length);
    body.castShadow = kind !== 'shrub';
    body.receiveShadow = true;
    // Heights change by year: the block always fits the view, so skip culling.
    body.frustumCulled = false;
    ink.frustumCulled = false;
    members.forEach((index, slot) => place(body, ink, slot, plants[index]!, plants[index]!.height));
    body.instanceMatrix.needsUpdate = true;
    ink.instanceMatrix.needsUpdate = true;
    group.add(body, ink);
    meshes.push({ body, ink, members });
  }

  return {
    group,
    counts,
    setHeights: (heights) => {
      for (const { body, ink, members } of meshes) {
        members.forEach((index, slot) => place(body, ink, slot, plants[index]!, heights[index]!));
        body.instanceMatrix.needsUpdate = true;
        ink.instanceMatrix.needsUpdate = true;
      }
    },
    dispose: () => {
      for (const shape of Object.values(shapes)) {
        shape.body.dispose();
        shape.outline.dispose();
      }
      bodyMat.dispose();
      inkMat.dispose();
    },
  };
}
