/**
 * The 3D forest scene: owns the renderer, camera, controls and the built model
 * for one container element. Renders on demand (only while the view moves, a
 * year change animates, or after a resize), so an idle view costs nothing. React
 * only mounts it and calls its methods.
 *
 * Scene generation (height field, scatter, growth) is pure and separate; this
 * class only turns their output into Three.js objects.
 */
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCamera, fitCamera, homeCamera } from './ForestCamera';
import { createControls } from './ForestControls';
import { createLighting } from './ForestLighting';
import { growHeights } from './growth';
import { createHeightField } from './heightField';
import {
  ILLUSTRATIVE_STAND,
  MATURE_GROWTH,
  type GrowthParams,
  type StandParams,
} from './recoveryAdapter';
import { scatterPlants, type Plant, type PlantKind } from './scatter';
import { buildTerrainBlock } from './TerrainBlock';
import { buildVegetation, type Vegetation } from './VegetationSystem';

export const PAPER = '#ffffff';
const BLOCK_SIZE = 120;
/** How long a year change takes to grow into place. */
const GROWTH_MS = 700;

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

const ease = (t: number) => 1 - (1 - t) ** 3;

export class ForestScene {
  readonly stats: ForestSceneStats;
  /** The stand as scattered, in the order heights are given. */
  readonly plants: Plant[];
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private controls: OrbitControls;
  private vegetation: Vegetation;
  private heights: Float32Array;
  private tween: { from: Float32Array; to: Float32Array; start: number } | null = null;
  private disposers: (() => void)[] = [];
  private raf = 0;
  private resize: ResizeObserver;
  private disposed = false;
  private reducedMotion: boolean;

  constructor(
    private container: HTMLElement,
    {
      stand = ILLUSTRATIVE_STAND,
      growth = MATURE_GROWTH,
      onContextLost,
    }: { stand?: StandParams; growth?: GrowthParams; onContextLost?: () => void } = {},
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
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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
      // `dispose` drops the context on purpose: that is not a lost view.
      if (!this.disposed) onContextLost?.();
    });

    // Model. The stand is scattered once; growth only rescales it.
    const field = createHeightField({
      size: BLOCK_SIZE,
      seed: stand.seed % 1000,
      ...(stand.terrain && { relief: stand.terrain.relief, variant: stand.terrain.variant }),
    });
    const block = buildTerrainBlock(field, stand.burn);
    this.plants = scatterPlants(field, stand).filter((p) => p.y > block.waterLevel + 0.05);
    this.vegetation = buildVegetation(this.plants);
    this.heights = growHeights(this.plants, growth);
    this.vegetation.setHeights(this.heights);
    const lighting = createLighting(BLOCK_SIZE);
    this.scene.add(block.group, this.vegetation.group, lighting.group);
    this.disposers.push(block.dispose, this.vegetation.dispose, lighting.dispose);
    this.stats = { plants: this.vegetation.counts };

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

  /** Show another year: every plant grows (or shrinks, appears, falls) into place. */
  setGrowth(growth: GrowthParams, { animate = true }: { animate?: boolean } = {}) {
    const to = growHeights(this.plants, growth);
    if (!animate || this.reducedMotion) {
      this.tween = null;
      this.heights = to;
      this.vegetation.setHeights(to);
    } else {
      this.tween = { from: this.heights.slice(), to, start: performance.now() };
    }
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

  /**
   * Cheaper drawing for slow devices: no shadows and one pixel per CSS pixel.
   * The picture keeps every plant; only the light changes.
   */
  setLowDetail() {
    const r = this.renderer;
    r.shadowMap.enabled = false;
    r.setPixelRatio(1);
    const s = this.size();
    r.setSize(s.width, s.height, false);
    this.scene.traverse((object) => {
      if (object instanceof THREE.Light) object.castShadow = false;
      const material = (object as THREE.Mesh).material;
      if (material)
        (Array.isArray(material) ? material : [material]).forEach((m) => (m.needsUpdate = true));
    });
    this.requestRender();
  }

  /**
   * Median time of `frames` consecutive frames, in milliseconds: how fast this device
   * actually draws the scene. Rendering waits for the GPU at each frame boundary, so
   * the interval between frames includes its work.
   */
  measureFrameTime(frames = 24): Promise<number> {
    return new Promise((resolve) => {
      const times: number[] = [];
      let last = performance.now();
      const step = () => {
        if (this.disposed) return resolve(0);
        this.renderer.render(this.scene, this.camera);
        const now = performance.now();
        times.push(now - last);
        last = now;
        if (times.length > frames) {
          const sorted = times.slice(1).sort((a, b) => a - b);
          resolve(sorted[Math.floor(sorted.length / 2)]!);
        } else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

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

  /** One frame; keeps going while the camera damps or a year change is still growing. */
  private tick = () => {
    this.raf = 0;
    if (this.disposed) return;
    let growing = false;
    if (this.tween) {
      const t = Math.min(1, (performance.now() - this.tween.start) / GROWTH_MS);
      const k = ease(t);
      const { from, to } = this.tween;
      for (let i = 0; i < to.length; i++) this.heights[i] = from[i]! + (to[i]! - from[i]!) * k;
      this.vegetation.setHeights(this.heights);
      if (t >= 1) this.tween = null;
      else growing = true;
    }
    const moving = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (moving || growing) this.requestRender();
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
