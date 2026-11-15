"""State model inputs on synthetic maps."""
import numpy as np
import pytest

from pipeline.contract import FEATURE_COLUMNS, NDVI, NISAR_HV, S1_VH, S1_VV
from pipeline.cell_features import FEATURES, build_table, input_report

SHAPE = (4, 5)


def layers():
    """Each feature has its own constant, so columns can be told apart. One NaN per layer in different cells."""
    out = {}
    for i, name in enumerate(FEATURES):
        layer = np.full(SHAPE, float(i + 1), dtype=np.float32)
        layer[i % SHAPE[0], i] = np.nan
        out[name] = layer
    return out


def test_columns_follow_the_feature_order():
    table = build_table(layers())
    assert table.names == tuple(FEATURE_COLUMNS)
    assert np.all(table.values == np.arange(1, 6, dtype=np.float32))


def test_cells_with_any_missing_feature_are_left_out():
    table = build_table(layers())
    assert len(table) == SHAPE[0] * SHAPE[1] - len(FEATURES)
    assert np.isfinite(table.values).all()


def test_where_limits_the_cells():
    where = np.zeros(SHAPE, dtype=bool)
    where[3, 4] = True
    table = build_table(layers(), where=where)
    assert len(table) == 1 and (table.rows[0], table.cols[0]) == (3, 4)


def test_to_grid_puts_values_back_in_their_cells():
    table = build_table(layers())
    grid = table.to_grid(table.rows * 10 + table.cols)
    rows, cols = np.indices(SHAPE)
    present = np.isfinite(grid)
    assert present.sum() == len(table)
    assert np.all(grid[present] == (rows * 10 + cols)[present])


def test_to_grid_rejects_wrong_length():
    table = build_table(layers())
    with pytest.raises(ValueError, match="expected"):
        table.to_grid(np.zeros(3))


def test_missing_or_misaligned_layers_are_reported():
    broken = layers()
    del broken[NDVI]
    with pytest.raises(KeyError, match="NDVI"):
        build_table(broken)
    broken = layers()
    broken[S1_VV] = np.zeros((2, 2))
    with pytest.raises(ValueError, match="s1_VV"):
        build_table(broken)


def test_input_report_counts_values_outside_training_range():
    table = build_table(layers())
    report = input_report(table, {NISAR_HV: (0.0, 0.5), NDVI: (0.0, 10.0)})
    assert report[NISAR_HV]["outside_share"] == 1.0
    assert report[NDVI]["outside_share"] == 0.0
    assert report[S1_VH]["outside_share"] is None
    assert report[S1_VH]["median"] == 3.0
