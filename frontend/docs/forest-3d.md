# Forest growth in 3D (optional module)

An illustration, not a measurement. The page shows a synthetic boreal stand whose trees grow to the
height the model estimates for a chosen fire and year. It complements the map; it never replaces
it, and nothing on the map depends on it.

- Page: `#/research/forest-3d` (`src/pages/forest3d`), loaded lazily, so Three.js is fetched only
  when the page opens. Linked from the landing and the Research intro.
- Module: `src/features/forest3d`, imported only through its `index.ts`.

## What drives the picture

| In the picture              | Follows                                                                                                                                                                                                                                                                                                                                                                                                        | Kind                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Tree height                 | Modeled whole-fire recovery for the year (`result.json` → `model2.series.recovery`) × each tree's mature height. 1 draws the reference forest; values above 1.15 are drawn at 1.15.                                                                                                                                                                                                                            | Model estimate                     |
| Spread of heights           | With a cell timeline: each tree takes one of 21 quantiles of that year's modeled cell recovery (`timeline.json`). Missing cells are ignored.                                                                                                                                                                                                                                                                   | Model estimate                     |
| Young trees present         | `0.25 + 1.5 × recovery` of the tree positions                                                                                                                                                                                                                                                                                                                                                                  | Illustrative assumption            |
| Fire-killed trunks standing | `exp(−years since fire / 20)`                                                                                                                                                                                                                                                                                                                                                                                  | Illustrative assumption            |
| Shrubs                      | `1 − 0.75 × recovery` of the shrub positions, at least 0.2                                                                                                                                                                                                                                                                                                                                                     | Illustrative assumption            |
| Broadleaf pioneers          | Grow up to 1.5× faster while recovery is low (`1 + 0.5 × (1 − recovery)`)                                                                                                                                                                                                                                                                                                                                      | Illustrative assumption            |
| Before the fire             | The reference forest: mature living trees, no dead trunks, little understorey                                                                                                                                                                                                                                                                                                                                  | Illustrative                       |
| Burn outline, ground tone   | The fire's real perimeter (`polygon.geojson`), projected north-up and scaled so the burn covers about 30% of the block (never more than 1.5 block widths across; the rest is cut off at the edge). The shape is real, the size is not (the caption says how many km the block stands for). Inside it the forest regrows; outside it stands unburned (mature trees, no fire-killed trunks, little understorey). | Data (shape), illustrative (scale) |
| Tallest trees               | The neighbouring forest's height for the fire (`neighbour_forest.height_m`, GEDI median) divided by an 18 m anchor, limited to 0.5-1.2                                                                                                                                                                                                                                                                         | Data                               |
| Terrain, species, positions | A synthetic block, different for each fire: the fire id seeds the relief, stream and tree positions. Relief and species mix are typical of the region (`bc`/`alberta`: mountain, pine and fir; `quebec`: eastern boreal; others: shield), not measured at the site.                                                                                                                                            | Illustrative                       |

The mapping lives in `recoveryAdapter.ts` (`growthFromRecovery`) and is tested in `growth.test.ts`.
Only fires with a growth forecast can be shown. Each plant is scattered once with a fixed rank, so
from year to year the same trees stay, grow and are joined by new ones, and a year change animates
in place (instantly with reduced motion).

## Comparison and fallbacks

- Compare with **before the fire** (the reference forest, what 100% means) or **the fire year**:
  two scenes side by side, stacked on narrow screens.
- No WebGL, or a lost graphics context: a text fallback with the same numbers.
- Slow device: on start the view times about 24 frames. Below about 15 frames per second it turns
  shadows off; if still slow, the text fallback replaces it, with "Show the 3D view anyway".

## Removing it

`isolation.test.ts` checks that only the forest page imports the module and that only `App.tsx`
imports the page, lazily. To remove the feature:

1. Delete `src/features/forest3d` and `src/pages/forest3d`.
2. In `src/app/App.tsx`, remove the lazy `Forest3DPage` import and its `case 'forest3d'`.
3. In `src/app/route.ts`, remove `FOREST_3D_HREF` and the `forest3d` route (and its test in
   `route.test.ts`).
4. Remove the two links to `FOREST_3D_HREF` in `LandingOverlays.tsx` and `ResearchIntro.tsx`.
5. `npm uninstall three @types/three`.
