"""Run the pipeline for many fires, one after another: the demo fires of the model library.

    python -m pipeline.batch --summer 2026 --out ../data/demo                      every demo fire
    python -m pipeline.batch --summer 2026 --out ../data/demo --ids bc_2003_490    some of them

Fires that already have a result.json in --out are skipped, so a stopped batch continues where
it stopped. A fire that fails is reported and the batch goes on with the next one.
"""
from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path


from . import model
from .run import Fire, run

log = logging.getLogger(__name__)

# The fires on the main page come first.
MAIN_FIRES = ("bc_2003_490", "quebec_1995_1218", "quebec_2010_557", "ontario_1988_21")


def library_fires(ids: list[str] | None = None) -> list[Fire]:
    """Demo fires of the model library as pipeline fires, the main page fires first."""
    fires = [
        Fire(id=d["id"], name={"en": d["name"]}, year=d["year"], perimeter=d["geometry"], area_ha=d["area_ha"])
        for d in model.demo_fires(ids)
    ]
    first = {fire_id: i for i, fire_id in enumerate(MAIN_FIRES)}
    return sorted(fires, key=lambda f: first.get(f.id, len(first)))


def run_many(fires: list[Fire], summer: int, out_dir: Path | str) -> dict[str, str]:
    """Run every fire, skipping those already done. Returns {fire id: "done" | "skipped" | error text}."""
    out = Path(out_dir)
    status = {}
    for number, fire in enumerate(fires, start=1):
        label = f"[{number}/{len(fires)}] {fire.id}"
        if (out / fire.id / "result.json").exists():
            status[fire.id] = "skipped"
            print(f"{label}: already done", flush=True)
            continue
        started = time.time()
        try:
            run(fire, summer, out, on_step=lambda step: print(f"{label}: {step}", flush=True))
        except Exception as error:  # one bad fire must not stop the batch
            status[fire.id] = f"{type(error).__name__}: {error}"
            print(f"{label}: FAILED {status[fire.id]}", flush=True)
            continue
        status[fire.id] = "done"
        print(f"{label}: done in {time.time() - started:.0f} s", flush=True)
    return status


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--summer", type=int, required=True, help="summer of the satellite images, e.g. 2026")
    p.add_argument("--out", required=True, help="folder for index.json and the fire folders")
    p.add_argument("--ids", nargs="*", help="demo fire ids (default: all, main page fires first)")
    args = p.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    fires = library_fires(args.ids)
    status = run_many(fires, args.summer, args.out)
    failed = {k: v for k, v in status.items() if v not in ("done", "skipped")}
    print(f"\n{sum(v == 'done' for v in status.values())} done, "
          f"{sum(v == 'skipped' for v in status.values())} skipped, {len(failed)} failed")
    for fire_id, error in failed.items():
        print(f"  {fire_id}: {error}")


if __name__ == "__main__":
    main()
