import type { DemoFire } from '@/data/fireSchema';

export function filterFireCatalog(fires: DemoFire[], query: string, region = '', year = '') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return fires.filter(
    (fire) =>
      (!region || fire.region === region) &&
      (!year || String(fire.year) === year) &&
      terms.every((term) =>
        `${fire.id} ${fire.year} ${fire.region ?? ''} ${fire.name.en}`.toLowerCase().includes(term),
      ),
  );
}

/** Search and filters of the fire list. Held by the explorer, so they survive the list moving panels. */
export interface CatalogFilters {
  query: string;
  region: string;
  year: string;
}
export const NO_CATALOG_FILTERS: CatalogFilters = { query: '', region: '', year: '' };

export interface CatalogCapabilityFlags {
  spatial?: boolean;
  perimeter?: boolean;
  timeline?: boolean;
  forecast?: boolean;
}

export function catalogCapabilityLabels(capabilities: CatalogCapabilityFlags): string[] {
  const labels: string[] = [];
  if (capabilities.spatial) labels.push('Spatial data available');
  else if (capabilities.perimeter) labels.push('Perimeter and summary only');
  else if (capabilities.spatial === false) labels.push('No spatial data supplied');
  if (capabilities.timeline) labels.push('Timeline available');
  if (capabilities.forecast) labels.push('Forecast available');
  return labels;
}

/** The group of fires whose export names no region; the list shows no region heading for it. */
export const REGION_NOT_SUPPLIED = 'Region not supplied';

export function groupFireCatalog(fires: DemoFire[]) {
  const regions = [...new Set(fires.map((fire) => fire.region || REGION_NOT_SUPPLIED))].sort();
  return regions.map((region) => {
    const regional = fires.filter((fire) => (fire.region || REGION_NOT_SUPPLIED) === region);
    return {
      region,
      years: [...new Set(regional.map((fire) => fire.year))]
        .sort((a, b) => b - a)
        .map((year) => ({
          year,
          fires: regional.filter((fire) => fire.year === year),
        })),
    };
  });
}
