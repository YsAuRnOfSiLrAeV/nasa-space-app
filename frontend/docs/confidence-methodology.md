# Confidence zones and methodology

Phase 9 reuses the supplied `confidence_zones.geojson` and its validated loader. Examples and Find Your Fire share one applicability resource. The existing map remains persistent; no fire resources or scientific outputs are replaced.

## Geographic visualization

The compact Confidence zones disclosure is available in the Explorer panel, alongside a Methodology & limitations link. The primary navigation also names the existing research route Methodology. Zones are off by default to preserve the scientific map; users choose one provider classification:

- `model1_region`: current-state geography, with three verified and three extrapolated source features.
- `model2_growth`: verified growth-forecast geography, supplied for Canada.
- `model2_scenario`: scenario geography supplied for Ukraine; this is not a growth forecast or permission to compute a new scenario.

Verified regions use solid outlines and stronger fills; extrapolated regions use dashed outlines and lighter fills. Source model-1 colors and opacity are preserved. Fallback display colors distinguish model-2 layers. Colors/opacity are visual treatments, not probability values. The legend uses source region names and provider ranking grades; no grade is recalculated from other studies.

The original geometries are placed in one shared GeoJSON source below selected-fire imagery, cells, outlines and GEDI points. Changing classifications changes filters rather than resending geometry. Zone display does not move the camera. Clearing a fire leaves global geographic context intact; switching off zones or leaving the panel removes only the confidence layers/source. Missing/invalid data disables unavailable choices and leaves coverage unknown.

## Scientific context

The Methodology page now has a compact guide separating sensor observations, modeled state and projections. Detailed sensor roles and calibration limits are disclosed on demand. Primary references cover NASA NISAR forest sensing, Copernicus Sentinel-1, NASA vegetation indices and GEDI product definitions.

The guide explains that backscatter and NDVI are signals, GEDI footprints provide lidar-derived reference metrics, and cell heights/recovery are modeled estimates. Sensor roles do not establish that a selected fire has a particular acquisition: missing metadata stays unavailable. Real bundle forecasts and uncertainty are supplied series; the separate cell timeline is modeled and is not a new observation.

Existing calibration charts retain their credited study values. Copy was corrected where it claimed no zone geometry existed, confused geography with pipeline flags/grey cells, described 0–100 display bands as raw scores, or said the real bundle forecast was reconstructed from an inferred equation. The normalized conceptual curve remains explicitly illustrative and is not a selected-fire prediction.

Reliability limitations include ranking versus probability calibration, temporal mismatch, provisional NISAR calibration, terrain/cloud handling, reference-forest uncertainty, excluded pixels, training-data overlap and unsupported forecasts. Selected-fire warning codes and reliability statements remain beside their own scientific results. New backend analysis remains unavailable.

The Methodology return link uses the existing map-navigation context to restore the exact selected fire/mode/country. No new route or navigation framework is introduced.

## Verification

Regression tests cover all eight provider features and classifications, style-data validation, solid/dashed treatments, original geometry preservation, source reuse, scientific-layer ordering, camera independence, cleanup, unknown coverage, methodology content/primary links and return-route selection. Existing full-catalog, spatial, forecast, drawing and coverage checks remain enabled.

Browser visual acceptance must be reported separately. Until the browser automation host is available, desktop/mobile overlay appearance, controls and navigation are NOT VERIFIED; automated source and controller tests do not establish visual acceptance.

No backend modifications, original-data changes, new dependencies or automatic commits are part of this phase.
