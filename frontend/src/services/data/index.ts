import { config } from '../../config';
import { StudyDataApi } from './StudyDataApi';

export { DataLoadError, StudyDataApi } from './StudyDataApi';
export type { LandMask, StudyData, StudyDataApiConfig } from './StudyDataApi';

/** The app's data service, reading the files Vite serves from public/data. */
export const studyDataApi = new StudyDataApi({ baseUrl: config.dataBaseUrl });
