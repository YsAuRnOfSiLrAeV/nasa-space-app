# Набір файлів пожежі (bundle_format 2)

Для фронту (Каті), пайплайна (Ярослав, Міша) і будь-кого, кому треба взяти цифри й картинку пожежі, не лізучи в растри.

## Як отримати

```bash
python -m forestrecovery list                              # які пожежі є і що є для кожної
python -m forestrecovery export out/                       # усі 80 пожеж + out/index.json + out/viewer.html (≈ 40 МБ)
python -m forestrecovery export out/ quebec_1995_1218      # одна або кілька
cd out && python -m http.server 8000                       # далі відкрити http://localhost:8000/viewer.html
```

З Python:

```python
from forestrecovery import catalog, fire_bundle, write_fire_bundle, export_all
b = fire_bundle("quebec_1995_1218")        # усе в пам'яті: словник
write_fire_bundle("quebec_1995_1218", "out/")
export_all("out/")                         # усе, плюс index.json і viewer.html
```

`viewer.html` це готовий приклад на MapLibre GL: фото, клітинки з вибором кольору, GEDI, контур, повзунок років. Код короткий, його можна брати за основу.

## Що лежить у `out/fire_<id>/summer_2026/`

Які саме файли є для пожежі, написано в `manifest.json` (ключ `files`) і в `index.json`. Чого немає, того файлу немає.

| файл | що це | є коли |
|---|---|---|
| `manifest.json` | список файлів із роллю, `bundle_format`, версія бібліотеки | завжди |
| `result.json` | цифри для панелі: модель 1, модель 2 з інтервалом, надійність, довідкова висота, параметри картинки | завжди |
| `polygon.geojson` | контур пожежі (Feature) | для всіх 80 |
| `cells.json` | клітинки 360 м: оцінка, відновлення, висота, NDVI; GEDI | є растри (37 пожеж) |
| `cells.geojson` | ті самі клітинки як квадрати в lon/lat, **кидати на карту як шар `fill`** | є растри |
| `gedi.geojson` | виміри висоти GEDI (rh98, м) як точки | є растри |
| `rgb.png` | Sentinel-2 у справжніх кольорах, прозорий поза сценою | є растри |
| `timeline.json` | відновлення кожної клітинки по роках | пожежі Канади з растрами (20) |

У корені експорту ще `confidence_zones.geojson` (див. нижче) і `viewer.html`. `index.json`: усі пожежі з `dir`, `files` і ключовими цифрами (`model1_mean`, `recovery_now`, `year_80pct`, `excluded_share`).

## Поля

**`cells.json`** → `cells[]` (порядок = номер `i` у `cells.geojson` і колонка в `timeline.json`):

| поле | значення |
|---|---|
| `row`, `col` | індекс клітинки в сітці растра |
| `x`, `y` | центр клітинки, метри в `crs_source` (проєкція растра) |
| `lon`, `lat` | центр, WGS84 |
| `p_forest_gt5` | модель 1: оцінка «ліс вищий за 5 м», 0..1. **Для ранжування, не калібрована ймовірність** |
| `recovery` | відновлення зараз: частка висоти сусіднього лісу, 0..1 (може трохи перевищувати 1) |
| `height_m` | `recovery × reference_height_m`: **модельна** висота, не виміряна |
| `ndvi` | Sentinel-2 NDVI, середнє по клітинці |

Решта `cells.json`: `cell_m` (360), `crs_source`, `rot_deg`, `reference_height_m`, `reference_source`, `fields` (ці описи), `gedi[]` (`lon`, `lat`, `rh98_m`).

**`result.json`**:
- `model1`: `mean`, `share_gt_0_5`, `n`, `excluded_share` (частка згарища, що не потрапила в цифри: пікселі поза діапазоном навчання, дуже темні й голі; цифри через це трохи оптимістичні).
- `model2`: `forecast` (`growth` лише для Канади, інакше `none` і `reason`), `now_recovery`, `interval_80`, `year_80pct`, `series` (`years`, `recovery`, `low`, `high`).
- `reference`: `height_m` і `source`. Для савани еталона немає, там береться 75-й процентиль висоти незгорілого лісу в кадрі (`scene_p75_unburned_forest`): **це не перевірений еталон**, відсоток відновлення в савані слід показувати з цією приміткою.
- `image`: `file`, `width`, `height`, `corners_lonlat`.
- `reliability`: тексти про надійність, їх краще показувати поруч із цифрами.

