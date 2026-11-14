# backend

Пайплайн "полігон -> знімки -> модель -> файли результату" і API.

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; на Linux/Mac: source .venv/bin/activate
pip install -e ".[dev]"
pip install -e ../models
```

## Хто що пише

| Модуль | Хто | Що |
| --- | --- | --- |
| `pipeline/grid.py` | Ярослав | `make_grid(polygon) -> Grid`: UTM-зона, розмір клітинки, межі пожежі + кільце 6 км |
| `pipeline/contract.py` | спільно | контракт таблиці ознак: назви колонок, одиниці, NaN |
| `pipeline/nisar.py` | Ярослав | знайти GCOV-знімок (1 лип - 31 серп, найближчий до 17 лип), прочитати, 3x3 у лінійних, потім dB |
| `pipeline/gee/layers.py` | Міша | S1 VH/VV, NDVI, WorldCover, Hansen, MODIS через `computePixels` |
| `pipeline/gee/zones.py` | Міша | масив `zone` для `cells.json` |
| `pipeline/gee/gedi.py` | Міша | медіана висоти GEDI в кільці 1.5-6 км = 100% відновлення |
| `pipeline/features.py` | Ярослав | таблиця ознак з колонок NISAR і GEE |
| `pipeline/model.py` | Ярослав | `input_report()`, потім модель `forestrecovery` |
| `pipeline/result.py` | Ярослав | `result.json`, `cells.json`, `optical.png` |
| `pipeline/run.py` | Ярослав | усе разом |
| `api/` | Міша | FastAPI, деплой на Cloud Run (пізніше) |

Усі шари рахуються на одному `Grid`. Дати знімків беремо з `forestrecovery.feature_spec()`.
