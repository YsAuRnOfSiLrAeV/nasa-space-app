import type { AtlasFire, AtlasSearch } from './contracts';

const ATLAS_ID = /^gfa_\d+$/;
const day = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const percent = (share: number) =>
  `${(share * 100).toFixed(share > 0 && share < 0.01 ? 1 : 0)}%`;

/** True for ids of the backend fire atlas, which the exported catalog does not know. */
export function isAtlasFire(fireId: string | null | undefined): fireId is string {
  return !!fireId && ATLAS_ID.test(fireId);
}

export function atlasDates(fire: AtlasFire) {
  const start = day.format(new Date(fire.start_date));
  const end = day.format(new Date(fire.end_date));
  return start === end ? start : `${start} – ${end}`;
}

/** What a search of the atlas found, in words: one of its three outcomes. */
export function atlasSummary(found: AtlasSearch): string {
  if (found.status === 'outside_regions')
    return 'This polygon does not touch any region where the recovery model applies, so nothing can be analysed here. Draw it over forest in a supported region: the Confidence zones layer shows them.';
  const coverage = `${percent(found.regions.A ?? 0)} of the polygon is in a verified model region and ${percent(found.regions.B ?? 0)} in an extrapolated one.`;
  if (found.status === 'no_fires')
    return `The atlas has no fire under this polygon with these filters. ${coverage}`;
  const shown =
    found.fires.length < found.total ? ` The ${found.fires.length} largest are listed.` : '';
  const capped = found.truncated
    ? ' The area holds more fires than can be checked at once: narrow the polygon or the filters to see the smaller ones.'
    : '';
  return `${found.total} ${found.total === 1 ? 'fire' : 'fires'} under this polygon.${shown}${capped} ${coverage}`;
}
