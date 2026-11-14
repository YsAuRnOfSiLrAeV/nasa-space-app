import { useRef, type ReactNode } from 'react';
import { scaleLinear } from 'd3-scale';
import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import { ndviRecovery, type NdviRecovery } from '@/components/study/recovery';
import { ndviDomain } from '@/data/landsat';
import type { RecoveryFile } from '@/data/recoverySchema';
import { useElementWidth } from '@/hooks/useElementWidth';
import type { RecoveryDataState } from '@/hooks/useRecoveryData';
import { NdviLines } from './NdviLines';

/**
 * The page's headline: what the satellite record shows for this group, as one
 * sentence computed by the tested `ndviRecovery`, over a small greenness curve.
 * The full chart, with axes, gaps and a table, is section 03.
 */
export function GreennessFinding({
  state,
  fireYear,
}: {
  state: RecoveryDataState;
  fireYear: number;
}) {
  if (state.status !== 'ready') {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {state.status === 'loading'
          ? 'Loading the greenness record…'
          : state.status === 'error'
            ? `The greenness record could not be loaded: ${state.message}`
            : `No Landsat greenness record has been fetched for this group yet, so there is no before-and-after to show. The canopy figures come from GEDI lidar.`}
      </p>
    );
  }
  const finding = ndviRecovery(state.data);
  return (
    <figure className="space-y-4">
      <p className={cn(ui.micro, 'text-[10px]')}>Summer greenness · Landsat NDVI</p>
      {finding ? (
        <Headline f={finding} fireYear={fireYear} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Too few clear summers before and after the fire to compare.
        </p>
      )}
      <Sparkline file={state.data} />
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        <span className="text-(--burn-text)">Burgundy</span>: this burn group.{' '}
        <span className="text-(--forest)">Dashed green</span>: unburned forest nearby. Greenness is
        not tree height: grasses and shrubs green up first.
      </figcaption>
    </figure>
  );
}

function Headline({ f, fireYear }: { f: NdviRecovery; fireYear: number }) {
  const n = (v: number) => v.toFixed(2);
  const when = f.lowYear === fireYear + 1 ? `${f.lowYear}, the summer after the fire` : f.lowYear;
  return (
    <p className="font-heading text-xl leading-snug font-light text-foreground md:text-2xl">
      Greenness fell from <Num>{n(f.before)}</Num> to <Num burn>{n(f.low)}</Num> in {when}
      {f.backYear !== null ? (
        <>
          , and first returned to its usual level beside unburned forest in{' '}
          <Num forest>{f.backYear}</Num>, {f.backYear - fireYear} years after the fire.
        </>
      ) : (
        <>, and by {f.lastYear} had not yet returned to its usual level beside unburned forest.</>
      )}
    </p>
  );
}

function Num({
  children,
  burn,
  forest,
}: {
  children: ReactNode;
  burn?: boolean;
  forest?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-normal tabular-nums',
        burn && 'text-(--burn-text)',
        forest && 'text-(--forest)',
      )}
    >
      {children}
    </span>
  );
}

const H = 96;
const PAD = 6;

/** The same record, range and line styles as section 03, without axes: shape only. */
function Sparkline({ file }: { file: RecoveryFile }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  const [y0, y1] = file.years;
  const x = scaleLinear()
    .domain([y0, y1])
    .range([PAD, Math.max(PAD + 1, width - PAD)]);
  const y = scaleLinear()
    .domain(ndviDomain(file.ndvi))
    .range([H - PAD, PAD]);
  return (
    <div ref={ref} aria-hidden>
      {width > 0 && (
        <svg width={width} height={H} className="overflow-visible">
          <line
            x1={x(file.fire_year)}
            x2={x(file.fire_year)}
            y1={PAD}
            y2={H - PAD}
            stroke="var(--burn)"
            strokeOpacity="0.8"
          />
          <NdviLines rows={file.ndvi} x={x} y={y} weight="spark" />
          <text
            x={x(y0)}
            y={H + 12}
            fontSize="9"
            fill="var(--muted-foreground)"
            style={{ fontFamily: 'var(--font-data)' }}
          >
            {y0}
          </text>
          <text
            x={x(file.fire_year) + 4}
            y={PAD + 8}
            fontSize="9"
            fill="var(--burn-text)"
            style={{ fontFamily: 'var(--font-data)' }}
          >
            fire {file.fire_year}
          </text>
          <text
            x={x(y1)}
            y={H + 12}
            fontSize="9"
            textAnchor="end"
            fill="var(--muted-foreground)"
            style={{ fontFamily: 'var(--font-data)' }}
          >
            {y1}
          </text>
        </svg>
      )}
    </div>
  );
}
