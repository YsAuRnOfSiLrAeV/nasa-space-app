# models: the forestrecovery library

The state and forecast models, with their data, version 0.14.0. The full documentation is in
`forestrecovery/README.md`, the input specification in `forestrecovery/FEATURES.md`.

```bash
pip install -e models          # from the repository root, or ../models from backend/
python -m forestrecovery       # self-check: version, data, one prediction
```

The pipeline uses it only through `backend/pipeline/model.py`:

| Function | What the pipeline takes from it |
|---|---|
| `region_for` | which regional model applies at the fire, or that none does |
| `input_report` | check of the five inputs against the training ranges |
| `predict_arrays`, `expected_height` | stage, `p_forest_gt5` and expected height per cell |
| `accuracy` | fire-level error against GEDI lidar for `result.json` |
| `forecast_recovery` | growth forecast with its 80% interval, Canada only |

A new version of the library replaces this folder. If its function names or outputs change,
only `backend/pipeline/model.py` needs to follow.
