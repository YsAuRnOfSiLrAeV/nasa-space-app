import { AlertIcon, RetryIcon } from './icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { StudyLoad } from '@/components/study/studyView';

/** Shared loading / error presentation (styled by theme tokens). Renders nothing when ready. */
export function StudyStateView({ load }: { load: StudyLoad }) {
  if (load.status === 'loading') {
    return (
      <div className="space-y-3" role="status" aria-label="Loading study data">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (load.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertIcon />
        <AlertTitle>Study data unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{load.message}</p>
          <Button variant="outline" size="sm" onClick={load.retry}>
            <RetryIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
