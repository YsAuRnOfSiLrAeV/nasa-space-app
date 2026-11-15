"""Pipeline runs started from the API.

A run takes minutes (satellite downloads), so it happens in a background thread and the client
polls its state. One run at a time: the pipeline already downloads in parallel inside a run.
A fire that was computed before is answered from its files, without running again.
"""

from __future__ import annotations

import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable

from catalog.fires import Fire

log = logging.getLogger(__name__)

# Pipeline steps in order (pipeline.run.STEPS), with the text shown to the user.
STEPS = {
    "grid": "Laying out the fire grid",
    "data": "Downloading satellite data",
    "state": "Estimating forest height",
    "numbers": "Summarising the burn",
    "forecast": "Forecasting recovery",
    "files": "Writing the result",
}
QUEUED = "Waiting for the previous analysis to finish"

# Known reasons a run cannot be computed, by exception class name. Anything else is PIPELINE_FAILED.
FAILURES = {
    "OutOfDomainError": "OUT_OF_DOMAIN",
    "NisarUnavailable": "NISAR_UNAVAILABLE",
    "NoScenesError": "NO_SCENES",
    "ModuleNotFoundError": "NOT_CONFIGURED",
}

Compute = Callable[[Fire, int, Path, Callable[[str], None]], None]


@dataclass(frozen=True)
class Run:
    id: str
    fire_id: str
    summer: int
    status: str = "pending"  # pending | complete | failed
    step: str = QUEUED
    progress: float = 0.0
    code: str | None = None
    message: str | None = None


class Runs:
    def __init__(self, results_dir: Path, compute: Compute):
        self.results_dir = results_dir
        self.compute = compute
        self._runs: dict[str, Run] = {}
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pipeline")

    def start(self, fire: Fire, summer: int) -> Run:
        """Start computing the fire for the summer, or return the run that already does or did."""
        run_id = f"{fire.id}-{summer}"
        with self._lock:
            known = self.get(run_id)
            if known and known.status != "failed":
                return known
            run = Run(run_id, fire.id, summer)
            self._runs[run_id] = run
        self._pool.submit(self._work, fire, summer, run_id)
        return run

    def get(self, run_id: str) -> Run | None:
        """State of a run. A result on disk counts as a finished run, also after a restart."""
        run = self._runs.get(run_id)
        if run:
            return run
        fire_id, _, summer = run_id.rpartition("-")
        if summer.isdigit() and self._computed(fire_id, int(summer)):
            return Run(run_id, fire_id, int(summer), status="complete", step="", progress=1.0)
        return None

    def _computed(self, fire_id: str, summer: int) -> bool:
        path = self.results_dir / fire_id / "result.json"
        if not fire_id or not path.is_file():
            return False
        try:
            return json.loads(path.read_text(encoding="utf-8"))["satellite_images"]["summer"] == summer
        except (ValueError, KeyError, TypeError):
            return False

    def _work(self, fire: Fire, summer: int, run_id: str) -> None:
        names = list(STEPS)

        def on_step(name: str) -> None:
            progress = names.index(name) / len(names) if name in names else self._runs[run_id].progress
            self._update(run_id, step=STEPS.get(name, name), progress=round(progress, 2))

        try:
            self.compute(fire, summer, self.results_dir, on_step)
            self._update(run_id, status="complete", step="", progress=1.0)
        except Exception as error:  # every failure must reach the client as a failed run, not a hung one
            log.exception("run %s failed", run_id)
            code = FAILURES.get(type(error).__name__, "PIPELINE_FAILED")
            if isinstance(error, RuntimeError) and "not set" in str(error):
                code = "NOT_CONFIGURED"  # missing Earthdata or Earth Engine credentials
            self._update(run_id, status="failed", code=code, message=str(error) or type(error).__name__)

    def _update(self, run_id: str, **changes) -> None:
        with self._lock:
            self._runs[run_id] = replace(self._runs[run_id], **changes)
