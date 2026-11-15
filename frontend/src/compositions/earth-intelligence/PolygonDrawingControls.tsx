import type { StudyMapController } from '@/components/map/StudyMapController';
import type { PolygonDraft } from '@/hooks/usePolygonDraft';

/** Shared drawing actions, shown before the catalog so selection is immediately reachable. */
export function PolygonDrawingControls({
  draft,
  mapView,
  busy,
  onFinish,
}: {
  draft: PolygonDraft;
  mapView: StudyMapController | null;
  busy: boolean;
  onFinish: () => void;
}) {
  const { drawing, points, polygon, setDrawing, setPoints, setPolygon } = draft;
  return (
    <fieldset>
      <legend>Select an area</legend>
      <p>Draw a polygon to select an area to analyze.</p>
      <button
        type="button"
        disabled={!mapView || drawing || busy}
        onClick={() => {
          setDrawing(true);
          setPoints([]);
        }}
      >
        Draw Polygon
      </button>
      <button type="button" disabled={!drawing || points.length < 3} onClick={onFinish}>
        Finish Drawing
      </button>
      <button
        type="button"
        disabled={busy || (!polygon && !points.length && !drawing)}
        onClick={() => {
          setDrawing(false);
          setPoints([]);
          setPolygon(null);
        }}
      >
        Clear Selection
      </button>
      <button type="button" disabled aria-describedby="area-analysis-unavailable">
        Analyze Area
      </button>
      <p id="area-analysis-unavailable">
        New area analysis is unavailable. The backend does not support submission yet. You can open
        existing fire datasets that overlap your selection.
      </p>
      {drawing && (
        <>
          <p role="status">
            Click the map to add vertices ({points.length}). Escape cancels drawing and keeps your
            previous selection. Keyboard users can add the map centre.
          </p>
          <button
            type="button"
            disabled={!mapView}
            onClick={() => mapView && setPoints((previous) => [...previous, mapView.centre()])}
          >
            Add map centre
          </button>
          <button
            type="button"
            onClick={() => {
              setDrawing(false);
              setPoints([]);
            }}
          >
            Cancel drawing
          </button>
        </>
      )}
    </fieldset>
  );
}
