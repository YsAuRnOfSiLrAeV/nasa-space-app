/**
 * Provenance of every dataset the app shows or was built from. Facts come from the
 * data pipeline (plan_documentation/SPACEAPPS_CONTEXT.md), the basemap style and
 * the globe build script. Shown by every theme; keep wording factual.
 */
import type { Manifest, PointProperties } from './schema';

export type YearRange = [first: number, last: number];

/** First and last year of the GEDI lidar observations; null when there are none. */
export function gediYearRange(points: readonly PointProperties[]): YearRange | null {
  if (points.length === 0) return null;
  let first = Infinity;
  let last = -Infinity;
  for (const p of points) {
    if (p.gedi_year < first) first = p.gedi_year;
    if (p.gedi_year > last) last = p.gedi_year;
  }
  return [first, last];
}

/** "2019–2022", or "2021" when the range is a single year. */
export function formatYearRange([first, last]: YearRange): string {
  return first === last ? `${first}` : `${first}–${last}`;
}

export interface DataSource {
  id: string;
  name: string;
  /** What it contributes here and how it was processed. */
  use: string;
  /** Required credit / licence. */
  credit: string;
  /** Known limitations a reader should keep in mind. */
  limits: string;
}

export interface SourceGroup {
  title: string;
  sources: DataSource[];
}

