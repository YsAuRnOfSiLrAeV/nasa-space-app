import type { DemoFire } from '@/data/fireSchema';
import { filterFireCatalog } from '@/domain/fire/catalogSearch';
import { EMPTY_FIRES, type FireCatalog } from '@/hooks/useFireCatalog';
import { useState } from 'react';
import { FireCatalogItem } from './FireCatalogItem';
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
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [year, setYear] = useState('');
  const matches = filterFireCatalog(fires, query, region, year);
  const regions = [...new Set(fires.flatMap((fire) => (fire.region ? [fire.region] : [])))].sort();
  const years = [...new Set(fires.map((fire) => fire.year))].sort((a, b) => b - a);
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
      {catalog.state.status === 'ready' && fires.length > 0 && (
        <div className={styles.search}>
          <label>
            Search identifier, year or region
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            Region
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">All regions</option>
              {regions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fire year
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">All years</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <p role="status">
            {matches.length} of {fires.length} fires
            {matches.length === 0 ? ' · No matching fires. Adjust the filters.' : ''}
          </p>
        </div>
      )}
      <ul className={styles.fireList} aria-label="Available example fires">
        {matches.map((fire) => (
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
