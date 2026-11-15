/**
 * Project basemap: OpenFreeMap vector tiles (no API key) + optional NASA GIBS imagery; colors come from the active theme.
 * Lives in public/map/ so it is versioned with the app (see README > Basemap).
 */
const DEFAULT_BASEMAP = `${import.meta.env.BASE_URL}map/explorer.json`;

/**
 * The team API (backend/api). Dev: the Vite proxy at `/api` (vite.config.ts).
 * Production: VITE_API_URL, or null when no backend is deployed (the demo does
 * not depend on it).
 */
function apiBaseUrl(): string | null {
  const url = import.meta.env.VITE_API_URL?.trim();
  if (url) return url.replace(/\/+$/, '');
  return import.meta.env.DEV ? '/api' : null;
}

export const config = {
  basemapStyleUrl: import.meta.env.VITE_BASEMAP_STYLE_URL || DEFAULT_BASEMAP,
  dataBaseUrl: `${import.meta.env.BASE_URL}data`,
  /**
   * True while the demo fires are the documentation example in public/data/demo;
   * false once the pipeline has written ../data/demo (decided by scripts/demoData.ts).
   */
  fireDataIsExample: import.meta.env.VITE_FIRE_DEMO_SOURCE !== 'team',
  apiBaseUrl: apiBaseUrl(),
} as const;
