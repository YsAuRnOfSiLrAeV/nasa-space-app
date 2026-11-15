# Forest Recovery with NISAR

NASA Space Apps Challenge 2026, challenge "Dancing with the SARs". Team Sentinellae Silvae.

After a wildfire, satellite images usually show the burn turning green again within a few years.
Optical indices such as NDVI see that green, but they cannot tell young shrubs from a forest that
has grown back. This project uses the L-band radar of the NASA-ISRO NISAR mission, which is
sensitive to trunks and branches, to show how far a burned forest has actually come back and
when it is likely to be a forest again.

## What the app does

- Shows fires that are already computed on a globe. For each fire it shows the forest height
  stage of every cell (under 5 m, 5-10 m, over 10 m), how recovered the fire is today compared
  with the unburned forest around it, and a forecast of when it reaches 80% of that height.
- Compares three views of the same fire: what optics suggests, what our NISAR model says, and
  what GEDI lidar measured.
- Lets a user find a fire in the catalog or draw an area, and runs the same pipeline for it.

For now the model is calibrated and checked for Canada only. The map shows where it can be
trusted elsewhere.

## How it works

1. The fire perimeter comes from the Canadian National Burned Area Composite (NBAC).
2. A 30 m grid is laid over the fire and the forest around it.
3. NISAR GCOV backscatter (HH, HV), Sentinel-1 backscatter (VH, VV) and Sentinel-2 NDVI from the
   same summer are read onto that grid.
4. The state model turns these five values into a forest height stage for every cell.
5. The unburned forest 1.5-6 km around the fire, measured by GEDI lidar, sets "100% recovery".
6. The forecast model uses the fire age and a few site factors (slope, elevation, soil, burn
   severity) to estimate the year the fire reaches 80% of the neighbour forest height.
7. The result is written as a small set of JSON files that the frontend draws.

At fire level the model's recovery estimate differs from GEDI lidar by about 12% on fires it
did not see in training.

## Data

| Source | Used for |
|---|---|
| NISAR L2 GCOV (NASA Earthdata) | radar backscatter, the main input |
| Sentinel-1 GRD | radar backscatter at C-band |
| Sentinel-2 surface reflectance | NDVI, the optical view |
| GEDI L2A | forest height for training and for the neighbour forest |
| NBAC | fire perimeters and fire history in Canada |
| ESA WorldCover, Hansen Global Forest Change, MODIS MCD64A1 | water, forest, logging and older fires around the burn |

## Repository

```
frontend/   web app (React, TypeScript, Vite, MapLibre, Three.js, Tailwind)
backend/    pipeline "fire polygon -> satellite layers -> model -> result files" and the API
models/     forestrecovery, the model library
fires/      fire catalog and model confidence zones
data/       small training data and computed demo fires
docs/       research notes and methodology
```

How to set up and run each part is in its own README: [backend](backend/README.md),
[frontend](frontend/README.md), [models](models/README.md).

## Working rules

- Keys and tokens live only in `.env` (template in `.env.example`) and are never committed.
- Large rasters stay out of Git.
- `main` always works.
- The result format and the feature names change only after the team agrees.
