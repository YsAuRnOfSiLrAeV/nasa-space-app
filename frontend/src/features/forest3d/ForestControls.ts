/**
 * Orbit, zoom and pan around the block, with limits that keep it a model on a
 * table: never under the ground plane, never so close the drawing breaks up,
 * never panned off the block. Touch: one finger orbits, two zoom and pan.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const ZOOM_LIMITS = { min: 0.55, max: 7 };

export function createControls(
  camera: THREE.OrthographicCamera,
  dom: HTMLElement,
  blockSize: number,
): OrbitControls {
  const controls = new OrbitControls(camera, dom);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minZoom = ZOOM_LIMITS.min;
  controls.maxZoom = ZOOM_LIMITS.max;
  controls.minPolarAngle = (8 * Math.PI) / 180;
  controls.maxPolarAngle = (84 * Math.PI) / 180;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.7;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();
  controls.saveState();

  // Keep the pivot over the block.
  const limit = blockSize / 2;
  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, -limit, limit);
    const cz = THREE.MathUtils.clamp(t.z, -limit, limit);
    const cy = THREE.MathUtils.clamp(t.y, -10, 20);
    if (cx !== t.x || cy !== t.y || cz !== t.z) {
      const dx = cx - t.x;
      const dy = cy - t.y;
      const dz = cz - t.z;
      t.set(cx, cy, cz);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
  });
  return controls;
}
