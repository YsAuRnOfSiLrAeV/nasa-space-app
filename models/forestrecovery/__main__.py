"""python -m forestrecovery            перевірка установки (версія, дані, один швидкий розрахунок)
python -m forestrecovery list         каталог пожеж: id, рік, площа, що є для кожної
python -m forestrecovery export OUT [fire_id ...] [--year 2026]
                                      набори файлів для фронту й пайплайна (усі пожежі або вказані) + OUT/index.json"""
import sys

from . import __version__, catalog, data_info, export_all, fire_bundle


def check():
    print(f"forestrecovery {__version__}")
    info = data_info()
    cat = catalog()
    print(f"дані всередині: {len(cat)} пожеж, {len(info['demo_fires'])} з повними растрами")
    b = fire_bundle("quebec_1995_1218")
    r = b["result"]
    m1, m2 = r["model1"], r["model2"]
    print(f"самоперевірка quebec_1995_1218: клітинок {m1['n']}, середня оцінка {m1['mean']}, зараз відновлено {round(100 * m2['now_recovery'])}%, "
          f"80% близько {m2['year_80pct']} року")
    if b["cells"]["cells"][0].get("lon") is None:
        print("УВАГА: pyproj не встановлено, клітинки без lon/lat (pip install pyproj)")
    print("Готово. Далі: INSTRUCTIONS.md, BUNDLE_FORMAT.md і quickstart.py")
    return 0


def list_fires_cli():
    print(f"{'id':32} {'рік':>5} {'га':>7}  {'растри':6} {'точки':5} прогноз")
    for o in catalog():
        print(f"{o['id']:32} {o['year']:>5} {o['area_ha']:>7.0f}  {'так' if o['has_grid'] else '-':6} {'так' if o['has_points'] else '-':5} {o['forecast']}")
    return 0


def export_cli(args):
    year, ids, out = 2026, [], None
    it = iter(args)
    for a in it:
        if a == "--year":
            year = int(next(it))
        elif out is None:
            out = a
        else:
            ids.append(a)
    if out is None:
        print("Використання: python -m forestrecovery export OUT [fire_id ...] [--year 2026]")
        return 2
    p = export_all(out, ids or None, year, progress=lambda i, n, f: print(f"[{i}/{n}] {f}"))
    print("Готово:", p)
    return 0


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if not a:
        return check()
    if a[0] == "list":
        return list_fires_cli()
    if a[0] == "export":
        return export_cli(a[1:])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
