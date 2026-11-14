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
