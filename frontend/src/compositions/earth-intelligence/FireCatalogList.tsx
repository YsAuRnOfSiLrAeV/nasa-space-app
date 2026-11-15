import type { DemoFire } from '@/data/fireSchema';
import {
  filterFireCatalog,
  groupFireCatalog,
  REGION_NOT_SUPPLIED,
  NO_CATALOG_FILTERS,
  type CatalogFilters,
} from '@/domain/fire/catalogSearch';
import { EMPTY_FIRES, type FireCatalog } from '@/hooks/useFireCatalog';
import { useState } from 'react';
import { fireCountry } from '@/domain/fire/fireLabel';
import { FireCatalogItem } from './FireCatalogItem';
import styles from './MapShell.module.css';

/** The example-fire catalog: its loading, error and empty states, then the fires. */
export function FireCatalogList({
  catalog,
  selectedId,
  onSelect,
  filters: shared,
}: {
  catalog: FireCatalog;
  selectedId: string | null;
  onSelect: (fire: DemoFire) => void;
  /** Search and filters held by the caller, so they survive the list moving between panels. */
  filters?: [CatalogFilters, (filters: CatalogFilters) => void];
}) {
  const fires = catalog.state.status === 'ready' ? catalog.state.data : EMPTY_FIRES;
  const own = useState(NO_CATALOG_FILTERS);
  const [{ query, region, year }, setFilters] = shared ?? own;
  const set = (change: Partial<CatalogFilters>) => setFilters({ query, region, year, ...change });
  const matches = filterFireCatalog(fires, query, region, year).sort(
    (a, b) =>
      countryRank(a.id).localeCompare(countryRank(b.id)) || Number(hasMap(b)) - Number(hasMap(a)),
  );
  const countries = [...new Set(matches.map((fire) => fireCountry(fire.id)))];
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
            <input
              type="search"
              value={query}
              onChange={(event) => set({ query: event.target.value })}
            />
          </label>
          <label>
            Region
            <select value={region} onChange={(event) => set({ region: event.target.value })}>
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
            <select value={year} onChange={(event) => set({ year: event.target.value })}>
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
        {countries.map((country) => (
          <li key={country}>
            <h3 className={styles.groupHead}>
              {country} · {matches.filter((fire) => fireCountry(fire.id) === country).length}
            </h3>
            {groupFireCatalog(matches.filter((fire) => fireCountry(fire.id) === country)).map(
              (group) => {
                const named = group.region !== REGION_NOT_SUPPLIED;
                return (
                  <section
                    key={group.region}
                    aria-label={named ? `${country}, ${group.region}` : country}
                  >
                    {named && <h3 className={styles.catalogRegion}>{group.region}</h3>}
                    {group.years.map(({ year, fires }) => (
                      <section key={year} aria-label={`${named ? group.region : country}, ${year}`}>
                        <h4 className={styles.catalogYear}>{year}</h4>
                        <ul>
                          {fires.map((fire) => (
                            <FireCatalogItem
                              key={fire.id}
                              fire={fire}
                              current={fire.id === selectedId}
                              onSelect={onSelect}
                            />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </section>
                );
              },
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Canada first (the validated region), then the other countries alphabetically. */
const countryRank = (id: string) => {
  const country = fireCountry(id);
  return country === 'Canada' ? '' : country;
};

const hasMap = (fire: DemoFire) => fire.capabilities?.spatial !== false;
