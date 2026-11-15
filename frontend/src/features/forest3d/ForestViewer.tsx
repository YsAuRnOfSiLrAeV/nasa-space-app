import { useCallback, useEffect, useRef, useState } from 'react';
import { ForestScene, WebGLUnavailableError } from './ForestScene';
import {
  ILLUSTRATIVE_STAND,
  MATURE_GROWTH,
  type GrowthParams,
  type StandParams,
} from './recoveryAdapter';
import styles from './forest3d.module.css';

type Status = 'starting' | 'ready' | 'unavailable' | 'lost' | 'slow';

/** Below this many frames per second the view switches to low detail, then to its fallback. */
const SLOW_FRAME_MS = 1000 / 15;

export interface ViewerLabel {
  index: string;
  title: string;
  note: string;
}

const DEFAULT_LABEL: ViewerLabel = {
  index: 'FIG. 3D / FOREST STRUCTURE',
  title: 'Conceptual illustration — not measured',
  note: 'Synthetic terrain and trees. Orthographic axonometric.',
};

/**
 * One 3D forest tile. React owns the container, the label and the controls;
 * `ForestScene` owns everything rendered. The scene is built once per `stand`;
 * a new `growth` (another year) regrows the same plants in place.
 *
 * On start it times a few frames. A slow device first loses shadows; if it is
 * still slow, a text fallback replaces the view, with a way to keep the 3D anyway.
 */
export function ForestViewer({
  stand = ILLUSTRATIVE_STAND,
  growth = MATURE_GROWTH,
  label = DEFAULT_LABEL,
  compact = false,
  fallback,
  className,
}: {
  stand?: StandParams;
  growth?: GrowthParams;
  label?: ViewerLabel;
  /** A shorter tile, for two side by side. */
  compact?: boolean;
  /** What a slow device shows instead of the 3D view (the same numbers, as text). */
  fallback?: React.ReactNode;
  className?: string;
}) {
  const scene = useRef<ForestScene | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [lowDetail, setLowDetail] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The growth the scene is built with; later changes go through setGrowth.
  const growthRef = useRef(growth);

  // The scene attaches to its host element: a callback ref with cleanup (React 19)
  // starts it when the element mounts and disposes it when it goes. A new `stand`
  // or a restart (`attempt`) builds a fresh scene.
  const host = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      let created: ForestScene | null = null;
      let live = true;
      try {
        created = new ForestScene(el, {
          stand,
          growth: growthRef.current,
          // Only this scene's own loss counts: a disposed scene must not mark its successor.
          onContextLost: () => live && setStatus('lost'),
        });
        scene.current = created;
        setStatus('ready');
        setLowDetail(false);
        const probe = created;
        void probe.measureFrameTime().then(async (ms) => {
          if (!live || ms < SLOW_FRAME_MS) return;
          probe.setLowDetail();
          setLowDetail(true);
          const again = await probe.measureFrameTime();
          if (live && again >= SLOW_FRAME_MS) setStatus('slow');
        });
      } catch (e) {
        if (!(e instanceof WebGLUnavailableError)) console.error(e);
        setStatus('unavailable');
      }
      return () => {
        live = false;
        created?.dispose();
        scene.current = null;
      };
    },
    // `attempt` re-creates the ref, so Restart builds a new scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stand, attempt],
  );

  useEffect(() => {
    growthRef.current = growth;
    scene.current?.setGrowth(growth);
  }, [growth]);

  return (
    <figure className={`${styles.viewer} ${className ?? ''}`}>
      <div
        ref={host}
        className={compact ? `${styles.stage} ${styles.compact}` : styles.stage}
        role="img"
        aria-label={`${label.title}. ${label.note} Conceptual 3D illustration of a forest on a cut-out block of synthetic terrain: spruce, fir, pine and broadleaf trees, shrubs and standing dead trunks around a stream valley. Not measured terrain or forest data. Drag to orbit, scroll or pinch to zoom.`}
        inert={status === 'slow'}
      />
      <div className={styles.label}>
        <span className={styles.labelIndex}>{label.index}</span>
        <strong>{label.title}</strong>
        <span>{label.note}</span>
      </div>
      {status === 'ready' && (
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={() => scene.current?.resetView()}>
            Reset view
          </button>
        </div>
      )}
      {status === 'ready' && (
        <p className={styles.hint} aria-hidden="true">
          Drag to orbit · scroll or pinch to zoom · right-drag or two fingers to pan
          {lowDetail && ' · shadows off for speed'}
        </p>
      )}
      {status === 'slow' && (
        <div role="status" className={styles.fallback}>
          <p>
            <strong>This device draws the 3D view too slowly.</strong>
          </p>
          {fallback}
          <p>The illustration adds no data, so nothing is lost without it.</p>
          <button type="button" className={styles.tool} onClick={() => setStatus('ready')}>
            Show the 3D view anyway
          </button>
        </div>
      )}
      {(status === 'unavailable' || status === 'lost') && (
        <div role="alert" className={styles.fallback}>
          <p>
            <strong>
              {status === 'lost' ? 'The 3D view stopped.' : 'The 3D view cannot start here.'}
            </strong>
          </p>
          <p>
            {status === 'lost'
              ? 'The graphics context was lost (the device may be low on memory).'
              : 'This browser or device does not provide WebGL.'}{' '}
            The illustration shows a conceptual forest block; no data is lost without it.
          </p>
          {fallback}
          {status === 'lost' && (
            <button type="button" className={styles.tool} onClick={() => setAttempt((a) => a + 1)}>
              Restart the 3D view
            </button>
          )}
        </div>
      )}
    </figure>
  );
}
