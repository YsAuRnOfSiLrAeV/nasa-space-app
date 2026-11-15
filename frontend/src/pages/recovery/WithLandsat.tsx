import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import type { RecoveryFile } from '@/data/recoverySchema';
import type { RecoveryDataState } from '@/hooks/useRecoveryData';
import styles from './Recovery.module.css';

type Unavailable = Exclude<RecoveryDataState, { status: 'ready' }>;

/**
 * The only place that reads the group's Landsat load state. Renders its child
 * with the loaded file; otherwise says why the content is missing (loading,
 * never fetched, failed) and draws nothing in its place.
 */
export function WithLandsat({
  state,
  what,
  absent,
  variant = 'note',
  children,
}: {
  state: RecoveryDataState;
  /** What is missing, in running text: "satellite imagery", "the yearly greenness record". */
  what: string;
  /** Replaces the default "has not been fetched" sentence. */
  absent?: string;
  /** `panel` reserves the content's space with a dashed box (for imagery). */
  variant?: 'note' | 'panel';
  children: (landsat: RecoveryFile) => ReactNode;
}) {
  if (state.status === 'ready') return children(state.data);
  return <LandsatUnavailable state={state} what={what} absent={absent} variant={variant} />;
}

function LandsatUnavailable({
  state,
  what,
  absent,
  variant,
}: {
  state: Unavailable;
  what: string;
  absent?: string;
  variant: 'note' | 'panel';
}) {
  const absentText =
    absent ??
    `Landsat data has not been fetched for this group, so ${what} is not shown. Nothing is drawn in its place.`;

  if (variant === 'note') {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground" role="note">
        {state.status === 'loading'
          ? `Loading ${what}…`
          : state.status === 'error'
            ? `Could not load ${what}: ${state.message}`
            : absentText}
      </p>
    );
  }

  return (
    <div className={styles.empty} role="note" aria-label={what}>
      <div className="max-w-[24rem] space-y-2">
        <p className={cn(ui.micro, 'text-foreground')}>
          {state.status === 'loading'
            ? `Loading ${what}…`
            : state.status === 'error'
              ? `Could not load ${what}`
              : `No ${what} loaded`}
        </p>
        {state.status !== 'loading' && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {state.status === 'error' ? state.message : absentText}
          </p>
        )}
      </div>
    </div>
  );
}