**`timeline.json`**: `years`, `recovery_pct[рік][клітинка]` (цілі відсотки, 0..130, `null` = немає даних), `ref_height_m`. Висота = `recovery_pct / 100 × ref_height_m`. Це піксельна екстраполяція від стану зараз, та сама анімація, що в глобусі. Крива пожежі з 80% інтервалом лежить у `result.json → model2`. Два числа відрізняються на кілька відсотків (приклад: 0,86 у клітинках і 0,84 у кривій), бо це різні методи, а не помилка.

## Зони впевненості: `confidence_zones.geojson`

Лежить у корені експорту (`export_all`), з Python: `forestrecovery.confidence_zones()`. Один FeatureCollection, кожна ділянка має `properties.layer`:

| `layer` | що показує | поля |
|---|---|---|
| `model1_region` | де працює модель 1 (стан зараз). Три регіони: `continental`, `mediterranean`, `savanna` | `region`, `tier`, `status`, `reliability`, `color`, `opacity`, `name_uk`, `name_en` |
| `model2_growth` | де підтверджена крива росту (прогноз у роках): лише Канада | `status`, `name_uk`, `name_en` |
| `model2_scenario` | де працює сценарій «від сили пожежі»: лише Україна | `status`, `name_uk`, `name_en` |

`tier` 1 / `status = verified`: ми там перевіряли модель. `tier` 2 / `extrapolated`: той самий тип лісу, напряму не перевірено (на карті світліше, `opacity` 0,25 проти 0,55). `reliability` це найгірша країна регіону: `good` (AUC від 0,70), `moderate` (0,62-0,70), `low`. Поза всіма ділянками ми нічого не стверджуємо. Координати округлені до ~100 м, весь файл ≈ 0,6 МБ.

```js
map.addSource('zones', {type: 'geojson', data: 'confidence_zones.geojson'});
map.addLayer({id: 'zones', type: 'fill', source: 'zones', filter: ['==', ['get', 'layer'], 'model1_region'],
  paint: {'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity']}});
```

Увімкнути в `viewer.html` можна галочкою «зони».

## Картинка на карті

Растр повернутий відносно півночі (проєкція EPSG:3347 у Канаді, 3035 в Європі), тому його кладуть за чотирма кутами, а не за прямокутником. Кути в `result.image.corners_lonlat`, порядок: лівий верхній, правий верхній, правий нижній, лівий нижній.

MapLibre / Mapbox GL (підтримують це напряму):

```js
map.addSource('rgb', {type: 'image', url: 'fire_x/summer_2026/rgb.png', coordinates: result.image.corners_lonlat});
map.addLayer({id: 'rgb', type: 'raster', source: 'rgb'});
map.addSource('cells', {type: 'geojson', data: 'fire_x/summer_2026/cells.geojson'});
map.addLayer({id: 'cells', type: 'fill', source: 'cells', paint: {
  'fill-color': ['interpolate', ['linear'], ['get', 'recovery'], 0, '#d73027', .5, '#fee08b', 1, '#1a9850'], 'fill-opacity': .7}});
```

Leaflet `ImageOverlay` приймає лише прямокутник, для повернутого растра потрібен плагін (наприклад `leaflet-imageoverlay-rotated`). Клітинки з `cells.geojson` у Leaflet працюють без нього.

Рік зі `timeline.json`: для кожного `feature.properties.i` взяти `recovery_pct[k][i] / 100` і оновити джерело (див. `showYear` у `viewer.html`).

## pandas

```python
import json, pandas as pd
c = json.load(open("out/fire_quebec_1995_1218/summer_2026/cells.json"))
df = pd.DataFrame(c["cells"])            # row, col, x, y, lon, lat, p_forest_gt5, recovery, height_m, ndvi
```

## Пайплайн

`export_all(out)` і читання `index.json` достатньо. Для кожної пожежі `index.json` дає шляхи, а `manifest.json` каже, які файли є. Версія формату в `bundle_format` (зараз 2), версія бібліотеки в `library_version`.

## Чесні обмеження

- Прогноз у роках лише для Канади. Для Європи, савани і США `model2.forecast == "none"`, `timeline.json` немає, є стан зараз.
- Оцінка моделі 1 для ранжування. Підсумок по всій пожежі надійніший за одну клітинку.
- Висота модельна. Виміряна висота це тільки точки GEDI.
- Більшість демо-пожеж моделі бачили під час навчання (виняток: 9 «серединних» пожеж Канади). Тому карти пожеж не доводять точності; чесна перевірка це перенос між країнами й регіонами та незалежний тест моделі 2 (див. `CALIBRATION_STATUS.md`).
- Пожежа без `rgb.png` і клітинок (лише точки GEDI або лише контур) має тільки `result.json` і `polygon.geojson`.
