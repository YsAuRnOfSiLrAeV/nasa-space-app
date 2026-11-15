import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_THEME_VARS, THEME_ID } from './themes';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

/** Custom properties declared inside `:root[data-theme='<id>'] { … }`. */
function declaredVars(css: string): string[] {
  const block = new RegExp(String.raw`:root\[data-theme='${THEME_ID}'\]\s*\{([\s\S]*?)\n\}`).exec(
    css,
  );
  if (!block) return [];
  return [...block[1]!.matchAll(/^\s*--([\w-]+)\s*:/gm)].map((m) => m[1]!);
}

describe('theme architecture', () => {
  const themeFile = `src/styles/themes/${THEME_ID}.css`;

  it('has its own file, imported by the entry', () => {
    expect(read('src/styles/index.css')).toContain(`@import './themes/${THEME_ID}.css';`);
    expect(declaredVars(read(themeFile)).length).toBeGreaterThan(0);
  });

  it('defines exactly the shared semantic variables', () => {
    const vars = declaredVars(read(themeFile));
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

  it('initializes the fixed theme before JavaScript loads', () => {
    const html = read('index.html');
    expect(html).toContain(`data-theme="${THEME_ID}"`);
    expect(html).toContain('class="dark"');
    expect(html).toContain('color-scheme: dark');
  });
});
