import { EVIDENCE_SOURCES, type EvidenceSource } from '@/data/calibrationEvidence';
import { useId, useState, type ReactNode } from 'react';
import { KIND_LABELS, type ChapterCopy, type Kind } from './chapters';
import styles from './research.module.css';

/**
 * One chapter of the research document: its question, title, one opening
 * paragraph, one primary figure, the findings read from it, unresolved assumptions
 * and optional supporting material. Layout only; the words come from chapters.ts.
 */
export function Chapter({
  copy,
  band,
  figure,
  children,
}: {
  copy: ChapterCopy;
  /** `ink` sets the chapter on a full-width black band (the page alternates). */
  band?: 'ink';
  /** The chapter's primary visualization (the body of its figure). */
  figure: ReactNode;
  /** Supporting evidence and collapsible method, after the findings. */
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={copy.id} aria-labelledby={headingId} data-band={band} className={styles.chapter}>
      <header className={styles.chapterHead}>
        <p className={styles.question}>
          <b aria-hidden>{copy.n}</b>
          {copy.question}
        </p>
        <h2 id={headingId} tabIndex={-1} className={styles.chapterTitle}>
          <span className="sr-only">Chapter {Number(copy.n)}: </span>
          {copy.title}
        </h2>
        <p className={styles.lede}>{copy.lede}</p>
      </header>

      <EvidenceFigure {...copy.figure}>{figure}</EvidenceFigure>

      {(copy.findings.length > 0 || copy.unresolved) && (
        <div className={styles.afterFigure}>
          {copy.findings.length > 0 && (
            <div>
              <h3 className={styles.minorHead}>What the figure shows</h3>
              <ol className={styles.findings}>
                {copy.findings.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ol>
            </div>
          )}
          {copy.unresolved && <Unresolved items={copy.unresolved} />}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * The mark for one kind of number. The same four marks appear in every figure
 * header and legend, so a reader always knows what kind of number they are reading.
 */
export function KindMark({ kind, label }: { kind: Kind; label?: string }) {
  return (
    <span className={styles.kind} data-kind={kind}>
      <i aria-hidden />
      {label ?? KIND_LABELS[kind]}
    </span>
  );
}

/** A scientific figure: label, title, the kinds of numbers in it, body, caption, source. */
export function EvidenceFigure({
  label,
  title,
  caption,
  sources,
  kinds,
  tag = 'Calibration study',
  children,
}: {
  label: string;
  title: string;
  caption: string;
  sources: EvidenceSource[];
  kinds: Kind[];
  /** What kind of evidence this is, shown in the figure header. */
  tag?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <figure className={styles.figure} aria-labelledby={titleId}>
      <div className={styles.figureHead}>
        <span className={styles.figureLabel}>{label}</span>
        <span className={styles.tag}>{tag}</span>
        <span id={titleId} className={styles.figureTitle}>
          {title}
        </span>
        <ul className={styles.kindRow} aria-label="Kinds of numbers in this figure">
          {kinds.map((kind) => (
            <li key={kind}>
              <KindMark kind={kind} />
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.figureBody}>{children}</div>
      <figcaption className={styles.caption}>
        <p>{caption}</p>
        <p className={styles.source}>
          Source: {sources.map((s) => EVIDENCE_SOURCES[s].label).join(' · ')}
        </p>
      </figcaption>
    </figure>
  );
}

/** Assumptions that are not settled: marked, never blended into the findings. */
export function Unresolved({ items, title = 'Unresolved' }: { items: string[]; title?: string }) {
  return (
    <aside className={styles.unresolved} aria-label={`${title} assumptions`}>
      <h3 className={styles.unresolvedHead}>{title}</h3>
      <ul>
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </aside>
  );
}

/** Collapsible supporting material (method detail, data tables, study-sample charts). */
export function Supporting({
  summary,
  note,
  defer = false,
  children,
}: {
  summary: string;
  defer?: boolean;
  /** One line under the summary saying what kind of evidence this is. */
  note?: string;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className={styles.supporting}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>
        <span>{summary}</span>
        {note && <small>{note}</small>}
      </summary>
      <div className={styles.supportingBody}>{(!defer || opened) && children}</div>
    </details>
  );
}
