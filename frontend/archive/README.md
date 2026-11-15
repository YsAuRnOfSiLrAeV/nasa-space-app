# Archived themes

Earth Intelligence is the app's only theme as of 2026-11-13. The two other
themes are kept here unchanged so their parts can be reused. They are **not
built, type-checked or linted**: nothing in `src/` imports from this folder.

| Folder            | What it was                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `research-lab/`   | Research Lab: black, white and amber scientific instrument. Lettered instrument modules, map viewport readout (`MapInstrument`), point cloud, readout bar.    |
| `living-atlas/`   | Living Atlas: light editorial atlas. Title set on the map, contour field, field-note cards, burn-scar register and map call-outs, legend with layer switches. |
| `theme-switcher/` | `ThemeSwitcher` (stacked / inline / compact variants) and `ThemePreview` thumbnails. Not needed while there is one theme.                                     |

Each theme folder holds `composition/` (the React layout, formerly
`src/compositions/<id>/`) and `theme.css` (its CSS variables, formerly
`src/styles/themes/<id>.css`). `living-atlas/KeyFigures.tsx` was
`src/components/study/KeyFigures.tsx`.

## Already reused in Earth Intelligence

- **Burn-year register, fly-to and map call-outs** (Living Atlas
  `BurnRegister`, `BurnAnnotations`): rebuilt in
  `src/compositions/earth-intelligence/` with Earth Intelligence styling.
- **Point cloud** (Research Lab `PointCloud`): rebuilt in
  `src/compositions/earth-intelligence/ForestPointCloud.tsx`. Its geometry,
  `src/components/graphics/pointCloud.ts`, is still shared and tested.

## Restoring a theme

1. Move `composition/` back to `src/compositions/<id>/` and `theme.css` back to
   `src/styles/themes/<id>.css` (plus `KeyFigures.tsx` and
   `theme-switcher/*` to their old places, see above).
2. Add the theme to `THEMES` in `src/theme/themes.ts`, to `THEME_MODES` in
   `index.html`, to `COMPOSITIONS` in `src/compositions/index.ts`, and
   `@import` its CSS in `src/styles/index.css`. `src/theme/themes.test.ts`
   checks that these stay in sync.
3. Reinstall and import its fonts:
   - Research Lab: `@fontsource/ibm-plex-mono` (300, 400, 500) and
     `@fontsource-variable/ibm-plex-sans`.
   - Living Atlas: `@fontsource/anton` and `@fontsource-variable/inter`
     (JetBrains Mono is still installed; Inter was replaced by Geist on
     2026-11-14).
4. Put a `ThemeSwitcher` back in each header and run `npm run check`.
   The code was written against the APIs of 2026-11-13 (`CompositionProps`,
   `StudyMapController`, `MapSidePanel`), so expect small fixes if those have
   moved on since. Known since then (2026-11-14): `StudyStateView` moved to
   `@/components/shell/StudyStateView`. Shared styles (`micro`, `sectionHead`,
   `ghost`, `register`) are in `@/components/shell/primitives.module.css`.