export function studySources(
  manifest: Manifest | null,
  gediYears: YearRange | null,
): SourceGroup[] {
  const dates = manifest?.nisar_dates.join(', ');
  const years = gediYears ? formatYearRange(gediYears) : null;

  return [
    {
      title: 'Measured at each point',
      sources: [
        {
          id: 'gedi',
          name: 'GEDI L2A v002, canopy height (rh98)',
          use: `Spaceborne lidar on the International Space Station. June–September footprints${years ? ` (this dataset: ${years})` : ''}, quality-filtered (quality flag 1, not degraded, sensitivity ≥ 0.95), read from Earth Engine monthly rasters; heights over 35 m removed. Reference observations, not model predictions.`,
          credit: 'NASA / University of Maryland GEDI mission.',
          limits:
            'GEDI only samples between 51.6°N and 51.6°S, the inclination of the ISS orbit. That latitude is a limit of GEDI coverage, not of NISAR or of this study area. Each footprint is a ~25 m circle, not a stand average.',
        },
        {
          id: 'nisar',
          name: 'NISAR L2 GCOV, L-band HV and HH',
          use: `Terrain-corrected backscatter (gamma0)${dates ? `, acquired ${dates}` : ''}, accessed through NASA Earthdata.`,
          credit: 'NASA–ISRO NISAR mission.',
          limits:
            'Provisional product (NISAR_L2_GCOV_PROVISIONAL_V1, available since June 2026); values may change in later releases.',
        },
        {
          id: 's1',
          name: 'Sentinel-1 GRD, C-band VH and VV',
          use: 'Interferometric Wide mode, median over the radar window, 30 m smoothing, via Earth Engine.',
          credit: 'Contains modified Copernicus Sentinel data (ESA).',
          limits:
            'Sigma0 without terrain correction (unlike NISAR gamma0), so only slopes under 10° were sampled.',
        },
        {
          id: 'ndvi',
          name: 'NDVI from Sentinel-2 surface reflectance',
          use: 'Median of 1 July – 15 August 2026 scenes with under 20% cloud.',
          credit: 'Contains modified Copernicus Sentinel data (ESA).',
          limits:
            'Optical greenness returns as soon as any vegetation regrows; it does not measure tree height.',
        },
        {
          id: 'dem',
          name: 'Copernicus DEM GLO-30',
          use: 'Elevation and slope at each point; slopes of 10° or more excluded.',
          credit:
            '© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA.',
          limits: '30 m grid.',
        },
      ],
    },
    {
      title: 'Used to select the sample',
      sources: [
        {
          id: 'mcd64',
          name: 'MODIS MCD64A1 burned area (Collection 6.1)',
          use: `Fire year per point${manifest ? ` (${manifest.fire_years.join(', ')})` : ''}: exactly one burn in 2001–2012, confirmed by Hansen forest loss within ±1 year.`,
          credit: 'NASA, distributed by the LP DAAC.',
          limits:
            '500 m pixels. Burn-scar groups are fire year + 0.25° cell clusters of sample points, not fire perimeters.',
        },
        {
          id: 'hansen',
          name: 'Hansen Global Forest Change v1.11',
          use: 'Tree cover in 2000 of at least 30%, and the forest-loss year.',
          credit: 'Hansen / UMD / Google / USGS / NASA, CC BY 4.0.',
          limits: 'Loss is detected from Landsat at 30 m and may miss partial burns.',
        },
        {
          id: 'worldcover',
          name: 'ESA WorldCover v200',
          use: 'Unburned reference points must be forest today; water, wetland and built-up excluded.',
          credit:
            '© ESA WorldCover project; contains modified Copernicus Sentinel data processed by the ESA WorldCover consortium, CC BY 4.0.',
          limits: '2021 land cover at 10 m.',
        },
        {
          id: 'context',
          name: 'MODIS MCD12Q1 (2001) and ERA5-Land',
          use: 'Pre-fire land-cover type and precipitation over the radar window, stored with each point but not displayed.',
          credit: 'NASA LP DAAC; contains modified Copernicus Climate Change Service information.',
          limits: 'Context variables only.',
        },
      ],
    },
    {
      title: 'Recovery history (fetched per burn group)',
      sources: [
        {
          id: 'landsat',
          name: 'Landsat Collection 2 Level-2 surface reflectance',
          use: 'Before/after images and the summer NDVI history on the Forest Recovery page, sampled at the group’s GEDI points and nearby unburned points (npm run data:landsat). Accessed through Microsoft Planetary Computer.',
          credit:
            'Landsat imagery courtesy of the U.S. Geological Survey (public domain). Landsat 5 TM, Landsat 7 ETM+, Landsat 8–9 OLI.',
          limits:
            'Only fetched for some groups. Summer scenes only; clouds, shadow, cirrus and snow masked per pixel, so some years have no value. The sensors differ slightly and are not cross-calibrated here. Landsat 7 scenes after May 2003 have scan-line gaps and are not used as images.',
        },
      ],
    },
    {
      title: 'Map and globe',
      sources: [
        {
          id: 'natural-earth',
          name: 'Natural Earth 1:110m land, v5.1.2',
          use: 'Land dots on the Earth Intelligence globe (npm run data:globe).',
          credit: 'Natural Earth, public domain.',
          limits: 'Generalised outlines: small islands and narrow coastlines are missing.',
        },
        {
          id: 'blue-marble',
          name: 'Blue Marble Next Generation',
          use: 'Satellite imagery under the Earth Intelligence map, colour-graded darker and cooler.',
          credit: 'NASA Earth Observatory, served by NASA EOSDIS GIBS.',
          limits:
            'A 2004 monthly composite at about 500 m, not current conditions; it blurs beyond zoom 8.',
        },
        {
          id: 'basemap',
          name: 'OpenFreeMap vector tiles',
          use: 'Water, roads, boundaries and place names.',
          credit: 'OpenFreeMap; © OpenMapTiles; data © OpenStreetMap contributors (ODbL).',
          limits: 'Recoloured per theme; land cover removed so it cannot compete with forest data.',
        },
        {
          id: 'terrain',
          name: 'Mapzen Terrain Tiles',
          use: 'Hillshade relief layer in the map style; switched off in the current dark map.',
          credit: 'Mapzen Terrain Tiles on AWS Open Data (SRTM, GMTED2010, NRCan CDEM and others).',
          limits: 'Shading only; no elevation values or contours are derived from it.',
        },
      ],
    },
  ];
}
