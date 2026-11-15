# BC 2003 visual acceptance: verified

Browser acceptance of the existing bc_2003_490 bundle-v2 investigation, run on 2026-11-15 against
the Vite dev server at http://127.0.0.1:5174/ in headless Chrome 157 with a 1440 × 900 content
viewport at device scale factor 1. The browser was driven over the DevTools protocol; screenshots
were taken at every step and geometry was read from the live MapLibre instance. Four confirmed
defects were fixed and re-tested. No other application code was changed.

An earlier attempt on the same day could not control a browser and verified nothing; this record
replaces it.

## Scenario status

| Scenario                                    | Status | Evidence                                                                                                                                                                                                          |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Globe → Explorer → BC 2003 through the UI   | PASS   | Landing action opens Explorer; the BC entry in Examples opens `#/?view=fire&mode=examples&fire=bc_2003_490`; the panel shows "bc_2003_490 · 2003".                                                                |
| Camera fits the fire                        | PASS   | Perimeter and all cells lie inside the uncovered map area, centred within 3 px (perimeter centre x 532, uncovered centre 530). The fit targets the image/grid extent, see note 2 below.                           |
| Cell polygons                               | PASS   | 3,154 features on the map; every geometry and `i` identical to `cells.geojson`. The rendered feature at cell 812's centre is `i` 812, row 34, col 48.                                                             |
| Perimeter                                   | PASS   | Map geometry identical to `polygon.geojson` (90 vertices).                                                                                                                                                        |
| GEDI points                                 | PASS   | 25 points, coordinates identical to `gedi.geojson`; all 25 inside the perimeter and the image footprint; the first point renders at −120.29172, 51.25215.                                                         |
| Rotated RGB image                           | PASS   | Image corners equal `result.image.corners_lonlat`; the top edge runs 25.6° from east; all cell centres and perimeter vertices fall inside the footprint; the burn scar sits inside the perimeter (screenshot).    |
| Registration after pan and zoom             | PASS   | At zoom 11.6 the same GEDI point and cell are returned at their projected positions.                                                                                                                              |
| Cell picking and highlight                  | PASS   | Row 35, column 49 highlights exactly the source polygon of cell 812; hover and click on the map report the cell under the pointer (one tooltip, pinned on click).                                                 |
| Cell timeline changes the map               | PASS   | Cell 812 renders five different colours for 2003, 2010, 2026, 2040 and 2066; camera and forecast year do not change; legend switches to "Modeled cell recovery · year".                                           |
| Whole-fire forecast and 80% interval        | PASS   | 2026: 44%, 27–62%. 2040: 61%, 44–78%, marked extrapolation. 2066: 80%, 63–97%. Curve, shaded band and selected-year marker drawn. Matches the source values below.                                                |
| Layer toggles                               | PASS   | Perimeter and GEDI toggles switch layer visibility and legend entries; the camera does not move.                                                                                                                  |
| Legend with the panel collapsed             | PASS   | Legend stays visible and unobstructed; header, year bar and camera unchanged.                                                                                                                                     |
| Back to Globe, mode switch, switching fires | PASS   | Fire layers are removed on the globe and in Find Your Fire; returning restores BC; Quebec 2010 → BC redraws 3,154 cells and 25 points with the same camera as the first open.                                     |
| Deep link, reload, Back/Forward             | PASS   | A cold load of the fire address draws the same layers and camera; Research → Back keeps the camera; reload restores the fire; eight fire layers, no duplicates.                                                   |
| Scientific labels                           | PASS   | "Relative forest score … not a calibrated probability"; "Modeled canopy height"; "GEDI lidar footprint (measurement)"; "Burn/reference classification not supplied in bundle"; forest stage "no values supplied". |
| Console                                     | PASS   | No application errors in the BC flow. One unrelated message, see note 5 below.                                                                                                                                    |

## Defects found and fixed

1. **Optical image drawn over everything else.** The image layer is added only once the PNG has
   loaded, and it was inserted above the cells, perimeter and GEDI points, hiding them. Layers
   that arrive late are now inserted in their documented order (`StudyMapController.showFireGrid`).
2. **Legend covered the forecast slider.** The legend box overlapped the year bar's label and the
   slider thumb at its starting year. It now sits above the bar (`MapShell.module.css`).
3. **"Not yet reached" in the 80% year.** With the slider on 2066, the supplied 80% year, the
   panel showed 80% and "Not yet reached on the curve", because 2066 − 2003 = 63 is less than the
   supplied 63.1 years. A supplied milestone year now decides (`estimateFor`).
4. **Fire framed off-centre after "Show on map".** The cell inspector's camera move left padding
   on the map, so every later fit (returning from the globe, switching fires) placed the fire a
   quarter of the screen to the left, partly under the legend. The move now uses an offset and
   leaves no padding (`StudyMapController.focus`).

Each fix has a regression test (`StudyMapController.test.ts`, `fireResults.test.tsx`).

## Noncritical issues, not changed

1. Globe markers are labelled "documentation example data" and the Examples list says "Recovery
   not supplied", although these are supplied exports with a model estimate for 2026.
2. The camera fits the image/grid extent, so the perimeter fills about half the uncovered height.
3. The relative-score legend mentions "the geographic domain shown in grey", which this bundle
   does not contain.
4. The cell timeline has no numeric readout for the inspected cell and its legend has no colour
   ramp, only a sentence.
5. Find Your Fire requests `data/catalog/index.json`, which is not in `public/data`; the dev
   server answers with HTML and a JSON parse error is logged.
6. Map zoom and scale controls sit under the header and the panel.
7. On a cold deep link in the dev server, `result.json`, `cells.geojson` and `rgb.png` are each
   requested twice. Not checked in a production build.

## Not verified

Mobile layout, keyboard-only operation, a real pointer drag on the sliders (values were set
programmatically), a production build, and the other three fires beyond one switch to Quebec 2010.

## Supplied fire-level reference values

Read from `public/data/bundle-v2/fire_bc_2003_490/summer_2026/result.json`.

| Year | Recovery ratio | Low bound | High bound |
| ---- | -------------- | --------- | ---------- |
| 2026 | 0.4436         | 0.2712    | 0.6161     |
| 2040 | 0.6106         | 0.4382    | 0.7831     |
| 2066 | 0.7993         | 0.6269    | 0.9717     |

The supplied `year_80pct` is 2066. The 2066 series value is 0.7993, shown as 80%.
