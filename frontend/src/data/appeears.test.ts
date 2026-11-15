import { describe, expect, it } from 'vitest';
import {
  appeearsRequest,
  importAppEEARS,
  AppEEARSProgressSchema,
  type AppEEARSSelection,
} from './appeears';
import { RecoveryFileSchema } from './recoverySchema';

const selection: AppEEARSSelection = {
  group_id: 'test',
  fire_year: 2002,
  years: [2001, 2004],
  bbox: [-94, 51, -93, 52],
  reference_radius_km: 40,
  coordinates: [
    { id: 'burned-a', category: 'burned', latitude: 51.1, longitude: -93.5 },
    { id: 'burned-b', category: 'burned', latitude: 51.2, longitude: -93.6 },
    { id: 'reference', category: 'reference', latitude: 51.3, longitude: -93.7 },
  ],
};
const row = (id: string, date: string, value: string, quality = '0') => ({
  ID: id,
  Date: date,
  MOD13Q1_061__250m_16_days_NDVI: value,
  MOD13Q1_061__250m_16_days_pixel_reliability: quality,
});

describe('AppEEARS extraction and import', () => {
  it('reads live object progress, documented array progress and completion responses', () => {
    const progress = { summary: 28, details: [{ desc: 'Downloading', pct_complete: 24 }] };
    expect(AppEEARSProgressSchema.parse({ progress })).toEqual(progress);
    expect(AppEEARSProgressSchema.parse([{ progress }])).toEqual(progress);
    expect(AppEEARSProgressSchema.parse({ status: 'done' })).toBeUndefined();
  });
  it('requests summer NDVI and its quality layer with stable burned/reference ids', () => {
    const request = appeearsRequest(selection);
    expect(request.task_type).toBe('point');
    expect(request.params.dates).toEqual([
      { startDate: '07-01', endDate: '08-31', recurring: true, yearRange: [2001, 2004] },
    ]);
    expect(request.params.layers.map((layer) => layer.layer)).toEqual([
      '_250m_16_days_NDVI',
      '_250m_16_days_pixel_reliability',
    ]);
    expect(request.params.coordinates[0]).toMatchObject({ id: 'burned-a', category: 'burned' });
  });

  it('handles raw/scaled values explicitly and aggregates each point before the group', () => {
    const rows = [
      row('burned-a', '2003-07-01', '8000'),
      row('burned-a', '2003-07-17', '6000'),
      row('burned-b', '2003-07-01', '3000'),
      row('reference', '2003-07-01', '9000'),
    ];
    const file = RecoveryFileSchema.parse(importAppEEARS(rows, selection, 'raw'));
    expect(file.ndvi[2]!.burned?.median).toBeCloseTo(0.5);
    expect(file.ndvi[2]!.burned).toMatchObject({ n_points: 2, n_obs: 3 });
    expect(file.ndvi[2]!.reference?.median).toBeCloseTo(0.9);
    const scaled = importAppEEARS([row('burned-a', '07-01-2003', '0.8')], selection, 'scaled');
    expect(scaled.ndvi[2]!.burned?.median).toBeCloseTo(0.8);
    expect(scaled.source.access).toBe('NASA AppEEARS');
    expect(scaled.images).toEqual([]);
  });

  it('preserves gaps, distinguishes fill from rejected observations, and retains valid zero', () => {
    const file = importAppEEARS(
      [
        row('burned-a', '2001-07-01', '0'),
        row('burned-a', '2003-07-01', '7000', '1'),
        row('burned-b', '2003-07-01', '-3000'),
        row('reference', '2003-07-01', ''),
        row('burned-a', '2004-06-01', '9000'),
      ],
      selection,
      'raw',
    );
    expect(file.ndvi[0]!.burned?.median).toBe(0);
    expect(file.ndvi[1]!.burned).toBeNull();
    expect(file.ndvi[2]!.burned).toBeNull();
    expect(file.ndvi[2]!.quality).toEqual({ accepted: 0, rejected: 1, missing: 2 });
    expect(file.ndvi[3]!.burned).toBeNull();
  });

  it('rejects incorrect ids, duplicate observations and ambiguous headers', () => {
    expect(() => importAppEEARS([row('other', '2003-07-01', '8000')], selection, 'raw')).toThrow(
      'not in the saved request',
    );
    const duplicate = row('burned-a', '2003-07-01', '8000');
    expect(() => importAppEEARS([duplicate, duplicate], selection, 'raw')).toThrow('Duplicate');
    expect(() =>
      importAppEEARS([{ ID: 'burned-a', Date: '2003-07-01' }], selection, 'raw'),
    ).toThrow('column');
  });

  it('rejects impossible dates and completely unusable exports', () => {
    expect(() => importAppEEARS([row('burned-a', '2003-02-31', '8000')], selection, 'raw')).toThrow(
      'Invalid AppEEARS date',
    );
    expect(() =>
      importAppEEARS([row('burned-a', '2003-07-01', '8000', '3')], selection, 'raw'),
    ).toThrow('No summer NDVI');
  });
});
