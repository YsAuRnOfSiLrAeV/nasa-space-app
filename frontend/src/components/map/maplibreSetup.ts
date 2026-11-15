/**
 * MapLibre 6 locates its web worker relative to its own module URL
 * (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`). Once Vite bundles
 * MapLibre (dev pre-bundling and production builds), that sibling file no longer
 * exists and every tile/GeoJSON source fails with "Worker failed to load".
 * Let Vite bundle the worker explicitly and hand MapLibre its URL instead.
 */
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
