/** Prepare, submit, resume and import NASA AppEEARS point extraction jobs.
 * https://appeears.earthdatacloud.nasa.gov/api/
 * Credentials stay in the Node process. Public output contains observations only.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import Papa from 'papaparse';
import { z } from 'zod';
import {
  appeearsRequest,
  importAppEEARS,
  AppEEARSProgressSchema,
  type AppEEARSSelection,
} from '../src/data/appeears';
import { opticalGroup, OPTICAL_REFERENCE_RADIUS_KM } from '../src/data/opticalGroup';
import { PointCollectionSchema, REFERENCE_YEAR } from '../src/data/schema';
import { RecoveryFileSchema } from '../src/data/recoverySchema';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'https://appeears.earthdatacloud.nasa.gov/api';
const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const modes = ['--submit', '--status', '--download', '--csv'].filter((mode) => args.includes(mode));
if (modes.length > 1) throw new Error('Choose one action per invocation.');
const known = new Set(['--group', '--csv', '--values', '--submit', '--status', '--download']);
for (let index = 0; index < args.length; index++) {
  const flag = args[index]!;
  if (!known.has(flag)) throw new Error(`Unknown option ${flag}`);
  if (['--group', '--csv', '--values'].includes(flag)) index++;
}
const groupId = option('--group') ?? '2002_205_-376';
const collection = PointCollectionSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'public/data/points.geojson'), 'utf8')),
);
const group = opticalGroup(collection, groupId);
const selection: AppEEARSSelection = {
  group_id: groupId,
  fire_year: group.fireYear,
  years: [Math.max(2000, group.fireYear - 6), REFERENCE_YEAR],
  bbox: group.bbox,
  reference_radius_km: OPTICAL_REFERENCE_RADIUS_KM,
  coordinates: [
    ...group.burned.map((point) => ({
      id: point.id,
      latitude: point.lat,
      longitude: point.lon,
      category: 'burned' as const,
    })),
    ...group.reference.map((point) => ({
      id: point.id,
      latitude: point.lat,
      longitude: point.lon,
      category: 'reference' as const,
    })),
  ],
};
const request = appeearsRequest(selection);
const fingerprint = createHash('sha256')
  .update(JSON.stringify(request.params))
  .digest('hex')
  .slice(0, 12);
request.task_name += `-${fingerprint}`;
const cache = join(ROOT, 'data/raw/appeears', groupId);
mkdirSync(cache, { recursive: true });
function writeJson(path: string, data: unknown) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temporary, path);
}
writeJson(join(cache, 'request.json'), request);
writeJson(join(cache, 'selection.json'), selection);

async function api(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API}/${path}`, {
    ...init,
    signal: AbortSignal.timeout(60000),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`AppEEARS ${path} returned HTTP ${response.status}.`);
  return response;
}

async function token(): Promise<string> {
  const envFile = join(ROOT, '.env.local');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  if (process.env.APPEEARS_TOKEN) return process.env.APPEEARS_TOKEN;
  const username = process.env.EARTHDATA_USERNAME;
  const password = process.env.EARTHDATA_PASSWORD;
  if (!username || !password)
    throw new Error(
      'Configure EARTHDATA_USERNAME and EARTHDATA_PASSWORD, or APPEEARS_TOKEN, in .env.local. The extraction request is already saved.',
    );
  const response = await fetch(`${API}/login`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
  });
  if (!response.ok) throw new Error(`Earthdata login returned HTTP ${response.status}.`);
  return z.object({ token: z.string().min(1) }).parse(await response.json()).token;
}

const Task = z.object({
  task_id: z.string().uuid(),
  task_name: z.string(),
  status: z.string(),
  expires_on: z.string().nullish(),
});
async function main() {
  const csv = option('--csv');
  if (csv) {
    if (!existsSync(resolve(csv)))
      throw new Error(
        `The CSV file does not exist: ${csv}. Submit the extraction with --submit, check --status until done, then run --download. Use the downloaded product results filename with --csv.`,
      );
    const units = z.enum(['raw', 'scaled']).parse(option('--values'));
    const parsed = Papa.parse<Record<string, string>>(readFileSync(resolve(csv), 'utf8'), {
      header: true,
      skipEmptyLines: 'greedy',
    });
    if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0]!.message}`);
    const result = RecoveryFileSchema.parse(importAppEEARS(parsed.data, selection, units));
    const output = join(ROOT, 'public/data/appeears');
    mkdirSync(output, { recursive: true });
    writeJson(join(output, `${groupId}.json`), result);
    console.log(
      `Imported ${result.ndvi.filter((row) => row.burned).length} summers into public/data/appeears/${groupId}.json.`,
    );
    return;
  }
  if (modes.length === 0) {
    console.log(
      `Prepared ${selection.coordinates.length} sampling locations for July–August ${selection.years.join('–')}.\nRequest saved to data/raw/appeears/${groupId}/request.json.\nUse --submit after configuring Earthdata credentials, then --status and --download.`,
    );
    return;
  }
  const auth = await token();
  // Reconcile by deterministic name before submitting so a retry can recover
  // a request accepted by NASA even if the local process stopped before saving.
  const tasks = z.array(Task).parse(await (await api('task', auth)).json());
  const matching = tasks.filter((entry) => entry.task_name === request.task_name);
  let task = matching.find(
    (entry) =>
      !['error', 'failed'].includes(entry.status) &&
      (!entry.expires_on || Date.parse(entry.expires_on) > Date.now()),
  );
  if (!task && !args.includes('--submit')) task = matching[0];
  if (!task && args.includes('--submit')) {
    const submitted = z
      .object({ task_id: z.string().uuid() })
      .parse(
        await (await api('task', auth, { method: 'POST', body: JSON.stringify(request) })).json(),
      );
    task = { task_id: submitted.task_id, task_name: request.task_name, status: 'submitted' };
  }
  if (!task) throw new Error('No matching extraction task was found. Use --submit first.');
  writeJson(join(cache, 'task.json'), task);
  console.log(`Task ${task.task_id}: ${task.status}`);
  if (args.includes('--status') && task.status === 'processing') {
    const progress = AppEEARSProgressSchema.parse(
      await (await api(`status/${task.task_id}`, auth)).json(),
    );
    if (progress) {
      const current = progress.details.find((step) => step.pct_complete < 100);
      console.log(
        `${progress.summary}% overall${current ? ` · ${current.desc}: ${current.pct_complete}%` : ''}`,
      );
    }
  }
  if (!args.includes('--download')) return;
  if (!['done', 'processing'].includes(task.status))
    throw new Error('The extraction has not finished. Check --status later.');
  const bundle = z
    .object({
      files: z.array(
        z.object({
          file_id: z.string(),
          file_name: z.string(),
          file_size: z.number().int().nonnegative().optional(),
        }),
      ),
    })
    .parse(await (await api(`bundle/${task.task_id}`, auth)).json());
  const files = bundle.files.filter((file) =>
    /\.csv$|-metadata\.xml$|(?:^|\/)README\.md$/i.test(file.file_name),
  );
  if (!files.length) throw new Error('No CSV files were returned in the completed extraction.');
  for (const file of files) {
    const filename = basename(file.file_name.replaceAll('\\', '/'));
    const response = await api(`bundle/${task.task_id}/${encodeURIComponent(file.file_id)}`, auth);
    const output = join(cache, filename);
    const temporary = `${output}.${process.pid}.tmp`;
    const contents = Buffer.from(await response.arrayBuffer());
    if (file.file_size !== undefined && contents.length !== file.file_size)
      throw new Error(`The download of ${filename} is incomplete. Retry --download.`);
    writeFileSync(temporary, contents);
    renameSync(temporary, output);
    console.log(`Downloaded ${filename}`);
  }
  console.log(
    'Import the product samples CSV with --csv <path> --values raw|scaled, using the units documented in the export metadata.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'The AppEEARS operation failed.');
  process.exitCode = 1;
});
