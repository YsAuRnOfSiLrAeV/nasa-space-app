import type { BurnGroup } from '@/domain/study/burnGroups';
import styles from '@/pages/recovery/Recovery.module.css';

/**
 * Chooses the sampling group the page highlights, oldest fire first. Buttons,
 * not links: the choice changes what this page shows and does not leave it.
 */
export function SamplingGroupPicker({
  groups,
  currentId,
  onPick,
  label,
}: {
  groups: BurnGroup[];
  currentId: string;
  onPick: (groupId: string) => void;
  /** Accessible name; the page shows the picker in two places. */
  label: string;
}) {
  const ordered = [...groups].sort((a, b) => a.fireYear - b.fireYear || b.count - a.count);
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {ordered.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            aria-pressed={g.id === currentId}
            aria-label={`Sampling group ${g.label}, ${g.count} points`}
            className={styles.chip}
            onClick={() => onPick(g.id)}
          >
            <span className="text-foreground">{g.label}</span>
            <span className="type-coord">{g.count} pts</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
