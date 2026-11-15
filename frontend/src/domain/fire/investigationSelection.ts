export interface InvestigationSelection {
  fireId: string | null;
  cell: number | null;
  year: number | null;
  timelineYear: number | null;
}

/** Inspection and forecast selection never carry across fires, including closing one. */
export function selectionForFire(
  previous: InvestigationSelection,
  fireId: string | null,
): InvestigationSelection {
  return previous.fireId === fireId
    ? previous
    : { fireId, cell: null, year: null, timelineYear: null };
}
