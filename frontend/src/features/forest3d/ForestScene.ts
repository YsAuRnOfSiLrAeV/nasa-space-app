/**
 * The 3D forest scene: owns the renderer, camera, controls and the built model
 * for one container element. Renders on demand (only while the view moves or
 * after a resize), so an idle view costs nothing. React only mounts it, calls
 * `resetView` and `dispose`.
 *
 * Scene generation (height field, scatter) is pure and separate; this class
 * only turns their output into Three.js objects.
 */
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCamera, fitCamera, homeCamera } from './ForestCamera';
import { createControls } from './ForestControls';
import { createLighting } from './ForestLighting';
import { createHeightField } from './heightField';
import { scatterPlants, type PlantKind } from './scatter';
import { buildTerrainBlock } from './TerrainBlock';
import { buildVegetation } from './VegetationSystem';
import { ILLUSTRATIVE_STAND, type StandParams } from './recoveryAdapter';

export const PAPER = '#ffffff';
const BLOCK_SIZE = 120;

/** Thrown when WebGL cannot start; the viewer shows its fallback. */
export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL is not available in this browser.');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

export function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface ForestSceneStats {
  plants: Record<PlantKind, number>;
}

export class ForestScene {
  readonly stats: ForestSceneStats;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private controls: OrbitControls;
  private disposers: (() => void)[] = [];
  private raf = 0;
  private resize: ResizeObserver;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    {
      stand = ILLUSTRATIVE_STAND,
      onContextLost,
    }: { stand?: StandParams; onContextLost?: () => void } = {},
  ) {
    if (!webglSupported()) throw new WebGLUnavailableError();
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      throw new WebGLUnavailableError(e);
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(PAPER, 1);
    r.domElement.style.display = 'block';
    r.domElement.style.width = '100%';
    r.domElement.style.height = '100%';
    r.domElement.style.touchAction = 'none';
    container.appendChild(r.domElement);

    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      onContextLost?.();
    });

    // Model.
    const field = createHeightField({ size: BLOCK_SIZE, seed: stand.seed % 1000 });
    const block = buildTerrainBlock(field);
    const plants = scatterPlants(field, stand);
    const vegetation = buildVegetation(plants.filter((p) => p.y > block.waterLevel + 0.05));
    const lighting = createLighting(BLOCK_SIZE);
    this.scene.add(block.group, vegetation.group, lighting.group);
    this.disposers.push(block.dispose, vegetation.dispose, lighting.dispose);
    this.stats = { plants: vegetation.counts };

    // View.
    const { width, height } = this.size();
    r.setSize(width, height, false);
    this.camera = createCamera(BLOCK_SIZE, width / height);
    this.controls = createControls(this.camera, r.domElement, BLOCK_SIZE);
    this.controls.addEventListener('change', this.requestRender);
    this.controls.addEventListener('start', this.requestRender);

    this.resize = new ResizeObserver(() => {
      const s = this.size();
      r.setSize(s.width, s.height, false);
      fitCamera(this.camera, BLOCK_SIZE, s.width / s.height);
      this.requestRender();
    });
    this.resize.observe(container);
    this.requestRender();
  }

  /** Back to the home axonometric. */
  resetView = () => {
    this.controls.reset();
    homeCamera(this.camera);
    this.controls.target.set(0, 2, 0);
    this.controls.update();
    this.requestRender();
  };

  private size() {
    return {
      width: Math.max(1, this.container.clientWidth),
      height: Math.max(1, this.container.clientHeight),
    };
  }

  private requestRender = () => {
    if (this.disposed || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  /** One frame; keeps going only while damping is still moving the camera. */
  private tick = () => {
    this.raf = 0;
    if (this.disposed) return;
    const moving = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (moving) this.requestRender();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.controls.dispose();
    this.disposers.forEach((d) => d());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
