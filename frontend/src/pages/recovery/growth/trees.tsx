/**
 * Procedural SVG drawings of the five species. Each drawer gets a height in
 * drawing units and a stable shape seed; all shape detail is expressed as
 * fractions of the height, so a tree keeps its form as it grows.
 * Origin is the base of the trunk; the tree grows towards negative y.
 */
import { memo, type ReactNode } from 'react';
import { hashString, seededRandom } from '@/domain/forest/growth';
import type { SpeciesId } from '@/domain/forest/species';
import { PLATE as C } from './palette';

interface DrawProps {
  h: number;
  seed: string;
  stems?: number;
}

const f = (n: number) => Math.round(n * 10) / 10;

/** Irregular closed blob around (cx, cy). */
function blob(rnd: () => number, cx: number, cy: number, rx: number, ry: number, points = 8) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const k = 0.75 + rnd() * 0.4;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
  });
  // Smooth closed curve through midpoints.
  const mid = (i: number) => {
    const a = pts[i % points]!;
    const b = pts[(i + 1) % points]!;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  let d = `M${f(mid(0)[0])} ${f(mid(0)[1])}`;
  for (let i = 1; i <= points; i++) {
    const p = pts[i % points]!;
    const m = mid(i);
    d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return d + 'Z';
}

function BlackSpruce({ h, seed }: DrawProps) {
  const rnd = seededRandom(hashString(seed));
  const crownW = h * 0.15 + 2;
  const tiers = Math.max(4, Math.min(34, Math.round(h / 6)));
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= tiers; i++) {
    const t = i / tiers; // 0 bottom … 1 top
    const y = -h * (0.06 + 0.9 * t);
    const w = crownW * Math.pow(1 - t, 0.85) * (0.55 + rnd() * 0.45) + 0.6;
    const droop = Math.max(0.6, h * 0.012);
    left.push(`L${f(-w)} ${f(y + droop)} L${f(-w * 0.35)} ${f(y - droop)}`);
    right.unshift(`L${f(w * 0.35)} ${f(y - droop)} L${f(w)} ${f(y + droop)}`);
  }
  const top = -h;
  const d = `M0 ${f(-h * 0.04)} ${left.join(' ')} L0 ${f(top)} ${right.join(' ')} Z`;
  return (
    <g>
      <line y2={f(-h * 0.2)} stroke={C.trunk} strokeWidth={Math.max(0.8, h * 0.014)} />
      <path d={d} fill={C.spruce} stroke={C.spruceDark} strokeWidth="0.6" strokeLinejoin="round" />
      {/* The cone "club" near the top. */}
      {h > 40 && (
        <ellipse cy={f(-h * 0.93)} rx={f(h * 0.022 + 1)} ry={f(h * 0.04)} fill={C.spruceDark} />
      )}
    </g>
  );
}

function JackPine({ h, seed }: DrawProps) {
  const rnd = seededRandom(hashString(seed));
  const bend = (rnd() - 0.5) * 0.08 * h;
  const trunk = `M0 0 Q${f(bend)} ${f(-h * 0.45)} ${f(bend * 0.3)} ${f(-h * 0.92)}`;
  const clumps = Math.max(2, Math.min(9, Math.round(h / 28) + 2));
  const crown: ReactNode[] = [];
  const branches: string[] = [];
  for (let i = 0; i < clumps; i++) {
    const t = 0.5 + (i / clumps) * 0.45 + rnd() * 0.05;
    const y = -h * t;
    const side = i % 2 ? 1 : -1;
    const reach = h * (0.08 + rnd() * 0.12) * (1.1 - t * 0.5);
    const cx = bend * (1 - t) * 0.6 + side * reach;
    branches.push(`M${f(bend * 0.5)} ${f(y + h * 0.04)} L${f(cx)} ${f(y)}`);
    crown.push(
      <path
        key={i}
        d={blob(rnd, cx, y, h * (0.07 + rnd() * 0.04) + 1.5, h * (0.045 + rnd() * 0.02) + 1, 9)}
        fill={i % 3 ? C.pine : C.pineDark}
        stroke={C.pineDark}
        strokeWidth="0.5"
      />,
    );
  }
  crown.push(
    <path
      key="top"
      d={blob(rnd, bend * 0.3, -h * 0.95, h * 0.07 + 1.5, h * 0.05 + 1, 9)}
      fill={C.pine}
      stroke={C.pineDark}
      strokeWidth="0.5"
    />,
  );
  return (
    <g>
      <path
        d={trunk}
        fill="none"
        stroke={C.pineBark}
        strokeWidth={Math.max(0.9, h * 0.022)}
        strokeLinecap="round"
      />
      <path
        d={branches.join('')}
        fill="none"
        stroke={C.pineBark}
        strokeWidth={Math.max(0.5, h * 0.007)}
      />
      {crown}
    </g>
  );
}

