import type { MouseEvent } from 'react';
import { mapHref } from '@/app/route';
import type { DemoFire } from '@/data/fireSchema';
import { formatShare, isProvided } from '@/domain/fire/fireSummary';

export function FireCatalogItem({
  fire,
  current,
  onSelect,
}: {
  fire: DemoFire;
  current: boolean;
  onSelect: (fire: DemoFire) => void;
}) {
  const select = (event: MouseEvent) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(fire);
  };
  return (
    <li>
      <a
        href={mapHref({ mode: 'examples', presentation: 'fire', fireId: fire.id })}
        aria-current={current ? 'true' : undefined}
        onClick={select}
      >
        <span>
          {fire.name.en}{' '}
          <small>
            · {fire.year}
            {fire.region ? ` · ${fire.region}` : ''}
          </small>
        </span>
        <small>
          {fire.capabilities
            ? fire.capabilities.spatial
              ? 'Spatial dataset'
              : 'Perimeter and summary only'
            : isProvided(fire.recovery_today_avg)
              ? `${formatShare(fire.recovery_today_avg)} recovery`
              : 'Recovery not supplied'}{' '}
          · Summer {fire.summer}
        </small>
      </a>
    </li>
  );
}
