import { DataLoadError } from '../services/data/StudyDataApi';

/** The reader-facing message for a failed load; unexpected errors are logged. */
export function loadErrorMessage(e: unknown): string {
  if (e instanceof DataLoadError) return e.message;
  console.error(e);
  return 'Unexpected error while loading data.';
}
