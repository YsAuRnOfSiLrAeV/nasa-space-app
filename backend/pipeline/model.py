"""Run the forestrecovery state model on the feature table. Owner: Yaroslav.

Order: forestrecovery.input_report() first, then the model.
Output per cell: stage (0: <5 m, 1: 5-10 m, 2: >10 m), p_forest_gt5, recovery (%).
"""

from __future__ import annotations


def run_model(table: dict, reference_height: float) -> dict:
    raise NotImplementedError
