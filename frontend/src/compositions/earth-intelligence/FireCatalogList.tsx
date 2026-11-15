import { mapHref } from '@/app/route';
import type { DemoFire } from '@/data/fireSchema';
import { formatShare, isProvided } from '@/domain/fire/fireSummary';
import { EMPTY_FIRES, type FireCatalog } from '@/hooks/useFireCatalog';
import type { MouseEvent } from 'react';
import styles from './MapShell.module.css';

/** The example-fire catalog: its loading, error and empty states, then the fires. */
export function FireCatalogList({
  catalog,
  selectedId,
  onSelect,
}: {
  catalog: FireCatalog;
  selectedId: string | null;
  onSelect: (fire: DemoFire) => void;
}) {
  const fires = catalog.state.status === 'ready' ? catalog.state.data : EMPTY_FIRES;
  return (
    <>
      {catalog.state.status === 'loading' && <p role="status">Loading available fires…</p>}
      {catalog.state.status === 'error' && (
        <div role="alert">
          <p>The fire catalog could not be loaded.</p>
          <button type="button" onClick={catalog.retry}>
            Retry catalog
          </button>
        </div>
      )}
      {catalog.state.status === 'ready' && fires.length === 0 && (
        <p role="status">No example fires have been published yet. The map remains available.</p>
      )}
      <ul className={styles.fireList} aria-label="Available example fires">
        {fires.map((fire) => (
          <FireCatalogItem
            key={fire.id}
            fire={fire}
            current={fire.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </>
  );
}

/** A plain click selects the fire in place; modified clicks keep the link's own behaviour. */
const isPlainClick = (event: MouseEvent) =>
  !(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

function FireCatalogItem({
  fire,
  current,
  onSelect,
}: {
  fire: DemoFire;
  current: boolean;
  onSelect: (fire: DemoFire) => void;
}) {
  return (
    <li>
      <a
        href={mapHref({ mode: 'examples', presentation: 'fire', fireId: fire.id })}
        aria-current={current ? 'true' : undefined}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onSelect(fire);
        }}
      >
        <span>
          {fire.name.en} <small>· {fire.year}</small>
        </span>
        <small>
          {isProvided(fire.recovery_today_avg)
            ? `${formatShare(fire.recovery_today_avg)} recovery`
            : 'Recovery not supplied'}{' '}
          · Summer {fire.summer}
        </small>
      </a>
    </li>
  );
}
