import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LocatedPoint } from '@/data/schema';
import type { RecoveryFile, RecoveryImage } from '@/data/recoverySchema';
import { platformLabel } from '@/domain/study/recovery';
import ui from '@/components/shell/primitives.module.css';
import styles from './Recovery.module.css';

type Composite = 'natural' | 'swir';

const COMPOSITES: { id: Composite; label: string; note: string }[] = [
  {
    id: 'natural',
    label: 'Natural colour',
    note: 'Red, green, blue: roughly what the eye would see.',
  },
  {
    id: 'swir',
    label: 'Shortwave infrared',
    note: 'SWIR 2, NIR, red: healthy vegetation green, burned or bare ground magenta to brown.',
  },
];

/**
 * Before/after comparison of real Landsat scenes for one group, with a year
 * strip of every summer that has a clear scene. Years without one stay empty.
 */
export function ImageryExplorer({
  landsat,
  points,
}: {
  landsat: RecoveryFile;
  points: LocatedPoint[];
}) {
  const images = landsat.images;
  const fire = landsat.fire_year;
  const pre = images.filter((i) => Number(i.date.slice(0, 4)) < fire);
  const post = images.filter((i) => Number(i.date.slice(0, 4)) > fire);
  const [beforeId, setBeforeId] = useState(pre.at(-1)?.scene_id ?? images[0]?.scene_id);
  // Opens on the first summer after the fire: the clearest view of the burn itself.
  const [afterId, setAfterId] = useState(post[0]?.scene_id ?? images.at(-1)?.scene_id);
  const [composite, setComposite] = useState<Composite>('natural');
  const [showPoints, setShowPoints] = useState(true);
  const before = images.find((i) => i.scene_id === beforeId);
  const after = images.find((i) => i.scene_id === afterId);
  const nameId = useId();

  if (!before || !after) {
    return (
      <p className="text-xs text-muted-foreground">
        No summer scene was clear enough at this group&apos;s points to show.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Band combination</legend>
          {COMPOSITES.map((c) => (
            <label
              key={c.id}
              className={cn(
                styles.chip,
                'cursor-pointer has-checked:border-(--select) has-checked:text-foreground',
              )}
            >
              <input
                type="radio"
                name={nameId}
                className="sr-only"
                checked={composite === c.id}
                onChange={() => setComposite(c.id)}
              />
              {c.label}
            </label>
          ))}
        </fieldset>
        <label className={cn(ui.micro, 'flex cursor-pointer items-center gap-2')}>
          <input
            type="checkbox"
            checked={showPoints}
            disabled={points.length === 0}
            onChange={(e) => setShowPoints(e.target.checked)}
            className="accent-(--select)"
          />
          {points.length ? 'Sample points' : 'Sample-point overlay not supplied'}
        </label>
      </div>

      <BeforeAfter
        before={before}
        after={after}
        composite={composite}
        bbox={landsat.bbox}
        points={showPoints ? points : []}
      />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {COMPOSITES.find((c) => c.id === composite)!.note} Drag the divider, or focus it and use the
        arrow keys. Scenes are chosen per summer as the clearest at this group&apos;s sample points;
        clouds can remain elsewhere in the frame.
      </p>

      <YearStrip
        images={images}
        years={landsat.years}
        fireYear={fire}
        beforeId={before.scene_id}
        afterId={after.scene_id}
        onPick={(img) =>
          Number(img.date.slice(0, 4)) < fire ? setBeforeId(img.scene_id) : setAfterId(img.scene_id)
        }
      />

      <p className={cn(ui.micro, 'text-[9px] normal-case tracking-[0.06em]')}>
        {landsat.source.citation}. {landsat.source.collection}, via {landsat.source.access}.
      </p>
    </div>
  );
}

function BeforeAfter({
  before,
  after,
  composite,
  bbox,
  points,
}: {
  before: RecoveryImage;
  after: RecoveryImage;
  composite: Composite;
  bbox: [number, number, number, number];
  points: LocatedPoint[];
}) {
  const [split, setSplit] = useState(50);
  const [w, s, e, n] = bbox;
  const caption = (img: RecoveryImage) => `${img.date} · ${platformLabel(img.platform)}`;
  return (
    <figure className={ui.bezel}>
      <div className={cn(ui.bezelCore, 'aspect-square w-full bg-black')}>
        <img
          src={before[composite]}
          alt={`Landsat ${composite === 'natural' ? 'natural-colour' : 'shortwave-infrared'} image before the fire, ${caption(before)}`}
          className="absolute inset-0 size-full object-fill"
          loading="lazy"
        />
        <img
          src={after[composite]}
          alt={`The same area after the fire, ${caption(after)}`}
          className="absolute inset-0 size-full object-fill"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          loading="lazy"
        />
        {points.length > 0 && (
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            {points.map((p) => (
              <circle
                key={p.point_id}
                cx={((p.lon - w) / (e - w)) * 100}
                cy={((n - p.lat) / (n - s)) * 100}
                r="0.7"
                fill="none"
                stroke="var(--burn-text)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}
        {/* Divider */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-foreground/90"
          style={{ left: `${split}%` }}
        >
          <span className="absolute top-1/2 left-1/2 grid size-8 -translate-1/2 place-items-center rounded-full border border-foreground/80 bg-background/80 text-[10px] text-foreground">
            ⇆
          </span>
        </div>
        <span
          className={cn(
            ui.micro,
            'absolute top-3 left-3 rounded-sm bg-background/75 px-2 py-1 text-foreground',
          )}
        >
          Before · {caption(before)}
        </span>
        <span
          className={cn(
            ui.micro,
            'absolute top-3 right-3 rounded-sm bg-background/75 px-2 py-1 text-foreground',
          )}
        >
          After · {caption(after)}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(ev) => setSplit(Number(ev.target.value))}
          aria-label={`Comparison divider. Left shows ${caption(before)}, right shows ${caption(after)}.`}
          aria-valuetext={`${split}% before`}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="sr-only">
        Before and after Landsat images of the burn-scar group. Before: {caption(before)}. After:{' '}
        {caption(after)}.
      </figcaption>
    </figure>
  );
}

function YearStrip({
  images,
  years,
  fireYear,
  beforeId,
  afterId,
  onPick,
}: {
  images: RecoveryImage[];
  years: [number, number];
  fireYear: number;
  beforeId: string;
  afterId: string;
  onPick: (img: RecoveryImage) => void;
}) {
  const all = Array.from({ length: years[1] - years[0] + 1 }, (_, i) => years[0] + i);
  return (
    <div>
      <p className={cn(ui.micro, 'mb-2 text-[9px]')}>
        Clear summer scenes · pick a year before {fireYear} for the left image, after for the right
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
        {all.map((y) => {
          const image = images.find((i) => i.date.startsWith(`${y}-`));
          return (
            <YearCell
              key={y}
              year={y}
              image={image}
              fireYear={fireYear}
              selected={!!image && (image.scene_id === beforeId || image.scene_id === afterId)}
              onPick={onPick}
            />
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One summer in the year strip: a button that puts its scene on the left
 * (before the fire) or right (after), or an empty dashed cell when no scene
 * was clear. The fire year carries a small burgundy diamond.
 */
function YearCell({
  year,
  image,
  fireYear,
  selected,
  onPick,
}: {
  year: number;
  image: RecoveryImage | undefined;
  fireYear: number;
  selected: boolean;
  onPick: (img: RecoveryImage) => void;
}) {
  const isFire = year === fireYear;
  if (!image) {
    return (
      <li
        className={cn(
          'grid h-10 place-items-center rounded-sm border border-dashed border-rule text-[10px] text-muted-foreground/70',
          isFire && 'border-(--burn) text-(--burn-text)',
        )}
        title={isFire ? `${year}: fire year, no clear scene` : `${year}: no clear summer scene`}
      >
        <span aria-hidden>{year}</span>
        <span className="sr-only">{year}: no clear summer scene</span>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${year}${isFire ? ' (fire year; scene may predate the burn)' : ''}, ${image.date}, ${platformLabel(image.platform)}: show as the ${year < fireYear ? 'before' : 'after'} image`}
        onClick={() => onPick(image)}
        className={cn(
          'relative h-10 w-full rounded-sm border border-rule font-mono text-[11px] text-foreground transition-colors duration-200 hover:border-foreground',
          selected && 'border-(--select) bg-(--select)/15',
        )}
      >
        {year}
        {isFire && (
          <span
            aria-hidden
            title="Fire year"
            className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rotate-45 bg-(--burn)"
          />
        )}
      </button>
    </li>
  );
}
