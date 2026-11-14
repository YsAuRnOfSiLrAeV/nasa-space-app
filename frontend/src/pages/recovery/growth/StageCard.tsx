import { cn } from '@/lib/utils';
import ui from '@/components/shell/primitives.module.css';
import type { Stage } from '@/components/forest/growth';

/** The illustrative stage for the selected year, with the caveat that stages are a reading aid. */
export function StageCard({ stage }: { stage: Stage }) {
  return (
    <section aria-labelledby="growth-stage" className="rounded-(--radius) border border-rule p-4">
      <p className={cn(ui.micro, 'mb-1 text-[9px]')}>
        Illustrative stage · years {stage.from}–{Math.floor(stage.to)}
      </p>
      <h3 id="growth-stage" className="mb-2 text-sm text-foreground">
        {stage.title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{stage.text}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
        Stages are a way to read the drawing, not fixed biological milestones.
      </p>
    </section>
  );
}
