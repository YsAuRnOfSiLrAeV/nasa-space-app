import { useState } from 'react';
import { useRecoveryData, type RecoveryDataState } from '@/hooks/useRecoveryData';
import { WithLandsat } from './WithLandsat';
import { NdviHistory } from './NdviHistory';
import styles from './Recovery.module.css';

/** Keep sensor histories separate so changing products never splices a trend. */
export function OpticalHistory({
  groupId,
  landsatState,
}: {
  groupId: string;
  landsatState: RecoveryDataState;
}) {
  const { state: modis } = useRecoveryData(groupId, undefined, 'appeears');
  const [source, setSource] = useState<'landsat' | 'appeears'>('landsat');
  const state = source === 'landsat' ? landsatState : modis;
  return (
    <div className="space-y-5">
      <label className="flex flex-wrap items-center gap-3 text-sm">
        Observation record
        <select
          className="min-h-11 rounded-(--radius) border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          value={source}
          onChange={(event) => setSource(event.target.value as typeof source)}
        >
          <option value="landsat">
            Landsat · {landsatState.status === 'ready' ? 'available' : 'coverage pending'}
          </option>
          <option value="appeears">
            MODIS via AppEEARS · {modis.status === 'ready' ? 'available' : 'coverage pending'}
          </option>
        </select>
      </label>
      <WithLandsat
        state={state}
        what="the yearly greenness record"
        absent={
          source === 'appeears'
            ? 'An AppEEARS vegetation record has not been extracted for this sampling group yet.'
            : undefined
        }
      >
        {(record) => <NdviHistory key={source} landsat={record} />}
      </WithLandsat>
      {source === 'appeears' && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          MODIS provides 250 m, 16-day vegetation composites. The extraction workflow requests
          July–August NDVI and pixel reliability for the same burned and reference sampling
          locations.{' '}
          <a
            href="https://appeears.earthdatacloud.nasa.gov/"
            className={styles.link}
            target="_blank"
            rel="noreferrer"
          >
            NASA AppEEARS
          </a>
        </p>
      )}
    </div>
  );
}
