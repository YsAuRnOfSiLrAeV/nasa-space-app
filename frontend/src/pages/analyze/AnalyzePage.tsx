import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { PageIntro, PageLayout } from '@/components/shell/PageLayout';
import { config } from '@/config';
import type { FireData } from '@/data/fireSchema';
import { useFireCatalog } from '@/hooks/useFireCatalog';
import { studyDataApi } from '@/services/data';
import {
  ANALYSIS_YEAR,
  MAX_UPLOAD_BYTES,
  MOCK_STEPS,
  parseFireUpload,
  runMockAnalysis,
  type AnalysisInput,
  type Perimeter,
} from './mockAnalysis';
import styles from './Analyze.module.css';

const FireRecovery = lazy(() =>
  import('@/pages/fire/FireRecovery').then((module) => ({ default: module.FireRecovery })),
);

type Job =
  | { status: 'idle' }
  | { status: 'running'; step: number }
  | { status: 'error'; message: string }
  | { status: 'done'; data: FireData; kind: AnalysisInput['kind']; run: number };

export function AnalyzePage() {
  const catalog = useFireCatalog();
  const [source, setSource] = useState<'catalog' | 'upload'>('catalog');
  const [selected, setSelected] = useState('');
  const chosen =
    catalog.fires.find((f) => f.id === selected) ??
    catalog.fires.find((f) => f.summer === ANALYSIS_YEAR);
  const [upload, setUpload] = useState<{ filename: string; perimeter: Perimeter } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [reading, setReading] = useState(false);
  const [name, setName] = useState('');
  const [fireYear, setFireYear] = useState('');
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const [cancelled, setCancelled] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const fileVersion = useRef(0);
  const run = useRef(0);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const formTitle = useRef<HTMLHeadingElement>(null);
  const busy = job.status === 'running';
  useEffect(
    () => () => {
      controller.current?.abort();
      fileVersion.current++;
    },
    [],
  );
  useEffect(() => {
    if (job.status === 'done') resultTitle.current?.focus();
    if (job.status === 'idle' && run.current > 0) formTitle.current?.focus();
  }, [job.status]);

  async function readFile(file: File | undefined) {
    const version = ++fileVersion.current;
    setUpload(null);
    setUploadError('');
    if (!file) {
      setReading(false);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setReading(false);
      setUploadError('Choose a GeoJSON file smaller than 1 MB.');
      return;
    }
    setReading(true);
    try {
      const perimeter = parseFireUpload(await file.text());
      if (version !== fileVersion.current) return;
      setUpload({ filename: file.name, perimeter });
      setName(file.name.replace(/\.[^.]+$/, '').slice(0, 100));
    } catch (error) {
      if (version === fileVersion.current)
        setUploadError(error instanceof Error ? error.message : 'The file could not be read.');
    } finally {
      if (version === fileVersion.current) setReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    let input: AnalysisInput;
    if (source === 'catalog') {
      if (!chosen) return;
      input = { kind: 'catalog', fireId: chosen.id };
    } else {
      if (!upload || reading) return;
      input = { kind: 'upload', name, fireYear: Number(fireYear), perimeter: upload.perimeter };
    }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    const id = ++run.current;
    setCancelled(false);
    setJob({ status: 'running', step: 0 });
    try {
      const data = await runMockAnalysis(input, {
        signal: active.signal,
        loadFire: (fireId, signal) => studyDataApi.loadFire(fireId, signal),
        onStep: (step) => {
          if (!active.signal.aborted) setJob({ status: 'running', step });
        },
      });
      if (!active.signal.aborted) setJob({ status: 'done', data, kind: input.kind, run: id });
    } catch (error) {
      if (!active.signal.aborted)
        setJob({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The demo result could not be opened. Try again.',
        });
    }
  }

  return (
    <PageLayout section="analyze">
      <PageIntro eyebrow="Your own fire" title="Analyse a fire of your choice">
        <p>
          Choose an available fire or upload its perimeter. Explore the result in the same recovery
          view used by the demonstration fires.
        </p>
      </PageIntro>
      <p className={styles.notice} role="note">
        <strong>Mock analysis workflow.</strong> Live processing is not connected. Catalog choices
        open existing exports; uploads generate an illustrative grid locally. No satellite
        extraction or scientific analysis runs here.
      </p>
      {job.status !== 'done' && (
        <form className={styles.form} onSubmit={submit} aria-busy={busy}>
          <h2 ref={formTitle} tabIndex={-1} className={styles.heading}>
            Choose the fire
          </h2>
          <fieldset disabled={busy} className={styles.fieldset}>
            <legend className={styles.label}>Fire source</legend>
            <div className={styles.options}>
              <label>
                <input
                  type="radio"
                  name="fire-source"
                  value="catalog"
                  checked={source === 'catalog'}
                  onChange={() => setSource('catalog')}
                />{' '}
                Available demo fires
              </label>
              <label>
                <input
                  type="radio"
                  name="fire-source"
                  value="upload"
                  checked={source === 'upload'}
                  onChange={() => setSource('upload')}
                />{' '}
                Upload GeoJSON
              </label>
            </div>
            {source === 'catalog' ? (
              <div className={styles.fields}>
                <label className={styles.label} htmlFor="analysis-fire">
                  Fire catalog
                </label>
                {catalog.status === 'loading' && <p role="status">Loading the available fires…</p>}
                {catalog.status === 'error' && (
                  <div role="alert">
                    <p>The fire catalog could not be loaded.</p>
                    <button type="button" onClick={catalog.retry}>
                      Retry catalog
                    </button>
                  </div>
                )}
                {catalog.status === 'ready' && (
                  <>
                    <select
                      id="analysis-fire"
                      value={chosen?.id ?? ''}
                      onChange={(event) => setSelected(event.target.value)}
                      disabled={!catalog.fires.some((f) => f.summer === ANALYSIS_YEAR)}
                      required
                    >
                      {!catalog.fires.some((f) => f.summer === ANALYSIS_YEAR) && (
                        <option value="">No summer 2026 results available</option>
                      )}
                      {catalog.fires.map((f) => (
                        <option key={f.id} value={f.id} disabled={f.summer !== ANALYSIS_YEAR}>
                          {f.name.en} · {f.year} · summer {f.summer}
                        </option>
                      ))}
                    </select>
                    <p className={styles.help}>
                      {config.fireDataIsExample
                        ? 'This catalog currently contains the labelled Deliverables example.'
                        : 'These are the published demo fires. The national NBAC catalog is not connected yet.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className={styles.fields}>
                <label className={styles.label} htmlFor="analysis-file">
                  Fire perimeter · GeoJSON
                </label>
                <input
                  id="analysis-file"
                  type="file"
                  accept=".json,.geojson,application/geo+json,application/json"
                  aria-describedby="analysis-file-help analysis-file-status"
                  aria-invalid={!!uploadError}
                  onChange={(event) => {
                    void readFile(event.target.files?.[0]);
                  }}
                />
                <p id="analysis-file-help" className={styles.help}>
                  One Polygon or MultiPolygon, including a single-feature collection. Use WGS84
                  longitude/latitude, closed rings and at most 1,000 vertices. Maximum file size: 1
                  MB. The file stays in your browser.
                </p>
                <div id="analysis-file-status" aria-live="polite">
                  {reading ? (
                    'Reading and validating the perimeter…'
                  ) : uploadError ? (
                    <p role="alert">{uploadError}</p>
                  ) : upload ? (
                    <p>Perimeter ready · {upload.filename}</p>
                  ) : null}
                </div>
                <div className={styles.row}>
                  <label className={styles.label}>
                    Fire name
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label className={styles.label}>
                    Fire year
                    <input
                      type="number"
                      value={fireYear}
                      onChange={(event) => setFireYear(event.target.value)}
                      min={1900}
                      max={ANALYSIS_YEAR}
                      step={1}
                      required
                    />
                  </label>
                </div>
              </div>
            )}
            <div className={styles.fields}>
              <label className={styles.label} htmlFor="analysis-summer">
                Observation summer
              </label>
              <select id="analysis-summer" value={ANALYSIS_YEAR} disabled>
                <option value={ANALYSIS_YEAR}>{ANALYSIS_YEAR}</option>
              </select>
              <p className={styles.help}>
                The model uses summer imagery (July–August), when it is most accurate. Forest
                structure changes slowly within a year; choose the nearest summer. Only 2026 is
                available in this demo.
              </p>
            </div>
          </fieldset>
          {busy ? (
            <section aria-label="Mock processing status" className={styles.processing}>
              <p role="status" aria-live="polite">
                Mock workflow · {MOCK_STEPS[job.step]}
              </p>
              <progress
                max={MOCK_STEPS.length}
                value={job.step + 1}
                aria-label="Mock workflow progress"
              />
              <ol>
                {MOCK_STEPS.map((step, i) => (
                  <li key={step} aria-current={i === job.step ? 'step' : undefined}>
                    {i < job.step ? 'Complete' : i === job.step ? 'In progress' : 'Waiting'} ·{' '}
                    {step}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => {
                  controller.current?.abort();
                  setJob({ status: 'idle' });
                  setCancelled(true);
                }}
              >
                Cancel
              </button>
            </section>
          ) : (
            <>
              {cancelled && (
                <p role="status">Mock analysis cancelled. Your selection is ready to try again.</p>
              )}
              {job.status === 'error' && (
                <p role="alert" className={styles.notice}>
                  {job.message}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  source === 'catalog' ? catalog.status !== 'ready' || !chosen : !upload || reading
                }
              >
                {job.status === 'error' ? 'Retry mock analysis' : 'Run mock analysis'}
              </button>
            </>
          )}
        </form>
      )}
      {job.status === 'done' && (
        <section className={styles.result} aria-labelledby="analysis-result-title">
          <div className={styles.resultHeading}>
            <h2
              id="analysis-result-title"
              ref={resultTitle}
              tabIndex={-1}
              className={styles.heading}
            >
              {job.data.result.fire.name.en} · {job.data.result.fire.year}
            </h2>
            <button
              type="button"
              onClick={() => {
                setJob({ status: 'idle' });
                setCancelled(false);
              }}
            >
              Analyse another fire
            </button>
          </div>
          <p className={styles.notice} role="note">
            {job.kind === 'upload'
              ? 'Illustrative mock result for your uploaded perimeter. Recovery values are generated for interface testing; no observations, trained model, validation or forecasts were applied. The displayed grid resolution is approximate.'
              : 'Mock workflow complete. This is the existing precomputed export for the selected fire; no new analysis was performed.'}
          </p>
          <Suspense fallback={<p role="status">Loading the shared fire view…</p>}>
            <FireRecovery key={job.run} data={job.data} />
          </Suspense>
        </section>
      )}
    </PageLayout>
  );
}
