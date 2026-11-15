import type { ReactNode } from 'react';

/**
 * Keep Greek letters lower-case inside `text-transform: uppercase` labels:
 * an upper-cased ρ renders as "Ρ", which reads as a Latin P.
 */
export function keepGreekCase(text: string): ReactNode {
  const parts = text.split(/([α-ω])/);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    /^[α-ω]$/.test(p) ? (
      <span key={i} className="normal-case">
        {p}
      </span>
    ) : (
      p
    ),
  );
}
