import { config } from '../../config';
import { BackendApi } from './BackendApi';

export { BackendApi } from './BackendApi';
export type { BackendApiConfig, BackendStatus } from './BackendApi';

/** The app's client for the team API (dev: Vite proxy at /api; production: VITE_API_URL). */
export const backendApi = new BackendApi({ baseUrl: config.apiBaseUrl });
