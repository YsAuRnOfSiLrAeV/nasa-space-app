import { cn } from '@/lib/utils';
import { recoveryHref, type RecoveryView } from '@/app/route';
import type { BurnGroup } from '@/components/study/burnGroups';
import ui from '@/components/shell/primitives.module.css';
import styles from './Recovery.module.css';

/** One link per burn-scar group, oldest fire first; keeps the current view. */
export function GroupPicker({
  groups,
  currentId,
  view,
}: {
  groups: BurnGroup[];
  currentId: string;
  view: RecoveryView;
}) {
  const ordered = [...groups].sort((a, b) => a.fireYear - b.fireYear || b.count - a.count);
  return (
    <nav aria-label="Burn-scar groups" className="border-y border-rule py-4">
      <ul className="flex flex-wrap gap-2">
        {ordered.map((g) => (
          <li key={g.id}>
            <a
              href={recoveryHref(g.id, view)}
              aria-current={g.id === currentId ? 'page' : undefined}
              aria-label={`Burn group ${g.label}, ${g.count} points`}
              className={styles.chip}
            >
              <span className="text-foreground">{g.label}</span>
              <span className="type-coord">{g.count} pts</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const TABS: { id: RecoveryView; label: string; note: string }[] = [
  { id: 'observed', label: 'Observed recovery', note: 'Measurements and imagery' },
  { id: 'growth', label: 'Explore forest growth', note: 'Illustration' },
];

/** The two halves of the page: evidence, and the clearly separate illustration. */
export function ViewTabs({ groupId, view }: { groupId: string; view: RecoveryView }) {
  return (
    <nav aria-label="Recovery views" className="mt-8">
      <ul className="flex flex-wrap gap-2 border-b border-rule">
        {TABS.map((t) => (
          <li key={t.id}>
            <a
              href={recoveryHref(groupId, t.id)}
              aria-current={view === t.id ? 'page' : undefined}
              className={cn(
                '-mb-px flex min-h-11 flex-col justify-center border-b-2 px-4 py-2 transition-colors duration-200',
                view === t.id
                  ? 'border-(--select) text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="text-sm">{t.label}</span>
              <span className={cn(ui.micro, 'text-[9px]')}>{t.note}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
