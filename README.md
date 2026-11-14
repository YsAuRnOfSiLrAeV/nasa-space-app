# Forest Recovery with NISAR — Space Apps 2026

NASA Space Apps Challenge 2026, челендж "Dancing with the SARs". Інструмент показує, чи справді
відновився ліс після пожежі: радар NISAR (L-діапазон) бачить стовбури й гілки, а не лише зелень,
яку бачить оптика (NDVI).

> Публічний README англійською для журі допишемо ближче до подачі.

## Структура

```
frontend/   застосунок (React, TS, Vite, MapLibre, Three.js, Tailwind) — Катя
backend/    пайплайн "полігон -> знімки -> модель -> результат" і API
  pipeline/
    grid.py       make_grid, Grid                          — Ярослав
    contract.py   назви колонок ознак, одиниці, NaN         — спільно
    nisar.py      NISAR GCOV з Earthdata на сітку           — Ярослав
    gee/          шари з Google Earth Engine                 — Міша
      layers.py   Sentinel-1, NDVI, WorldCover, Hansen, MODIS
      zones.py    зони клітинок (згарище / сусідній ліс / не враховуємо)
      gedi.py     висота сусіднього лісу з GEDI
    features.py   збирання таблиці ознак                     — Ярослав
    model.py      input_report + виклик моделі               — Ярослав
    result.py     result.json, cells.json, optical.png       — Ярослав
    run.py        оркестрація всього пайплайна
  api/            FastAPI (Cloud Run)                        — Міша
models/     бібліотека forestrecovery                        — Софія
fires/      каталог пожеж NBAC і зони впевненості            — Міша
data/       невеликі навчальні дані і демо-результати
docs/       research.md, методологія, модель, архітектура
```

## Правила

- Ключі й токени лише в `.env` (шаблон у `.env.example`).
- Великі растри не в Git.
- `main` завжди робочий.
- Формат результату і назви колонок не міняємо без погодження з командою.
