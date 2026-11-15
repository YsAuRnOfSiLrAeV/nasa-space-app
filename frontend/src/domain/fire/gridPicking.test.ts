import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { FireCellsSchema, FireIndexSchema, FireResultSchema } from '@/data/fireSchema';
import { cellCentre, describeCell, gediBand } from './fireGrid';
import { pickGridTarget } from './gridPicking';

const root = resolve(import.meta.dirname, '../../../public/data/demo');
const json = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
for (const entry of FireIndexSchema.parse(json('index.json'))) {
  it(`picks cell centres and preserves categorical descriptions: ${entry.id}`, () => {
    const result = FireResultSchema.parse(json(entry.result));
    const cells = FireCellsSchema.parse(
      json(resolve(root, entry.result, '..', result.files.cells)),
    );
    const data = { result, cells, opticalImageUrl: null };
    for (const index of [
      0,
      Math.floor(cells.model.stage.length / 2),
      cells.model.stage.length - 1,
    ]) {
      expect(pickGridTarget(data, 'stage', cellCentre(result.map_grid, index), null)).toEqual({
        kind: 'cell',
        cell: describeCell(data, 'stage', index),
      });
    }
    expect(pickGridTarget(data, 'stage', [0, 0], null)).toBeNull();
    expect(pickGridTarget(data, 'stage', null, null)).toBeNull();
    expect(pickGridTarget(data, 'stage', cellCentre(result.map_grid, 0), 99999)).toBeNull();
    if (result.lidar_points[0])
      expect(pickGridTarget(data, 'stage', cellCentre(result.map_grid, 0), 0)).toEqual({
        kind: 'gedi',
        band: gediBand(result.lidar_points[0].height_m),
      });
  });
}