function TremblingAspen({ h, seed }: DrawProps) {
  const rnd = seededRandom(hashString(seed));
  const tw = Math.max(0.9, h * 0.02);
  const marks: string[] = [];
  for (let i = 0; i < Math.min(6, Math.floor(h / 30)); i++) {
    const y = -h * (0.1 + rnd() * 0.45);
    marks.push(
      `M${f(-tw * 0.4)} ${f(y)} l${f(tw * 0.4)} ${f(-tw * 0.5)} l${f(tw * 0.4)} ${f(tw * 0.5)}`,
    );
  }
  const leaves: ReactNode[] = [];
  const n = Math.max(3, Math.min(11, Math.round(h / 25) + 3));
  for (let i = 0; i < n; i++) {
    const t = 0.62 + rnd() * 0.36;
    const x = (rnd() - 0.5) * h * 0.16 * (1.2 - Math.abs(t - 0.8) * 2);
    leaves.push(
      <path
        key={i}
        d={blob(
          rnd,
          x,
          -h * t,
          h * (0.05 + rnd() * 0.03) + 1.4,
          h * (0.05 + rnd() * 0.03) + 1.4,
          8,
        )}
        fill={i % 2 ? C.aspenLeaf : C.aspenLeafDark}
        stroke={C.aspenLeafDark}
        strokeWidth="0.4"
      />,
    );
  }
  return (
    <g>
      <line y2={f(-h * 0.9)} stroke={C.aspenBark} strokeWidth={tw} strokeLinecap="round" />
      <line
        y2={f(-h * 0.9)}
        x1={tw * 0.45}
        x2={tw * 0.45}
        stroke={C.inkSoft}
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      {marks.length > 0 && (
        <path
          d={marks.join('')}
          fill="none"
          stroke={C.ink}
          strokeOpacity="0.55"
          strokeWidth="0.6"
        />
      )}
      {leaves}
    </g>
  );
}

function WhiteBirch({ h, seed, stems = 1 }: DrawProps) {
  const rnd = seededRandom(hashString(seed));
  const out: ReactNode[] = [];
  for (let s = 0; s < stems; s++) {
    const lean = stems === 1 ? 0 : (s - (stems - 1) / 2) * h * 0.09;
    const sh = h * (s === 0 ? 1 : 0.85 + rnd() * 0.1);
    const tw = Math.max(0.8, h * 0.017);
    const top = { x: lean, y: -sh * 0.88 };
    const lent: string[] = [];
    for (let i = 0; i < Math.min(9, Math.floor(sh / 14)); i++) {
      const t = 0.08 + rnd() * 0.75;
      const x = top.x * t;
      lent.push(`M${f(x - tw * 0.4)} ${f(top.y * t)} h${f(tw * (0.3 + rnd() * 0.4))}`);
    }
    out.push(
      <g key={`s${s}`}>
        <line
          x2={f(top.x)}
          y2={f(top.y)}
          stroke={C.inkSoft}
          strokeWidth={tw + 0.8}
          strokeLinecap="round"
        />
        <line
          x2={f(top.x)}
          y2={f(top.y)}
          stroke={C.birchBark}
          strokeWidth={tw}
          strokeLinecap="round"
        />
        {lent.length > 0 && (
          <path d={lent.join('')} stroke={C.ink} strokeWidth="0.8" strokeLinecap="round" />
        )}
      </g>,
    );
    const n = Math.max(3, Math.min(12, Math.round(sh / 22) + 3));
    for (let i = 0; i < n; i++) {
      const t = 0.5 + rnd() * 0.47;
      const x = top.x * t + (rnd() - 0.5) * sh * 0.22;
      out.push(
        <path
          key={`l${s}-${i}`}
          d={blob(
            rnd,
            x,
            -sh * t,
            sh * (0.045 + rnd() * 0.03) + 1.3,
            sh * (0.04 + rnd() * 0.025) + 1.2,
            7,
          )}
          fill={i % 3 ? C.birchLeaf : C.birchLeafDark}
          stroke={C.birchLeafDark}
          strokeWidth="0.4"
        />,
      );
    }
  }
  return <g>{out}</g>;
}

function Tamarack({ h, seed }: DrawProps) {
  const rnd = seededRandom(hashString(seed));
  const whorls = Math.max(3, Math.min(18, Math.round(h / 12)));
  const strokes: string[] = [];
  const tufts: string[] = [];
  for (let i = 0; i < whorls; i++) {
    const t = 0.12 + (i / whorls) * 0.85;
    const y = -h * t;
    const w = h * 0.2 * Math.pow(1 - t, 0.9) + 1;
    for (const side of [-1, 1]) {
      const x = side * w * (0.7 + rnd() * 0.3);
      strokes.push(`M0 ${f(y)} Q${f(x * 0.5)} ${f(y - h * 0.01)} ${f(x)} ${f(y + h * 0.015)}`);
      for (let k = 1; k <= 3; k++) {
        const tx = (x * k) / 3;
        tufts.push(`M${f(tx)} ${f(y - 0.5)} m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0`);
      }
    }
  }
  return (
    <g>
      <line y2={f(-h)} stroke={C.trunk} strokeWidth={Math.max(0.7, h * 0.012)} />
      <path d={strokes.join('')} fill="none" stroke={C.tamarackDark} strokeWidth="0.7" />
      <path d={tufts.join('')} fill={C.tamarack} opacity="0.9" />
    </g>
  );
}

const DRAWERS: Record<SpeciesId, (p: DrawProps) => ReactNode> = {
  'black-spruce': BlackSpruce,
  'jack-pine': JackPine,
  'trembling-aspen': TremblingAspen,
  'white-birch': WhiteBirch,
  tamarack: Tamarack,
};

/** One tree. Heights are rounded so React skips re-drawing trees that did not visibly change. */
export const Tree = memo(function Tree({
  species,
  h,
  seed,
  stems,
}: {
  species: SpeciesId;
  h: number;
  seed: string;
  stems?: number;
}) {
  const Draw = DRAWERS[species];
  return <Draw h={h} seed={seed} stems={stems} />;
});
