import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Manifest, Stage } from '@/data/schema';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { STAGE_BG, STAGE_LABELS } from '@/styles/tokens';
import type { AtlasLayers } from './useAtlasLayers';
import styles from './LivingAtlas.module.css';

const STAGES: Stage[] = [0, 1, 2];

/** Collapsible legend card: canopy-height stages, point symbols and layer switches. */
export function AtlasLegend({
  manifest,
  groups,
  layers,
  onChange,
}: {
  manifest: Manifest;
  groups: number;
  layers: AtlasLayers;
  onChange: (layers: AtlasLayers) => void;
}) {
  // Short screens (laptops at 150–200% scaling): start collapsed so it doesn't cover the map.
  const short = useMediaQuery('(max-height: 820px)');
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? !short;
  const set = (key: keyof AtlasLayers) => (on: boolean) => onChange({ ...layers, [key]: on });
  // Rendered twice (desktop map edge, phone sheet), so the id must be unique per instance.
  const bodyId = useId();

  return (
    <section
      aria-label="Legend and map layers"
      className={cn(
        styles.note,
        'w-full text-[#1f3a2b] md:w-[17rem] md:border-b-0 md:border-l-0 md:shadow-none',
      )}
    >
      <LegendHeader open={isOpen} controls={bodyId} onToggle={() => setOpen(!isOpen)} />
      <div id={bodyId} hidden={!isOpen} className="space-y-3 p-3.5 text-xs">
        <StageKey counts={manifest.counts.by_lidar_stage} />
        <SymbolKey
          burned={manifest.counts.burned}
          unburned={manifest.counts.unburned}
          groups={groups}
        />
        <fieldset className="border-t border-[rgb(31_58_43/0.16)] pt-2">
          <legend className="prose-text mb-1 text-[11px] italic">Layers</legend>
          <LayerToggle label="Terrain relief" checked={layers.relief} onChange={set('relief')} />
          <LayerToggle label="Sample points" checked={layers.points} onChange={set('points')} />
          <LayerToggle
            label="Burn annotations"
            checked={layers.annotations}
            onChange={set('annotations')}
          />
        </fieldset>
      </div>
    </section>
  );
}

function LegendHeader({
  open,
  controls,
  onToggle,
}: {
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  return (
    <h2 className={styles.noteHeader}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className="flex flex-1 items-center justify-between gap-3 text-left uppercase"
      >
        Legend
        <span aria-hidden className="text-muted-foreground">
          {open ? '−' : '+'}
        </span>
      </button>
    </h2>
  );
}

/** Canopy-height stage swatches with their point counts. */
function StageKey({ counts }: { counts: Manifest['counts']['by_lidar_stage'] }) {
  return (
    <div>
      <p className="prose-text mb-1.5 text-[11px] italic">Canopy height, GEDI lidar</p>
      <ul className="space-y-1">
        {STAGES.map((s) => (
          <li key={s} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span aria-hidden className={cn('inline-block size-2.5 rounded-full', STAGE_BG[s])} />
              {STAGE_LABELS[s]}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the map's point and annotation symbols mean. */
function SymbolKey({
  burned,
  unburned,
  groups,
}: {
  burned: number;
  unburned: number;
  groups: number;
}) {
  return (
    <ul className="space-y-1 border-t border-[rgb(31_58_43/0.16)] pt-2.5">
      <li className="flex items-center gap-2">
        <span aria-hidden className="inline-block size-2.5 rounded-full bg-[#467f5b]" />
        Burned 2001–2012 · {burned}
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block size-2.5 rounded-full border-[1.5px] border-[#467f5b]"
        />
        Unburned reference · {unburned}
      </li>
      <li className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 inline-block size-2.5 shrink-0 rounded-full border-[1.5px] border-(--amber)"
        />
        <span>
          Burn-scar group · {groups}
          <span className="block text-[11px] text-muted-foreground">
            Cluster of sampled points, not a fire perimeter
          </span>
        </span>
      </li>
    </ul>
  );
}

/** One labelled layer switch (a styled checkbox). */
export function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>{label}</span>
      <input
        type="checkbox"
        className={styles.toggle}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
