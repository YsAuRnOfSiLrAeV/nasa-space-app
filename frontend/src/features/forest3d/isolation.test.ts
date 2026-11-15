/**
 * The 3D forest is optional: the app must keep working if it is deleted. This
 * checks the import graph that promise depends on.
 *   - Only the forest page imports the feature.
 *   - Only App imports the page, and only lazily (Three.js stays out of the main bundle).
 *   - The feature imports nothing from the explorer, the map or other pages.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
const files = walk(SRC).map((path) => ({
  path: relative(SRC, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));
const production = files.filter((f) => !/\.test\.tsx?$/.test(f.path));
const imports = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]!);

describe('3D forest isolation', () => {
  it('is imported only by its own page', () => {
    const users = production.filter(
      (f) =>
        !f.path.startsWith('features/forest3d/') &&
        imports(f.text).some((spec) => spec.includes('features/forest3d')),
    );
    expect(users.map((f) => f.path)).toEqual(['pages/forest3d/ForestGrowthExplorer.tsx']);
  });

  it('has its page loaded lazily, by App only', () => {
    const users = production.filter(
      (f) =>
        !f.path.startsWith('pages/forest3d/') &&
        imports(f.text).some((spec) => spec.includes('pages/forest3d')),
    );
    expect(users.map((f) => f.path)).toEqual(['app/App.tsx']);
    const app = users[0]!.text;
    expect(app).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]@\/pages\/forest3d\/Forest3DPage['"]\)/);
    expect(app).not.toMatch(/^import[^;]*pages\/forest3d/m);
  });

  it('depends on nothing in the explorer, the map or other pages', () => {
    const forbidden = /(compositions|components\/map|components\/fire|pages\/(?!forest3d))/;
    for (const f of production.filter(
      (f) => f.path.startsWith('features/forest3d/') || f.path.startsWith('pages/forest3d/'),
    ))
      for (const spec of imports(f.text))
        expect(spec, `${f.path} imports ${spec}`).not.toMatch(forbidden);
  });
});
