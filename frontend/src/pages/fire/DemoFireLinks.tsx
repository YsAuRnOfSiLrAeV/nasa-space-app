import { fireHref } from '@/app/route';
import { config } from '@/config';
import type { FireCatalog } from '@/hooks/useFireCatalog';
import { percent } from './fireSpatial';
import styles from './Fire.module.css';

/** Same catalog feeds globe markers and keyboard-accessible fire summaries. */
export function DemoFireLinks({
  catalog,
  compact = false,
}: {
  catalog: FireCatalog;
  compact?: boolean;
}) {
  if (catalog.status === 'loading')
    return (
      <p role="status" className="text-sm">
        Loading fire catalog…
      </p>
    );
  if (catalog.status === 'error')
    return (
      <button className={styles.catalogRetry} type="button" onClick={catalog.retry}>
        Retry fire catalog
      </button>
    );
  if (!catalog.fires.length)
    return <p className="text-sm">No demonstration fires have been published yet.</p>;
  return (
    <nav
      aria-label="Demonstration fires"
      className={compact ? styles.catalogCompact : styles.catalog}
    >
      <p className={styles.catalogTitle}>
        {config.fireDataIsExample ? 'Documentation example' : 'Explore Canadian fires'}
      </p>
      <ul>
        {catalog.fires.map((fire) => (
          <li key={fire.id}>
            <a href={fireHref(fire.id)}>
              <span className={styles.catalogName}>
                {fire.name.en} · {fire.year}
                <span aria-hidden>↗</span>
              </span>
              <span className={styles.catalogValue}>
                {percent(fire.recovery_today_avg, 100)} structural recovery · {fire.summer}
              </span>
              {!compact && (
                <span className={styles.catalogValue}>
                  {fire.area_ha == null
                    ? 'Area not supplied'
                    : `${fire.area_ha.toLocaleString()} ha`}{' '}
                  ·{' '}
                  {fire.year_80pct == null
                    ? '80% milestone not supplied'
                    : `80% milestone ${fire.year_80pct}`}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
