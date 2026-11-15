import type { ReactNode } from 'react';
import styles from '../research.module.css';

export function BarPanel({
  title,
  unit,
  label,
  children,
}: {
  title: ReactNode;
  unit: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-label={label}>
      <h4>
        {title} <span>{unit}</span>
      </h4>
      {children}
    </section>
  );
}

export function BarRow({
  label,
  value,
  width,
  tone,
  marker,
}: {
  label: string;
  value: string;
  width: number | string;
  tone?: 'weak';
  marker?: { at: string; label: string };
}) {
  return (
    <div className={styles.barRow}>
      <p>
        {label} <b>{value}</b>
      </p>
      <div className={styles.track}>
        <span
          className={styles.fill}
          data-tone={tone}
          style={{ width: typeof width === 'number' ? `${width}%` : width }}
        />
        {marker && (
          <span className={styles.marker} style={{ left: marker.at }}>
            <i>{marker.label}</i>
          </span>
        )}
      </div>
    </div>
  );
}

export function BarScale({ ticks }: { ticks: string[] }) {
  return (
    <div className={styles.scale} aria-hidden>
      {ticks.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
