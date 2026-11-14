/**
 * The architectural axonometric: an orthographic camera looking down on the
 * block from a corner (azimuth 45°, elevation 32°), framed so the whole block
 * fits with a margin at any aspect ratio.
 */
import * as THREE from 'three';

export const HOME = { azimuth: Math.PI / 4, elevation: (32 * Math.PI) / 180, distance: 260 };

/** World height the view frames at zoom 1 (block diagonal plus margin). */
function frameHeight(blockSize: number, aspect: number): number {
  const diag = blockSize * Math.SQRT2;
  // Narrow (portrait) views need more height to fit the block's width.
  return Math.max(diag * 0.78, (diag * 1.08) / Math.max(aspect, 0.01));
}

export function createCamera(blockSize: number, aspect: number): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  fitCamera(cam, blockSize, aspect);
  homeCamera(cam);
  return cam;
}

export function fitCamera(cam: THREE.OrthographicCamera, blockSize: number, aspect: number) {
  const h = frameHeight(blockSize, aspect) / 2;
  cam.left = -h * aspect;
  cam.right = h * aspect;
  cam.top = h;
  cam.bottom = -h;
  cam.updateProjectionMatrix();
}

/** The home pose (also what Reset view returns to). Target slightly below centre. */
export function homePosition(target = new THREE.Vector3(0, 2, 0)): THREE.Vector3 {
  const { azimuth, elevation, distance } = HOME;
  return new THREE.Vector3(
    target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
    target.y + distance * Math.sin(elevation),
    target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
  );
}

export function homeCamera(cam: THREE.OrthographicCamera) {
  cam.position.copy(homePosition());
  cam.zoom = 1;
  cam.lookAt(0, 2, 0);
  cam.updateProjectionMatrix();
}
