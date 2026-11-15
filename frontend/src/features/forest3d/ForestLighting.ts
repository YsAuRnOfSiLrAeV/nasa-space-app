/**
 * Daylight for a white model: a soft sky/ground fill so shaded faces stay grey,
 * not black, and one low key light from the upper left whose crisp shadows
 * carry the relief and the tree silhouettes across the ground. No bloom, no
 * coloured light.
 */
import * as THREE from 'three';

export function createLighting(blockSize: number): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xffffff, 0xb4b4b4, 2.1));

  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-blockSize * 0.65, blockSize * 1.05, blockSize * 0.35);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  const half = blockSize * 0.78;
  const cam = sun.shadow.camera;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = 1;
  cam.far = blockSize * 3;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.35;
  group.add(sun, sun.target);

  return { group, dispose: () => sun.shadow.map?.dispose() };
}
