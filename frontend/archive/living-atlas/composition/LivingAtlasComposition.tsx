import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { BurnGroup } from '@/components/study/burnGroups';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import { MapSidePanel } from '../MapSidePanel';
import { StudyStateView } from '../StudyStateView';
import type { CompositionProps } from '../types';
import { AtlasFieldNotes, ReturnToStudyArea, StudyAtAGlance } from './AtlasFieldNotes';
import { AtlasLegend } from './AtlasLegend';
import { AtlasTitle } from './AtlasTitle';
import { BurnAnnotations } from './BurnAnnotations';
import { useAtlasLayers } from './useAtlasLayers';
import styles from './LivingAtlas.module.css';

/**
 * Living Atlas: the map is the page. Title set on the map, burn-scar call-outs
 * on real groups, field-note cards on the right, legend + layers cut into the edge.
 */
export function LivingAtlasComposition({ load, study, mapView }: CompositionProps) {
  const [layers, setLayers] = useAtlasLayers(mapView);
  const [focusId, setFocusId] = useState<string | null>(null);

  const locate = (g: BurnGroup) => {
    setFocusId(g.id);
    if (!layers.annotations) setLayers({ ...layers, annotations: true });
    mapView?.focus(g.centroid, { minZoom: 9, durationMs: 1400 });
  };
  const legend = study && (
    <AtlasLegend
      manifest={study.manifest}
      groups={study.burnGroups.length}
      layers={layers}
      onChange={setLayers}
    />
  );

  return (
    <>
      {study && (
        <BurnAnnotations
          mapView={mapView}
          groups={study.burnGroups}
          visible={layers.annotations}
          focusId={focusId}
        />
      )}
      <AtlasTitle study={study} />

      {/* Desktop: the legend is cut into the bottom-left map edge. */}
      {legend && (
        <div data-map-occluder="left" className="absolute bottom-0 left-0 z-10 hidden md:block">
          {legend}
        </div>
      )}

      {/* The theme switcher is pinned so it never scrolls out of reach. */}
      <MapSidePanel
        label="Field notes"
        pinned={
          <div className={cn(styles.note, 'px-3.5 py-2')}>
            <ThemeSwitcher variant="compact" />
          </div>
        }
        className="gap-3 max-md:bg-(color:--background) max-md:p-3 md:top-5 md:right-5 md:bottom-5 md:w-(--panel-width)"
        bodyClassName="flex flex-col gap-3"
      >
        <StudyStateView load={load} />
        {study && (
          <>
            <StudyAtAGlance study={study} />
            <AtlasFieldNotes study={study} focusId={focusId} onLocate={locate} />
            {/* Phones: the legend joins the sheet. */}
            <div className="md:hidden">{legend}</div>
            <ReturnToStudyArea onReturn={() => void mapView?.fitStudyArea()} />
          </>
        )}
      </MapSidePanel>
    </>
  );
}
