import type { Theme } from '@/theme/themes';

/**
 * Miniature schematic of each theme's composition (not just its colours), drawn
 * with the theme's own fixed swatch so it previews correctly from any theme.
 */
export function ThemePreview({ theme }: { theme: Theme }) {
  const [bg, fg, accent] = theme.swatch;
  return (
    <svg viewBox="0 0 48 32" className="block h-8 w-12 shrink-0" aria-hidden>
      <rect width="48" height="32" fill={bg} />
      {theme.id === 'research-lab' && (
        <g fill="none" stroke={fg} strokeWidth="0.5">
          {/* graticule */}
          <g strokeOpacity="0.18">
            <path d="M24 5v22M36 5v22M16 13h32M16 21h32" />
          </g>
          {/* top rail, left column, bottom readout bar */}
          <path d="M0 4.5h48M15.5 4.5v22M0 26.5h48" strokeOpacity="0.55" />
          <path d="M2 7h3M2 7v3M13 24h-3M13 24v-3" strokeOpacity="0.8" />
          <circle cx="32" cy="16" r="1.2" fill={accent} stroke="none" />
          <path d="M5 29.5h6M19 29.5h6M33 29.5h6" strokeOpacity="0.7" />
        </g>
      )}
      {theme.id === 'living-atlas' && (
        <g fill="none">
          {/* relief + water */}
          <path
            d="M0 22c8-3 14 1 22-2s14-6 26-3"
            stroke="#4a6b85"
            strokeOpacity="0.35"
            strokeWidth="2"
          />
          {/* condensed title on the map */}
          <path d="M3 5h16M3 8.5h12" stroke={fg} strokeWidth="2" />
          {/* burn rings + call-out */}
          <circle cx="20" cy="17" r="3.2" stroke={accent} strokeWidth="0.6" />
          <circle cx="20" cy="17" r="1.6" stroke={accent} strokeWidth="0.8" />
          <path d="M22.5 15l3-3" stroke={fg} strokeWidth="0.5" />
          <rect x="25" y="9" width="8" height="4" fill="#fffdf8" stroke={fg} strokeWidth="0.4" />
          {/* field-note column with moss block */}
          <rect x="36" y="2" width="10" height="7" fill={fg} />
          <rect
            x="36"
            y="10.5"
            width="10"
            height="8"
            fill="#fffdf8"
            stroke={fg}
            strokeWidth="0.4"
          />
          <rect x="36" y="20" width="10" height="9" fill="#fffdf8" stroke={fg} strokeWidth="0.4" />
        </g>
      )}
      {theme.id === 'earth-intelligence' && (
        <g>
          {/* thin headline */}
          <path d="M3 9h13M3 12.5h9" stroke={fg} strokeWidth="1" strokeOpacity="0.85" />
          {/* dotted globe with the white locator ring */}
          <g fill={accent}>
            {[
              [30, 10],
              [34, 9],
              [38, 11],
              [28, 14],
              [32, 13.5],
              [36, 14],
              [40, 15],
              [29, 18],
              [33, 17.5],
              [37, 18.5],
              [31, 21.5],
              [35, 22],
              [39, 20],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.75" />
            ))}
          </g>
          <circle
            cx="34"
            cy="16"
            r="9"
            fill="none"
            stroke={accent}
            strokeWidth="0.4"
            strokeOpacity="0.6"
          />
          <circle cx="33" cy="12.5" r="1.6" fill="none" stroke={fg} strokeWidth="0.6" />
          {/* bracketed stats footer */}
          <path
            d="M3 26v3.5h1M3 26h1M14 26v3.5h-1M14 26h-1M17 26v3.5h1M17 26h1M28 26v3.5h-1M28 26h-1"
            fill="none"
            stroke={fg}
            strokeWidth="0.5"
            strokeOpacity="0.6"
          />
          <path d="M6 27.75h5M20 27.75h5" stroke={fg} strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
