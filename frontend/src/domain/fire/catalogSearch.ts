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
