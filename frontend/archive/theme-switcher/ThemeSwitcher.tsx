import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { THEMES } from '@/theme/themes';
import { useTheme } from '@/theme/theme-context';
import { ThemePreview } from './ThemePreview';

/**
 * Radio-group theme picker with a miniature preview of each composition.
 * Arrow keys move and select (native radio behaviour); Tab enters on the active one.
 *  - `stacked`: full-width rows (side panels)
 *  - `inline`: compact horizontal strip (rails/toolbars); label shown from md up
 *  - `compact`: previews only, active theme named beside them (narrow columns)
 */
export function ThemeSwitcher({
  variant = 'stacked',
}: {
  variant?: 'stacked' | 'inline' | 'compact';
}) {
  const { themeId, setThemeId } = useTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + THEMES.length) % THEMES.length;
    setThemeId(THEMES[next]!.id);
    refs.current[next]?.focus();
  };

  const compact = variant === 'compact';
  const inline = variant === 'inline' || compact;

  return (
    <div
      className={cn(inline ? 'flex items-center gap-3' : 'space-y-2', compact && 'justify-between')}
    >
      <p
        id={`theme-switcher-label-${variant}`}
        className={cn('eyebrow', variant === 'inline' && 'hidden lg:block')}
      >
        Theme
        {compact && (
          <span className="block text-muted-foreground">
            {THEMES.find((t) => t.id === themeId)?.label}
          </span>
        )}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`theme-switcher-label-${variant}`}
        className={cn(inline ? 'flex gap-1.5' : 'grid gap-1.5')}
      >
        {THEMES.map((t, i) => {
          const selected = t.id === themeId;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${t.label}: ${t.description}`}
              tabIndex={selected ? 0 : -1}
              title={t.description}
              onClick={() => setThemeId(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'flex items-center gap-2.5 border text-left text-xs transition-colors duration-200',
                compact
                  ? 'rounded-(--radius) p-1'
                  : inline
                    ? 'rounded-(--radius) p-1 md:pr-2.5'
                    : 'rounded-(--radius) p-1.5 pr-3',
                selected
                  ? 'border-ring text-foreground'
                  : 'border-border text-muted-foreground hover:border-input hover:text-foreground',
              )}
            >
              <span className="overflow-hidden rounded-[2px] ring-1 ring-border">
                <ThemePreview theme={t} />
              </span>
              <span className={cn('truncate', compact ? 'hidden' : inline && 'hidden md:inline')}>
                {t.label}
              </span>
              {selected && <span className="sr-only">(active)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
