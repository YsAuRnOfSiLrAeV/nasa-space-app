import { cn } from '@/lib/utils';
import type { StudyMapController } from '@/components/map/StudyMapController';
import { ViewportReadout } from './ViewportReadout';
import styles from './EarthIntelligence.module.css';

/**
 * Regional exploration: the viewport readout over the map. The analysis itself lives in
 * the investigation panel. The Ontario test dataset's burn-scar rings and stats footer
 * are no longer shown.
 */
export function RegionView({
  hidden,
  mapView,
}: {
  hidden: boolean;
  mapView: StudyMapController | null;
}) {
  return (
    <div inert={hidden} className={cn(styles.region, hidden && styles.regionHidden)}>
      <RegionBackdrop />
      {!hidden && <ViewportReadout mapView={mapView} />}
    </div>
  );
}

/**
 * The theme's map overlay (none in this theme). No fades: the header carries its own
 * flat panel for legibility (project rule: no gradients).
 */
function RegionBackdrop() {
  return <div aria-hidden className="map-atmosphere" />;
}
