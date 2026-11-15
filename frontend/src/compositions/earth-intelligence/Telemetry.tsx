import { keepGreekCase } from '@/lib/text';
import { FigureRow } from '@/components/shell/FigureRow';
import type { StudyFigure } from '@/domain/study/studyFigures';

const SHOWN: StudyFigure['id'][] = ['points', 'burnGroups', 'fireYears', 'nisarRho'];

/** The study's headline figures as one readable line. */
export function Telemetry({ figures, className }: { figures: StudyFigure[]; className?: string }) {
  const shown = SHOWN.flatMap((id) => figures.find((f) => f.id === id) ?? []);
  return (
    <FigureRow
      className={className}
      figures={shown.map((f) => ({
        id: f.id,
        value: f.value,
        label: (
          <>
            {keepGreekCase(f.label.toLowerCase().replace(/^nisar hv/, 'NISAR HV'))}
            {f.unit && ` (${f.unit})`}
          </>
        ),
      }))}
    />
  );
}
