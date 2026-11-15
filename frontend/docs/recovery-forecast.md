# Supplied fire-level recovery forecast

Phase 7 keeps the existing chart, slider, bundle-v2 reader and v1 compatibility. It completes the presentation of the selected fire's `result.json → model2`, without reconstructing a bundle forecast equation or using the illustrative curve from the task.

| Supplied field                                   | Presentation                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `series.years/recovery`                          | Recovery by calendar year, copied directly. Null central estimates leave gaps and display “Not available”.                                                                            |
| `series.low/high`                                | Separate lower/upper 80% bound traces and a shaded band only where both bounds exist. Available one-sided and isolated bounds remain visible. No interpolation across missing bounds. |
| `now_recovery`                                   | Current modeled whole-fire estimate for the exported summer, shown separately and marked on the chart. No fallback to the series or cell average.                                     |
| `interval_80`                                    | Clearly labeled supplied 80% **summary** interval. Displayed independently from selected-year series bounds; neither replaces the other. Missing summary intervals are explicit.      |
| `year_80pct`                                     | Supplied calendar-year milestone, not recalculated from rounded curve values.                                                                                                         |
| `years_to_80pct`                                 | Supplied years after the fire. Optional milestone absence no longer hides an otherwise valid series.                                                                                  |
| `valid_region`, `reliability.model2`, `warnings` | Source region, reliability statement and readable warning codes beside the forecast. Unknown codes remain visible.                                                                    |
| `forecast: none`, `reason`                       | Explicit unavailable-forecast explanation; no illustrative or legacy curve is substituted.                                                                                            |

Percentage labels preserve two decimal places where needed, corresponding to the source's four-decimal ratios. Zero is a real value. Missing values remain missing. The chart's vertical scale includes the central values and both bounds, including values above 100% of reference height.

The bundle chart no longer invents an age-validation range in code. Reliability comes from the selected result's own text and warning codes. Existing legacy v1 forecasts retain their explicit `reliable_age` contract and validated equation path.

The fire-level forecast slider changes only its chart/readout. It does not recolor the spatial map, change the separate cell timeline or adjust the supplied forecast to a cell estimate. Both historical and future cell timeline values remain modeled estimates from a separate resource.

BC 2003 supplies current modeled recovery **44.36%**, summary interval **27.12%–61.61%**, milestone year **2066** and **63.1** years after the fire. These are source values, not observations or confidence probabilities. Its supplied reliability warning remains visible even though the series extends to 2066.

Verification covers a separate rendered forecast case for all 80 fires, all original series values, current/summary fields, source reliability and warnings, summary-only fires, unsupported forecasts, missing milestones, differing summary/per-year intervals, null central values, partially/completely absent bounds and reversed uncertainty bounds. Existing catalog, spatial, timeline and v1 checks remain enabled.

Browser visual acceptance is separate from source-data verification. The browser automation host has been unavailable; chart layout and interactive visual acceptance must not be claimed without a successful browser test. No backend code, original scientific assets, dependencies or commits are changed by this phase.
