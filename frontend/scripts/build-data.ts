/**
 * Convert NISAR point CSVs (from the GEE + Colab pipeline) into validated, map-ready data.
 *
 * Usage:
 *   npm run data                         # all data/raw/nisar_*.csv -> public/data/
 *   npm run data -- path/to/a.csv b.csv  # explicit inputs (files or directories)
 *   npm run data -- --out some/dir       # different output directory
 *   npm run data -- --check              # validate + fail if public/data is stale; writes nothing
 *
 * Outputs (deterministic: identical input -> byte-identical output):
 *   points.geojson  FeatureCollection<Point>, one feature per line
 *   manifest.json   counts, extent, source checksums
 *
 * Any invalid row aborts the run and nothing is written. We never silently drop or patch data.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import Papa from 'papaparse';
import {
  ManifestSchema,
  PointCollectionSchema,
  REQUIRED_COLUMNS,
  RawRowSchema,
  type Manifest,
  type PointCollection,
  type RawRow,
} from '../src/data/schema';
import { buildCollection, buildManifest } from '../src/data/transform';

const ROOT = resolve(import.meta.dirname, '..');
const MAX_REPORTED_ERRORS = 50;

/** Excel-saved CSVs often start with a byte-order mark; drop it so the first header matches. */
const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** Repo-relative path with forward slashes (stable across OSes for manifest + logs). */
const rel = (p: string) => relative(ROOT, p).replaceAll('\\', '/');

interface Args {
  inputs: string[];
  outDir: string;
  check: boolean;
}

function parseArgs(argv: string[]): Args {
  const inputs: string[] = [];
  let outDir = join(ROOT, 'public', 'data');
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--check') check = true;
    else if (a === '--out') {
      const v = argv[++i];
      if (!v) fail('--out needs a directory');
      outDir = resolve(v);
    } else if (a.startsWith('--')) fail(`Unknown option ${a}`);
    else inputs.push(resolve(a));
  }
  if (inputs.length === 0) inputs.push(join(ROOT, 'data', 'raw'));
  return { inputs, outDir, check };
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function resolveInputFiles(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    if (!existsSync(input)) fail(`Input not found: ${input}`);
    if (statSync(input).isDirectory()) {
      files.push(
        ...readdirSync(input)
          .filter((f) => /^nisar_.+\.csv$/i.test(f))
          .sort()
          .map((f) => join(input, f)),
      );
    } else {
      files.push(input);
    }
  }
  if (files.length === 0) fail(`No nisar_*.csv files found in: ${inputs.join(', ')}`);
  return files;
}

interface FileResult {
  rows: RawRow[];
  errors: string[];
  source: Manifest['sources'][number];
}

function readCsv(file: string): FileResult {
  const raw = readFileSync(file);
  const label = rel(file);
  const errors: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(stripBom(raw.toString('utf8')), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  for (const e of parsed.errors) {
    errors.push(`${label}:${(e.row ?? 0) + 2}  CSV parse error: ${e.message}`);
  }

  const columns = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    errors.push(`${label}  missing required column(s): ${missing.join(', ')}`);
    return { rows: [], errors, source: sourceInfo(label, raw, parsed.data.length) };
  }

  const rows: RawRow[] = [];
  parsed.data.forEach((record, i) => {
    const result = RawRowSchema.safeParse(record);
    if (result.success) {
      rows.push(result.data);
    } else {
      const line = i + 2; // +1 header, +1 one-based
      for (const issue of result.error.issues) {
        const col = issue.path.join('.') || '(row)';
        const value = typeof issue.path[0] === 'string' ? record[issue.path[0]] : undefined;
        errors.push(`${label}:${line}  ${col}=${JSON.stringify(value)}  ${issue.message}`);
      }
    }
  });

  return { rows, errors, source: sourceInfo(label, raw, parsed.data.length) };
}

function sourceInfo(file: string, raw: Buffer, rows: number): Manifest['sources'][number] {
  return { file, sha256: createHash('sha256').update(raw).digest('hex'), rows };
}

/** One feature per line: compact but diff-friendly in git. */
function serializeCollection(c: PointCollection): string {
  const lines = c.features.map((f) => JSON.stringify(f));
  return `{"type":"FeatureCollection","features":[\n${lines.join(',\n')}\n]}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = resolveInputFiles(args.inputs);

  const results = files.map(readCsv);
  const errors = results.flatMap((r) => r.errors);
  if (errors.length > 0) {
    const shown = errors
      .slice(0, MAX_REPORTED_ERRORS)
      .map((e) => `  ${e}`)
      .join('\n');
    const more =
      errors.length > MAX_REPORTED_ERRORS
        ? `\n  … and ${errors.length - MAX_REPORTED_ERRORS} more`
        : '';
    fail(`Validation failed with ${errors.length} problem(s); nothing written.\n\n${shown}${more}`);
  }

  let collection: PointCollection;
  try {
    collection = buildCollection(results.flatMap((r) => r.rows));
  } catch (e) {
    fail((e as Error).message);
  }

  // Validate our own output against the contract the app will enforce.
  const outCheck = PointCollectionSchema.safeParse(collection);
  if (!outCheck.success) fail(`Output failed schema check:\n${outCheck.error.message}`);
  const manifest = buildManifest(
    collection,
    results.map((r) => r.source),
  );
  const manifestCheck = ManifestSchema.safeParse(manifest);
  if (!manifestCheck.success) fail(`Manifest failed schema check:\n${manifestCheck.error.message}`);

  const outputs: Record<string, string> = {
    'points.geojson': serializeCollection(collection),
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
  };

  if (args.check) {
    const stale = Object.entries(outputs).filter(([name, content]) => {
      const path = join(args.outDir, name);
      return !existsSync(path) || readFileSync(path, 'utf8') !== content;
    });
    if (stale.length > 0) {
      fail(`Out of date: ${stale.map(([n]) => n).join(', ')}. Run \`npm run data\`.`);
    }
    console.log(`✔ ${collection.features.length} points valid; ${rel(args.outDir)} is up to date.`);
    return;
  }

  mkdirSync(args.outDir, { recursive: true });
  for (const [name, content] of Object.entries(outputs)) {
    writeFileSync(join(args.outDir, name), content);
  }

  const c = manifest.counts;
  console.log(
    [
      `✔ Converted ${files.map((f) => basename(f)).join(', ')}`,
      `  points:        ${c.points} (burned ${c.burned}, unburned ${c.unburned})`,
      `  burned groups: ${c.burned_groups}   fire years: ${manifest.fire_years.join(', ')}`,
      `  lidar stage:   <5 m ${c.by_lidar_stage[0]} · 5–10 m ${c.by_lidar_stage[1]} · ≥10 m ${c.by_lidar_stage[2]}`,
      `  bbox:          ${manifest.bbox.map((v) => v.toFixed(3)).join(', ')}`,
      `  NISAR dates:   ${manifest.nisar_dates.join(', ')}`,
      `  → ${rel(args.outDir)}/points.geojson, manifest.json`,
    ].join('\n'),
  );
}

main();
