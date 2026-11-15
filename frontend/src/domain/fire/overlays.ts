export interface FireOverlayVisibility {
  cells?: boolean;
  perimeter: boolean;
  zone: boolean;
  gedi: boolean;
  optical: boolean;
}

/** The legend reflects only requested overlays that have drawable data. */
export function drawnOverlays(
  requested: FireOverlayVisibility,
  available: FireOverlayVisibility,
  opticalReady: boolean,
): FireOverlayVisibility {
  return {
    ...(requested.cells === undefined
      ? {}
      : { cells: requested.cells && available.cells !== false }),
    perimeter: requested.perimeter && available.perimeter,
    zone: requested.zone && available.zone,
    gedi: requested.gedi && available.gedi,
    optical: requested.optical && opticalReady,
  };
}
