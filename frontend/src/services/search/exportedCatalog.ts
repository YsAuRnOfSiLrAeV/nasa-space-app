import type { DemoFire } from '@/data/fireSchema';
import type { CatalogPerimeters } from '@/data/catalogPerimeters';
import { CatalogFiresSchema, type CatalogFire } from './contracts';

const CANADIAN_REGIONS = new Set(['bc', 'alberta', 'manitoba', 'ontario', 'quebec']);
export function exportedSearchFires(
  entries: DemoFire[],
  perimeters: CatalogPerimeters | null,
): CatalogFire[] {
  const geometry = new Map(perimeters?.features.map((feature) => [feature.properties.id, feature]));
  return CatalogFiresSchema.parse(
    entries.map((entry) => {
      const perimeter = geometry.get(entry.id);
      const identityMatches =
        perimeter?.properties.year === entry.year &&
        (!entry.region || perimeter.properties.region === entry.region);
      return {
        id: entry.id,
        name: entry.name.en,
        year: entry.year,
        center: entry.center_lonlat,
        perimeter: identityMatches ? perimeter!.geometry : null,
        resultId: entry.id,
        region: entry.region,
        country: entry.region
          ? CANADIAN_REGIONS.has(entry.region)
            ? 'canada'
            : entry.region
          : undefined,
        spatial: entry.capabilities?.spatial,
      };
    }),
  );
}
export function catalogCountries(fires: CatalogFire[]) {
  return [...new Set(fires.flatMap((fire) => (fire.country ? [fire.country] : [])))]
    .sort()
    .map((code) => ({ code, name: code.charAt(0).toUpperCase() + code.slice(1) }));
}
