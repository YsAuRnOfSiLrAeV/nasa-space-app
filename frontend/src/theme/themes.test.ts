import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, REQUIRED_THEME_VARS, THEMES, THEME_STORAGE_KEY } from './themes';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

/** Custom properties declared inside `:root[data-theme='<id>'] { … }`. */
function declaredVars(css: string, id: string): string[] {
  const block = new RegExp(String.raw`:root\[data-theme='${id}'\]\s*\{([\s\S]*?)\n\}`).exec(css);
  if (!block) return [];
  return [...block[1]!.matchAll(/^\s*--([\w-]+)\s*:/gm)].map((m) => m[1]!);
}

describe('theme architecture', () => {
  const entry = read('src/styles/index.css');

  it.each(THEMES.map((t) => t.id))('%s: has its own file, imported by the entry', (id) => {
    expect(entry).toContain(`@import './themes/${id}.css';`);
    expect(declaredVars(read(`src/styles/themes/${id}.css`), id).length).toBeGreaterThan(0);
  });

  it.each(THEMES.map((t) => t.id))('%s: defines exactly the shared semantic variables', (id) => {
    const vars = declaredVars(read(`src/styles/themes/${id}.css`), id);
    const required = [...REQUIRED_THEME_VARS];
    expect(
      required.filter((v) => !vars.includes(v)),
      'missing',
    ).toEqual([]);
    expect(
      vars.filter((v) => !required.includes(v as never)),
      'not in REQUIRED_THEME_VARS',
    ).toEqual([]);
    expect(new Set(vars).size, 'duplicates').toBe(vars.length);
  });

  it('keeps colors out of the shared stylesheets', () => {
    for (const file of ['src/styles/tokens.css', 'src/styles/global.css']) {
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css, file).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it('keeps the no-flash bootstrap in index.html in sync with the registry', () => {
    const html = read('index.html');
    const modes = /var THEME_MODES = (\{[\s\S]*?\});/.exec(html)?.[1];
    expect(modes).toBeDefined();
    const parsed = Object.fromEntries(
      [...modes!.matchAll(/'?([\w-]+)'?\s*:\s*'(dark|light)'/g)].map((m) => [m[1], m[2]]),
    );
    expect(parsed).toEqual(Object.fromEntries(THEMES.map((t) => [t.id, t.mode])));
    expect(html).toContain(`var id = '${DEFAULT_THEME}';`);
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
    expect(html).toContain(`data-theme="${DEFAULT_THEME}"`);
  });
});
