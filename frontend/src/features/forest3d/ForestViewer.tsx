import { useCallback, useRef, useState } from 'react';
import { ForestScene, WebGLUnavailableError } from './ForestScene';
import { standFromInput, type ForestStandInput } from './recoveryAdapter';
import styles from './forest3d.module.css';

type Status = 'starting' | 'ready' | 'unavailable' | 'lost';

/**
 * The 3D forest tile. React owns the container, the label and the reset
 * control; `ForestScene` owns everything rendered. `input` is accepted for the
 * later recovery timeline and does not change the scene yet.
 */
export function ForestViewer({
  input,
  className,
}: {
  input?: ForestStandInput;
  className?: string;
}) {
  const scene = useRef<ForestScene | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [attempt, setAttempt] = useState(0);

  // The scene attaches to its host element: a callback ref with cleanup (React 19)
  // starts it when the element mounts and disposes it when it goes. A new
  // `input` or a restart (`attempt`) builds a fresh scene.
  const host = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      let created: ForestScene | null = null;
      try {
        created = new ForestScene(el, {
          stand: standFromInput(input),
          onContextLost: () => setStatus('lost'),
        });
        scene.current = created;
        setStatus('ready');
      } catch (e) {
        if (!(e instanceof WebGLUnavailableError)) console.error(e);
        setStatus('unavailable');
      }
      return () => {
        created?.dispose();
        scene.current = null;
      };
    },
    // `attempt` re-creates the ref, so Restart builds a new scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, attempt],
  );

  return (
    <figure className={`${styles.viewer} ${className ?? ''}`}>
      <div
        ref={host}
        className={styles.stage}
        role="img"
        aria-label="Conceptual 3D illustration of a forest on a cut-out block of synthetic terrain: spruce, fir, pine and broadleaf trees, shrubs and standing dead trunks around a stream valley. Not measured terrain or forest data. Drag to orbit, scroll or pinch to zoom."
      />
      <div className={styles.label}>
        <span className={styles.labelIndex}>FIG. 3D / FOREST STRUCTURE</span>
        <strong>Conceptual illustration — not measured</strong>
        <span>Synthetic terrain and trees. Orthographic axonometric.</span>
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
        </p>
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
