# models: бібліотека `forestrecovery`

Власниця: Софія.

- `feature_spec()`: точна специфікація ознак (назви, одиниці, вікна дат).
- `input_report()`: перевірка входу перед моделлю.
- Модель стану: `stage`, `p_forest_gt5`, `recovery`.
- Модель прогнозу: крива росту за віком пожежі.

Вхід і вихід описано в `docs/model.md` і в `backend/pipeline/contract.py`.

```bash
pip install -e models
```
