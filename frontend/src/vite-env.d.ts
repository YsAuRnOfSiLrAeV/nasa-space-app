/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASEMAP_STYLE_URL?: string;
  /** Base URL of the team FastAPI (Cloud Run) in production builds; dev uses the `/api` proxy. */
  readonly VITE_API_URL?: string;
  /** Set by the build (scripts/demoData.ts): 'team' when ../data/demo is served, else 'example'. */
  readonly VITE_FIRE_DEMO_SOURCE?: 'team' | 'example';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
