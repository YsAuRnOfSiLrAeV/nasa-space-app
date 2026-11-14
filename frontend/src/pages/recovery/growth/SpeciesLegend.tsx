import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import { SPECIES, SPECIES_ORDER, type SpeciesId } from '@/components/forest/species';
import { PLATE } from './palette';
import { Tree } from './trees';

/** All five species, marking which ones this group's drawing uses, and why. */
export function SpeciesLegend({ present, basis }: { present: Set<SpeciesId>; basis: string }) {
  return (
    <section aria-labelledby="growth-species">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="growth-species" className="text-sm text-foreground">
          Species in the drawing
        </h3>
        <p className="max-w-[40rem] text-[11px] leading-relaxed text-muted-foreground">{basis}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SPECIES_ORDER.map((id) => (
          <SpeciesCard key={id} id={id} shown={present.has(id)} />
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Species traits: Sims et al. (1997), Field Guide to the Forest Ecosystem Classification for
        Northwestern Ontario; Farrar (1995), Trees in Canada.
      </p>
    </section>
  );
}

function SpeciesCard({ id, shown }: { id: SpeciesId; shown: boolean }) {
  const sp = SPECIES[id];
  return (
    <li className={cn('rounded-(--radius) border border-rule p-3', !shown && 'opacity-60')}>
      <svg
        viewBox="-40 -112 80 116"
        aria-hidden
        className="mb-2 h-24 w-full rounded-sm"
        style={{ background: PLATE.paper }}
      >
        <Tree species={id} h={100} seed={`legend-${id}`} stems={id === 'white-birch' ? 2 : 1} />
      </svg>
      <p className="text-xs text-foreground">
        {sp.name} <span className="text-muted-foreground italic">{sp.latin}</span>
      </p>
      <p className={cn(ui.micro, 'mb-1.5 text-[9px]')}>
        {shown ? 'In this drawing' : 'Not drawn for this group'}
      </p>
      <details>
        <summary className="cursor-pointer text-[11px] text-muted-foreground">After a fire</summary>
        <SpeciesNote>{sp.regeneration}</SpeciesNote>
        <SpeciesNote label="Look for">{sp.silhouette}</SpeciesNote>
        <SpeciesNote label="Habitat">{sp.habitat}</SpeciesNote>
      </details>
    </li>
  );
}

function SpeciesNote({ label, children }: { label?: string; children: string }) {
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
      {label && <span className="text-foreground">{label}:</span>} {children}
    </p>
  );
}
