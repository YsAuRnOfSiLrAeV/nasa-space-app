import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BundleIndexSchema, loadBundleV2 } from '@/data/bundleV2';
import { spatialValues, SPATIAL_LAYERS, SPATIAL_LAYER_IDS } from '@/domain/fire/spatialLayers';
import { SpatialLegend } from './SpatialLegend';
import { SpatialCellReadout } from './SpatialCellReadout';
import { SpatialLayerPicker } from './SpatialLayerPicker';
import { pickGridTarget } from '@/domain/fire/gridPicking';

const root = resolve(import.meta.dirname, '../../../public/data/bundle-v2');
const read = async (path: string): Promise<unknown> =>
  JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const catalog = BundleIndexSchema.parse(await read('index.json'));
const load = (id: string) =>
  loadBundleV2(
    '',
    catalog.fires.find((entry) => entry.id === id)!,
    catalog.summer,
    (url) => read(url.slice(1)),
  );

describe('scientific spatial layers', () => {
  it.each(catalog.fires.filter((entry) => entry.files.includes('cells.json')))(
    'maps $id into its four original scientific values',
    async (entry) => {
      const data = await load(entry.id);
      for (const layer of SPATIAL_LAYER_IDS) {
        const map = spatialValues(data, layer);
        expect(map.values).toHaveLength(data.bundle!.cells.length);
        for (const i of [0, Math.floor(map.values.length / 2), map.values.length - 1]) {
          const value = data.bundle!.cells[i]![SPATIAL_LAYERS[layer].field];
          expect(map.values[i]).toBe(
            value === null ? null : layer === 'recovery' ? value * 100 : value,
          );
        }
        expect(
          map.normalized.every((value) => value === null || (value >= 0 && value <= 100)),
        ).toBe(true);
      }
    },
  );
  it('preserves zero, negative NDVI and null values; normalization is display-only', async () => {
    const data = await load('bc_2003_490');
    data.bundle = {
      ...data.bundle!,
      cells: data.bundle!.cells.slice(0, 3).map((cell, i) => ({
        ...cell,
        ndvi: [-1, 0, 1][i]!,
        height_m: [0, null, 20][i]!,
        p_forest_gt5: [0, null, 1][i]!,
      })),
    };
    expect(spatialValues(data, 'ndvi').values).toEqual([-1, 0, 1]);
    expect(spatialValues(data, 'ndvi').normalized).toEqual([0, 50, 100]);
    expect(spatialValues(data, 'height').values).toEqual([0, null, 20]);
    expect(spatialValues(data, 'height').normalized).toEqual([0, null, 100]);
    expect(spatialValues(data, 'score').values).toEqual([0, null, 1]);
  });
  it('uses the supplied timeline year and never substitutes the source summer for an absent year', async () => {
    const data = await load('bc_2003_490');
    const timeline = data.bundle!.timeline!;
    expect(spatialValues(data, 'height', 2040).values).toEqual(
      timeline.recovery_pct[timeline.years.indexOf(2040)],
    );
    expect(spatialValues(data, 'height', 1800).values.every((value) => value === null)).toBe(true);
    expect(spatialValues(data, 'height').values).toEqual(
      data.bundle!.cells.map((cell) => cell.height_m),
    );
  });
  it('shows source cell values, units and provenance and keeps GEDI measured height separate', async () => {
    const data = await load('bc_2003_490');
    const cell = data.bundle!.cells[812]!;
    const html = renderToStaticMarkup(
      <SpatialCellReadout
        data={data}
        index={cell.row * data.result.map_grid.columns + cell.col}
        year={2040}
      />,
    );
    expect(html).toContain('Cell 812');
    expect(html).toContain('source summer');
    expect(html).toContain('Modeled canopy height');
    expect(html).toContain(`${cell.height_m} m`);
    expect(html).toContain('NDVI');
    expect(html).toContain('not calibrated probability');
    expect(html).toContain('cells.json');
    expect(html).toContain('recovery_pct[37][812]');
    expect(pickGridTarget(data, 'probability', null, 0)).toMatchObject({
      kind: 'gedi',
      heightM: data.result.lidar_points[0]!.height_m,
    });
  });
  it('updates metric units and displays only visible overlays in the legend', async () => {
    const data = await load('quebec_2010_557');
    for (const layer of SPATIAL_LAYER_IDS) {
      const html = renderToStaticMarkup(
        <SpatialLegend
          data={data}
          layer={layer}
          visible
          overlays={{ perimeter: true, optical: false, gedi: true, zone: false }}
        />,
      );
      expect(html).toContain(SPATIAL_LAYERS[layer].label);
      expect(html).toContain(SPATIAL_LAYERS[layer].unit);
      expect(html).toContain('GEDI points');
      expect(html).not.toContain('RGB');
    }
    const html = renderToStaticMarkup(
      <SpatialLegend
        data={data}
        layer="height"
        visible={false}
        overlays={{ perimeter: false, optical: true, gedi: false, zone: false }}
      />,
    );
    expect(html).toContain('Recovery cells hidden');
    expect(html).not.toContain('GEDI points');
    expect(html).toContain('RGB');
  });
  it('disables scalar controls for a perimeter-only fire', async () => {
    const data = await load('bc_1987_111');
    const html = renderToStaticMarkup(
      <SpatialLayerPicker data={data} layer="score" onLayer={() => {}} />,
    );
    expect([...html.matchAll(/<input[^>]*>/g)]).toHaveLength(4);
    expect([...html.matchAll(/<input[^>]*>/g)].every(([input]) => input.includes('disabled'))).toBe(
      true,
    );
  });
});
