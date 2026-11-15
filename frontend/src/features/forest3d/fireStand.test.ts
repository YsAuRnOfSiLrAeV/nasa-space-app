import { describe, expect, it } from 'vitest';
import { burnShapeFromPerimeter, createBurnMask } from './burn';
import { growHeights } from './growth';
import { createHeightField } from './heightField';
import { standForFire, seedFromId } from './fireStand';
import { REFERENCE_GROWTH, growthFromRecovery } from './recoveryAdapter';
import { scatterPlants } from './scatter';

/** A 20 km × 10 km rectangle with a 2 km square unburned island, near 51°N. */
const lat = 51;
const kmLon = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));
const kmLat = 1 / 110.57;
const rect = (x0: number, x1: number, z0: number, z1: number) =>
  [
    [x0 * kmLon, z0 * kmLat],
    [x1 * kmLon, z0 * kmLat],
    [x1 * kmLon, z1 * kmLat],
    [x0 * kmLon, z1 * kmLat],
    [x0 * kmLon, z0 * kmLat],
  ].map(([lon, la]) => [-116 + lon!, lat + la!]);
const perimeter = {
  type: 'Polygon' as const,
  coordinates: [rect(0, 20, 0, 10), rect(9, 11, 4, 6).reverse()],
};

describe('burn shape', () => {
  const shape = burnShapeFromPerimeter(perimeter, 120)!;

  it('keeps a closed ring through simplification and fits the block', () => {
    expect(shape.polygons).toHaveLength(1);
    expect(shape.polygons[0]![0]!.length).toBeGreaterThanOrEqual(4);
    expect(shape.widthKm).toBeCloseTo(20, 0);
    expect(shape.heightKm).toBeCloseTo(10, 0);
    // The block is big enough to hold the whole burn, with room at the edges.
    const half = shape.blockSize / 2;
    expect(shape.blockSize).toBeGreaterThanOrEqual(120);
    for (const [x, z] of shape.polygons.flatMap((p) => p[0]!)) {
      expect(Math.abs(x)).toBeLessThan(half);
      expect(Math.abs(z)).toBeLessThan(half);
    }
    expect(shape.blockKm).toBeGreaterThan(20);
  });

  it('is inside the burn, outside it, and outside its unburned islands', () => {
    const inside = createBurnMask(shape);
    expect(inside(-30, 0)).toBe(true);
    expect(inside(0, 0)).toBe(false); // the unburned island, at the burn's centre of mass
    expect(inside(0, shape.blockSize / 2 - 1)).toBe(false); // beyond the burn's edge
  });

  it('never grows the block beyond its cap, shrinking a very long fire instead', () => {
    const long = {
      type: 'Polygon' as const,
      coordinates: [rect(0, 300, 0, 4)],
    };
    const capped = burnShapeFromPerimeter(long, 120)!;
    expect(capped.blockSize).toBe(240);
    for (const [x] of capped.polygons[0]![0]!) expect(Math.abs(x)).toBeLessThan(120);
  });

  it('is north-up: more northerly land has a smaller z', () => {
    const [north] = [
      burnShapeFromPerimeter({ type: 'Polygon', coordinates: [rect(0, 5, 0, 10)] }, 100)!,
    ];
    const zs = north.polygons[0]![0]!.map((p) => p[1]);
    expect(Math.min(...zs)).toBeLessThan(0);
  });

  it('returns null without a usable outline', () => {
    expect(burnShapeFromPerimeter(null, 120)).toBeNull();
    expect(
      burnShapeFromPerimeter(
        {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0, 0],
              [0, 0],
              [0, 0],
            ],
          ],
        },
        120,
      ),
    ).toBeNull();
  });
});

describe('a stand for one fire', () => {
  const input = { id: 'bc_2003_490', region: 'bc', referenceHeightM: 14, perimeter };

  it('gives every fire its own landscape, the same one each time', () => {
    expect(standForFire(input)).toEqual(standForFire(input));
    expect(seedFromId('bc_2003_490')).not.toBe(seedFromId('bc_2003_491'));
    expect(standForFire({ ...input, id: 'ontario_1988_21' }).terrain!.variant).not.toBe(
      standForFire(input).terrain!.variant,
    );
  });

  it('scales trees by the neighbouring forest height, within limits', () => {
    expect(standForFire(input).heightScale).toBeCloseTo(14 / 18, 6);
    expect(standForFire({ ...input, referenceHeightM: 3 }).heightScale).toBe(0.5);
    expect(standForFire({ ...input, referenceHeightM: 60 }).heightScale).toBe(1.2);
    expect(standForFire({ ...input, referenceHeightM: null }).heightScale).toBe(1);
  });

  it('takes relief and species from the region, and has no burn without a perimeter', () => {
    expect(standForFire(input).terrain!.relief).toBeGreaterThan(
      standForFire({ ...input, region: 'ontario' }).terrain!.relief,
    );
    expect(standForFire({ ...input, perimeter: null }).burn).toBeUndefined();
  });
});

describe('burned and unburned forest', () => {
  const stand = standForFire({
    id: 'x_2000_1',
    region: 'ontario',
    referenceHeightM: 18,
    perimeter,
  });
  const field = createHeightField({ size: 120, seed: stand.seed % 1000, relief: 9, variant: 0.3 });
  const plants = scatterPlants(field, stand);
  const early = growHeights(plants, growthFromRecovery({ recoveryShare: 0.1, ageYears: 3 }));

  it('has no fire-killed trunks outside the burn', () => {
    expect(plants.some((p) => p.burned && p.kind === 'snag')).toBe(true);
    expect(plants.some((p) => !p.burned && p.kind === 'snag')).toBe(false);
  });

  it('keeps unburned trees at mature height whatever the recovery', () => {
    const outside = plants.filter((p) => !p.burned && p.kind !== 'shrub');
    expect(outside.length).toBeGreaterThan(50);
    outside.forEach((p) => expect(early[plants.indexOf(p)]).toBeCloseTo(p.height, 5));
    const inside = plants.filter((p) => p.burned && p.kind !== 'shrub' && p.kind !== 'snag');
    expect(inside.some((p) => early[plants.indexOf(p)]! < p.height * 0.5)).toBe(true);
  });

  it('draws the whole block as burn when there is no shape (the original behaviour)', () => {
    const plain = scatterPlants(createHeightField({ size: 120, seed: 5 }), {
      ...stand,
      burn: undefined,
    });
    expect(plain.every((p) => p.burned)).toBe(true);
    expect(growHeights(plain, REFERENCE_GROWTH).length).toBe(plain.length);
  });
});
