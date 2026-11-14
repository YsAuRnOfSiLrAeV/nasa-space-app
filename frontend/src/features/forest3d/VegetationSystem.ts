/**
 * Plants → instanced meshes: one InstancedMesh per silhouette for the body and
 * one for its ink outline shell, sharing the same instance matrices. A few
 * thousand plants stay a dozen draw calls.
 */
import * as THREE from 'three';
import { buildTreeShapes } from './TreeGeometry';
import type { Plant, PlantKind } from './scatter';

export const OUTLINE_INK = '#2b2b2b';

export interface Vegetation {
  group: THREE.Group;
  counts: Record<PlantKind, number>;
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

  for (const kind of Object.keys(shapes) as PlantKind[]) {
    const mine = plants.filter((pl) => pl.kind === kind);
    counts[kind] = mine.length;
    if (!mine.length) continue;
    const body = new THREE.InstancedMesh(shapes[kind].body, bodyMat, mine.length);
    const ink = new THREE.InstancedMesh(shapes[kind].outline, inkMat, mine.length);
    body.castShadow = kind !== 'shrub';
    body.receiveShadow = true;
    mine.forEach((pl, i) => {
      e.set(pl.lean, pl.yaw, pl.lean * 0.6);
      q.setFromEuler(e);
      // Sunk a little so trunks meet sloping ground without a gap.
      p.set(pl.x, pl.y - 0.15, pl.z);
      s.set(pl.height, pl.height, pl.height);
      m.compose(p, q, s);
      body.setMatrixAt(i, m);
      ink.setMatrixAt(i, m);
    });
    body.instanceMatrix.needsUpdate = true;
    ink.instanceMatrix.needsUpdate = true;
    body.computeBoundingSphere();
    ink.computeBoundingSphere();
    group.add(body, ink);
  }

  return {
    group,
    counts,
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
