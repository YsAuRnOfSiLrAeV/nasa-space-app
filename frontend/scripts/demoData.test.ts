import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EXAMPLE_DEMO_DIR, demoFile, resolveDemoData } from './demoData';

const tmp = mkdtempSync(join(tmpdir(), 'demo-data-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('demo data source', () => {
  it('uses a folder with an index.json as team results', () => {
    const team = join(tmp, 'team');
    mkdirSync(team);
    writeFileSync(join(team, 'index.json'), '[]');
    expect(resolveDemoData({ FIRE_DEMO_DIR: team })).toEqual({ source: 'team', dir: team });
  });

  it('refuses an explicit folder without an index.json', () => {
    const empty = join(tmp, 'empty');
    mkdirSync(empty);
    expect(() => resolveDemoData({ FIRE_DEMO_DIR: empty })).toThrow(/no index\.json/);
  });

  it('falls back to the bundled example when the pipeline has written nothing', () => {
    const { source, dir } = resolveDemoData({});
    // The monorepo's data/demo holds only .gitkeep until the pipeline runs.
    if (source === 'example') expect(dir).toBe(EXAMPLE_DEMO_DIR);
    else expect(dir).toBe(resolve(EXAMPLE_DEMO_DIR, '../../../../data/demo'));
  });
});

describe('demo file mapping', () => {
  const dir = resolve(tmp, 'serve');
  it('maps request paths inside the folder', () => {
    expect(demoFile(dir, 'bc_2003_490/result.json')).toBe(resolve(dir, 'bc_2003_490/result.json'));
    expect(demoFile(dir, 'a%20b/cells.json')).toBe(resolve(dir, 'a b/cells.json'));
  });

  it('never leaves the folder', () => {
    expect(demoFile(dir, '../secret.json')).toBeNull();
    expect(demoFile(dir, '..%2f..%2f.env')).toBeNull();
    expect(demoFile(dir, '%2e%2e/x')).toBeNull();
    expect(demoFile(dir, '')).toBeNull();
    expect(demoFile(dir, 'bad%zz')).toBeNull();
    expect(demoFile(dir, 'a\0b')).toBeNull();
  });
});
