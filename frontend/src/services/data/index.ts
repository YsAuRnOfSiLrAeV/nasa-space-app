import { config } from '../../config';
import { browserImageProbe } from './browserImageProbe';
import { StudyDataApi } from './StudyDataApi';

export { DataLoadError, StudyDataApi } from './StudyDataApi';
export type { ImageProbe, LandMask, StudyData, StudyDataApiConfig } from './StudyDataApi';

/** The app's data service, reading the files Vite serves from public/data. */
export const studyDataApi = new StudyDataApi({
  baseUrl: config.dataBaseUrl,
  // The supplied export (map recovery by year, relative score) is always read; a fire the team
  // pipeline also computed is taken from it, the rest come from the pipeline's data/demo.
  bundleBaseUrl: `${config.dataBaseUrl}/bundle-v2`,
  probeImage: browserImageProbe,
});
