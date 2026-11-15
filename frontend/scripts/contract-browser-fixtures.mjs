import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const source = resolve(import.meta.dirname, '../public/data/demo');
const folder = mkdtempSync(join(tmpdir(), 'fire-contract-browser-'));
const entry = JSON.parse(readFileSync(join(source, 'index.json'), 'utf8'))[0];
const original = JSON.parse(readFileSync(join(source, entry.result), 'utf8'));
const cells = JSON.parse(readFileSync(join(source, entry.result, '..', 'cells.json'), 'utf8'));
const index = [];
for (const kind of ['complete', 'omitted']) {
  const id = `contract_${kind}`;
  const result = structuredClone(original);
  result.fire.id = id;
  result.fire.name = { en: `Contract test (${kind})`, uk: '' };
  result.warnings = ['DEVELOPMENT_FIXTURE'];
  result.files.optical_image = null;
  const target = join(folder, id);
  mkdirSync(target);
  writeFileSync(join(target, 'result.json'), JSON.stringify(result));
  writeFileSync(
    join(target, 'cells.json'),
    JSON.stringify(kind === 'complete' ? cells : { map: { zone: cells.map.zone } }),
  );
  index.push({ ...entry, id, name: result.fire.name, result: `${id}/result.json` });
}
writeFileSync(join(folder, 'index.json'), JSON.stringify(index));
console.log(folder);
