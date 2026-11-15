/**
 * Where the demo fires come from, for the dev server, the build and `npm run data:demo`.
 *
 * The team pipeline (backend/pipeline/run.py) writes precomputed fires to the
 * monorepo's `data/demo/` (index.json + <fire_id>/result.json, cells.json,
 * optical.png; format: DELIVERABLES tab 1). The app serves them at
 * `<base>data/demo/`, the URL it has always read.
 *
 *   team     `../data/demo/index.json` exists (or FIRE_DEMO_DIR points at a folder
 *            that has one): that folder is served in dev and copied into the
 *            build, replacing the example.
 *   example  otherwise: the documentation example in `public/data/demo/` is served,
 *            and the app labels it as an example.
 *
 * Nothing outside `frontend/` is written: the team folder is only read.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export type DemoSource = 'team' | 'example';

const FRONTEND_ROOT = resolve(import.meta.dirname, '..');
/** The monorepo's demo folder, where the pipeline writes its results. */
export const TEAM_DEMO_DIR = resolve(FRONTEND_ROOT, '../data/demo');
/** The documentation example bundled with the app. */
export const EXAMPLE_DEMO_DIR = resolve(FRONTEND_ROOT, 'public/data/demo');

/** The folder demo fires are read from, and which kind it is. */
export function resolveDemoData(env: NodeJS.ProcessEnv = process.env): {
  source: DemoSource;
  dir: string;
} {
  const override = env.FIRE_DEMO_DIR?.trim();
  const team = override ? resolve(FRONTEND_ROOT, override) : TEAM_DEMO_DIR;
  if (existsSync(join(team, 'index.json'))) return { source: 'team', dir: team };
  if (override) {
    throw new Error(`FIRE_DEMO_DIR=${override} has no index.json (looked in ${team}).`);
  }
  return { source: 'example', dir: EXAMPLE_DEMO_DIR };
}

const TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** A request path below the demo URL, mapped into `dir`; null if it would leave it. */
export function demoFile(dir: string, requestPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = resolve(dir, `.${sep}${decoded}`);
  const rel = relative(dir, file);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  return file;
}

/**
 * Serves the team demo folder at `<base>data/demo/` in dev and copies it into
 * the build. Exposes the source to the app as `import.meta.env.VITE_FIRE_DEMO_SOURCE`.
 */
export function demoDataPlugin(): Plugin {
  const demo = resolveDemoData();
  let config: ResolvedConfig;
  return {
    name: 'fire-demo-data',
    config: () => ({
      define: { 'import.meta.env.VITE_FIRE_DEMO_SOURCE': JSON.stringify(demo.source) },
    }),
    configResolved(resolved) {
      config = resolved;
      if (resolved.command === 'serve' || !resolved.build.ssr) {
        resolved.logger.info(
          `  demo fires: ${demo.source === 'team' ? `team results from ${demo.dir}` : 'documentation example (no ../data/demo/index.json yet)'}`,
        );
      }
    },
    configureServer(server) {
      if (demo.source !== 'team') return;
      const prefix = `${server.config.base}data/demo/`;
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!;
        if (!url.startsWith(prefix)) return next();
        const file = demoFile(demo.dir, url.slice(prefix.length));
        // Team mode never falls back to the example: a missing file is a 404,
        // so a gap in the pipeline output shows up instead of being masked.
        if (!file || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader(
          'Content-Type',
          TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        );
        res.setHeader('Cache-Control', 'no-store');
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      if (demo.source !== 'team' || config.command !== 'build') return;
      const out = resolve(config.root, config.build.outDir, 'data/demo');
      await rm(out, { recursive: true, force: true });
      await cp(demo.dir, out, {
        recursive: true,
        filter: (src) => !src.endsWith('.gitkeep'),
      });
      config.logger.info(`  demo fires: copied team results into ${relative(config.root, out)}`);
    },
  };
}
