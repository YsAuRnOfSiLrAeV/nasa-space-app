# data

Тут лише невеликі файли. Великі растри й сирі знімки не в Git (`data/raw/`, `data/cache/` у `.gitignore`).

- `training/`: невеликі навчальні дані.
- `demo/`: заздалегідь пораховані демо-пожежі:
  ```
  demo/
    index.json            список демо-пожеж з підсумками для глобуса і карток
    <fire_id>/
      result.json
      cells.json
      optical.png
  ```
  Формат описано у вкладці 1 документа DELIVERABLES.

- `regions/`: екорегіони, де працює модель (RESOLVE Ecoregions 2017): `ecoregions_covered.geojson` (рівень A, перевірено) і `ecoregions_extended.geojson` (рівень B, екстраполяція). Їх читає API.
- `gfa/`: каталог пожеж Global Fire Atlas для API, файли `gfa_<рік>.parquet` (разом 400 МБ). **Не в Git: кожен кладе їх сюди сам.** Як зібрати з нуля, описано в `backend/README.md`, розділ "Fire catalog".
- `fires/`: результати, пораховані через API. Не в Git.
