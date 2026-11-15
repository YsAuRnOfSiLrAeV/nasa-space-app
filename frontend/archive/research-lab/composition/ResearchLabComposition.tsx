import { cn } from '@/lib/utils';
import { SourcesList } from '@/components/study/SourcesList';
import { SignalEvidence } from '@/components/visualizations/SignalEvidence';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MapSidePanel } from '../MapSidePanel';
import { StudyStateView } from '../StudyStateView';
import type { CompositionProps } from '../types';
import { HeightScale } from './HeightScale';
import { InstrumentModule } from './InstrumentModule';
import { MapInstrument } from './MapInstrument';
import { PointCloud } from './PointCloud';
import { ReadoutBar, ReadoutGrid } from './ReadoutGrid';
import { TopRail } from './TopRail';
import styles from './ResearchLab.module.css';

/**
 * Retro-Futurist Research Lab: a scientific instrument around a full-bleed map.
 * Top rail · lettered instrument column · bottom readout bar · graticule overlay.
 */
export function ResearchLabComposition({ load, study, mapView }: CompositionProps) {
  // Desktop: the point cloud floats over the map; phones: it joins the instrument sheet.
  const wide = useMediaQuery('(min-width: 768px)');
  return (
    <>
      <div aria-hidden className="map-atmosphere" />
      <MapInstrument mapView={mapView} />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <TopRail load={load} study={study} />

        <div className="relative min-h-0 flex-1">
          {study && wide && (
            <div
              data-map-occluder="right"
              className={cn(styles.plate, 'pointer-events-auto absolute top-4 right-4 w-[340px]')}
            >
              <PointCloud located={study.located} />
            </div>
          )}
          <MapSidePanel
            label="Instrument panel"
            sheetTop="46%"
            className="pointer-events-auto border-rule bg-(color:--panel-bg) max-md:border-t md:inset-y-0 md:left-0 md:w-(--panel-width) md:border-r"
            bodyClassName="flex flex-col gap-(--section-gap) p-4"
          >
            <StudyStateView load={load} />
            {study && (
              <>
                <ReadoutGrid
                  figures={study.figures}
                  className="gap-y-1 [--figure-size:1.25rem] md:hidden"
                  wrap
                />
                <InstrumentModule index="A" title="Canopy height" meta="GEDI L2A · rh98">
                  <HeightScale study={study} />
                </InstrumentModule>
                <InstrumentModule index="B" title="Signal response" meta="Spearman ρ">
                  <SignalEvidence points={study.points} />
                </InstrumentModule>
                <InstrumentModule index="C" title="Viewport">
                  <p className="mb-3 font-[family-name:var(--font-prose)] text-xs leading-relaxed text-muted-foreground">
                    Basemap: OpenFreeMap (OpenStreetMap). Points: {study.manifest.counts.points}{' '}
                    GEDI footprints with NISAR and Sentinel-1 backscatter.
                  </p>
                  <button
                    type="button"
                    onClick={() => void mapView?.fitStudyArea()}
                    className="w-full border border-input px-3 py-2 font-mono text-[10px] tracking-[0.2em] uppercase transition-colors duration-200 hover:border-ring hover:text-amber"
                  >
                    Fit study area
                  </button>
                </InstrumentModule>
                {!wide && <PointCloud located={study.located} />}
                <InstrumentModule index="E" title="Sources">
                  <details>
                    <summary className={cn(styles.label, 'cursor-pointer text-foreground')}>
                      Datasets, credits, limitations
                    </summary>
                    <SourcesList manifest={study.manifest} points={study.points} className="mt-3" />
                  </details>
                </InstrumentModule>
              </>
            )}
          </MapSidePanel>
        </div>

        <ReadoutBar load={load} study={study} />
      </div>
    </>
  );
}
