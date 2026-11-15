import type { MouseEvent } from 'react';
import { mapHref } from '@/app/route';
import type { DemoFire } from '@/data/fireSchema';
import { fireLabel } from '@/domain/fire/fireLabel';
import { formatShare, isProvided } from '@/domain/fire/fireSummary';
import { catalogCapabilityLabels } from '@/domain/fire/catalogSearch';

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
  const capabilityText = fire.capabilities
    ? catalogCapabilityLabels(fire.capabilities).join(' · ')
    : isProvided(fire.recovery_today_avg)
      ? `${formatShare(fire.recovery_today_avg)} recovery`
      : 'Recovery not supplied';
  return (
    <li>
      <a
        href={mapHref({ mode: 'examples', presentation: 'fire', fireId: fire.id })}
        aria-current={current ? 'true' : undefined}
        onClick={select}
      >
        <span>
          {fireLabel(fire.id)} <small title={fire.id}>· {fire.year}</small>
        </span>
        <small>
          {capabilityText || 'Perimeter available'} · Summer {fire.summer}
        </small>
      </a>
    </li>
  );
}
