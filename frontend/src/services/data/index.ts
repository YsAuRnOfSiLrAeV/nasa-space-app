import { config } from '../../config';
import { browserImageProbe } from './browserImageProbe';
import { StudyDataApi } from './StudyDataApi';

export { DataLoadError, StudyDataApi } from './StudyDataApi';
export type { ImageProbe, LandMask, StudyData, StudyDataApiConfig } from './StudyDataApi';

/** The app's data service, reading the files Vite serves from public/data. */
export const studyDataApi = new StudyDataApi({
  baseUrl: config.dataBaseUrl,
  probeImage: browserImageProbe,
});
