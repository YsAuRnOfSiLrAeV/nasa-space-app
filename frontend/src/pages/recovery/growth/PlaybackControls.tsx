import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import type { YearPlayback } from './useYearPlayback';

const ctl = cn(ui.ghost, 'min-w-11 justify-center');

/** Previous / play-pause / next / reset, and the species-name toggle. */
export function PlaybackControls({
  playback,
  labels,
  onLabels,
}: {
  playback: YearPlayback;
  labels: boolean;
  onLabels: (show: boolean) => void;
}) {
  const { year, max, playing } = playback;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={ctl}
        onClick={() => playback.step(-1)}
        disabled={year <= 0}
        aria-label="Previous year"
      >
        <span aria-hidden>←</span>
      </button>
      <button
        type="button"
        className={cn(ctl, 'px-4')}
        aria-pressed={playing}
        onClick={playback.toggle}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        className={ctl}
        onClick={() => playback.step(1)}
        disabled={year >= max}
        aria-label="Next year"
      >
        <span aria-hidden>→</span>
      </button>
      <button type="button" className={ctl} onClick={playback.reset}>
        Reset
      </button>
      <label className={cn(ui.micro, 'ml-auto flex cursor-pointer items-center gap-2')}>
        <input
          type="checkbox"
          checked={labels}
          onChange={(e) => onLabels(e.target.checked)}
          className="accent-(--select)"
        />
        Species names
      </label>
    </div>
  );
}

/** Years since the fire, 0 … max; moving it pauses playback. */
export function YearSlider({
  playback,
  fireYear,
  referenceYear,
}: {
  playback: YearPlayback;
  fireYear: number;
  referenceYear: number;
}) {
  const { year, max } = playback;
  return (
    <label className="block">
      <span className="sr-only">Years since the fire</span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={year}
        onChange={(e) => playback.seek(Number(e.target.value))}
        aria-valuetext={`Year ${year} after the fire (${fireYear + year})${fireYear + year > referenceYear ? ', after the last observation' : ''}`}
        className="h-6 w-full accent-(--select) [@media(pointer:coarse)]:h-11"
      />
    </label>
  );
}

/** Labels under the slider: the fire, the last observation, the end of the drawing. */
export function YearScale({
  fireYear,
  referenceYear,
  max,
}: {
  fireYear: number;
  referenceYear: number;
  max: number;
}) {
  return (
    <div className={cn(ui.micro, 'flex justify-between text-[9px]')}>
      <span>Fire · {fireYear}</span>
      <span>Last observation · {referenceYear}</span>
      <span>Year {max}</span>
    </div>
  );
}
