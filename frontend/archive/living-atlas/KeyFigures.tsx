import type { StudyFigure } from './studyFigures';

const SHOWN: StudyFigure['id'][] = ['points', 'burnGroups', 'nisarRho'];

/** Headline numbers; size and typeface come from the theme's --figure-* variables. */
export function KeyFigures({ figures }: { figures: StudyFigure[] }) {
  const shown = SHOWN.map((id) => figures.find((f) => f.id === id)).filter(
    (f): f is StudyFigure => f !== undefined,
  );
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-x-4 gap-y-3">
      {shown.map((f) => (
        <div key={f.id} className="min-w-0">
          <dt className="sr-only">{f.label}</dt>
          <dd className="key-figure">{f.value}</dd>
          <dd className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}
