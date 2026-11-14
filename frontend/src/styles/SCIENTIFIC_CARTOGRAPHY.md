# Explore landing: scientific cartography

The Explore landing uses a restrained research-figure vocabulary: neutral land
plates, fine coastlines, a geographic graticule, monospace annotations and a
grotesk headline. Natural Earth land polygons and the study's supplied GEDI
locations remain the geographic sources. No terrain elevations, forest coverage,
canopy heights or satellite tracks have been synthesized for this visual pass.

## Scope and interaction

- The Earth is larger, with stronger land/ocean separation and a single limb.
- Land and ocean use opaque material tokens. Coastlines and the graticule use
  solid ink colours, without lighting overlays or depth-based brightness. The
  geographic plates start at full size facing Canada, without a fade or zoom-in.
- The starfield, illustrative orbit paths and pulsing marker effect are removed
  from this landing composition. The underlying legacy components remain available.
- Blue identifies the study observations and the primary action. Amber identifies
  fire investigation markers, which are square and keyboard accessible.
- A north-up reference and the actual 30°/20° graticule spacing explain orientation.
- Pointer response, quiet camera drift, reduced-motion support, fire navigation,
  Ontario study entry, source disclosure, and scientific caveats are retained.
- Typography and placement adapt for narrow and short screens. The new palette is
  scoped to the landing; backend files, routes and data contracts are unchanged.

## Plate composition (second pass)

The globe is the central figure, centred on the stage. Around it:

- **Ground**: charcoal technical paper (`ContourGround.tsx`, `planet/contours.ts`).
  Hairline contours from a seeded noise field, sparse in the middle and gathering
  into relief along the lower edge and sides. Decorative only: no coordinates or
  elevations, and the figure index states "not measured terrain".
- **Datum**: one hairline through the globe's centre. The lead's field note sits
  above it and the headline below; the right column splits on it.
- **FIG. 01A, observation window** (`ObservationWindow.tsx`): the most recent
  rendered Landsat natural-colour scene of one Ontario burn (`2002_205_-376`),
  from the recovery record. Its true extent is marked on the globe and joined to
  the window by two leader lines, re-placed every frame and on layout changes.
  If the record is absent, neither the window nor the mark is drawn.
- **FIG. 02, comparison** (`ObservationSchematic.tsx`): equal greenness bands
  above, different stand structure below. Labelled "Schematic" and "Conceptual
  illustration, not measured forest geometry" on the figure itself.
- **Ontario annotation** moved off the sphere (the in-canvas label is disabled
  when the landing supplies `onAnchors`). Fire names sit west of their markers;
  documentation-example fires use dashed outlines.
- **Spacecraft** (`planet/drawSatellites.ts`): NISAR (bus, one wing, mesh
  reflector on its boom), Landsat 8/9 (bus, one array) and the ISS carrying GEDI
  (truss, modules, arrays), flying dashed orbits at their real inclinations from
  `data/missions.ts`. Radius, node, speed and phase are illustrative, as the figure
  index states; the reduced-motion pose shows all three in front of the globe.
- **Ground** matches the document pages' black bands (`#060606`); the figure
  index is the landing's one white strip, like their white reading sections.
- **Footer** is a figure index (01, 01A, 02, ground note), with Layers & notes and Sources.
- Narrow desktops (1024–1279 px) drop the right column; below 1024 px the
  datum, column and leaders are hidden and the lead sits under the globe.

## Reusable styling

`compositions/earth-intelligence/ScientificLanding.module.css` contains the tokens
and figure grammar. The `surface` class owns the local OKLCH palette:

| Token                       | Role                               |
| --------------------------- | ---------------------------------- |
| `--cartography-ground`      | Near-black figure background       |
| `--cartography-ink`         | Off-white primary annotations      |
| `--cartography-muted`       | Neutral secondary annotations      |
| `--cartography-rule`        | Construction and figure rules      |
| `--cartography-action`      | Selected controls and observations |
| `--cartography-observation` | Amber fire markers                 |

The `scientificPlate`, `sectionRule`, `coordinate`, `figureIndex` and `figureCaption`
classes provide a common vocabulary for later terrain figures, measured canopy
plots, cross-sections and conceptual layer diagrams. They provide layout only;
future figures must supply their own real measurements or explicit illustration
labels. Those complex visualizations are outside this implementation.

The canvas uses the same scoped semantic colours. Fill opacity is applied through
the canvas context, so OKLCH colours do not pass through the older hex-only alpha
helper. Land fill uses an even-odd rule to retain polygon holes.

## Verification

- TypeScript and ESLint passed.
- All 229 tests passed.
- Production build passed. The PostCSS `from` warning was later fixed by
  removing the cross-file `composes` in `EarthIntelligence.module.css`.
- No dependencies were added and no commit was created.
- Desktop and mobile screenshots could not be verified: the browser access host
  was unavailable, and native capture returned another application's window while
  bound to Edge. Capture was stopped. These screenshots remain an outstanding
  visual QA step; no unrelated application's image was saved as a project artifact.
