import { useMemo, useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { ChartLegend, type LegendItem } from '@/components/visualizations/ChartLegend';
import { AxisText, YGrid } from '@/components/visualizations/svgAxes';
import { useElementWidth } from '@/hooks/useElementWidth';
import { curvePoints, TARGET, type GrowthCurve } from '../../domain/fire/growthForecast';
import { formatShare, isProvided } from '../../domain/fire/fireSummary';
import styles from './FireResults.module.css';

const HEIGHT = 190;
const M = { top: 12, right: 14, bottom: 24, left: 36 };

/**
 * The supplied growth curve by calendar year, with the observation summer's model
 * estimate as a separate point and the selected forecast year as an indicator.
 * Solid: within the validated fire-age range; dashed: extrapolation. No uncertainty
 * band is drawn, because none is supplied.
 */
export function ForecastChart({
  curve,
  observed,
  year,
}: {
  curve: GrowthCurve;
  /** Whole-fire model estimate for the observation summer, if supplied. */
  observed: number | null;
  year: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.max(240, useElementWidth(ref));
  const points = useMemo(() => curvePoints(curve), [curve]);
  const right = width - M.right;
  const bottom = HEIGHT - M.bottom;
  const x = scaleLinear().domain([curve.fireYear, curve.endYear]).range([M.left, right]);
  const y = scaleLinear()
    .domain([0, Math.max(1, observed ?? 0)])
    .range([bottom, M.top]);
  const path = (subset: typeof points) =>
    subset
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join('');
  const [from, to] = curve.reliableAge;
  const reliable = points.filter(
    (p) => p.year - curve.fireYear >= from && p.year - curve.fireYear <= to,
  );
  const current = points.find((p) => p.year === year);
  const hasObserved = isProvided(observed);

  const ticks = [...new Set([curve.fireYear, curve.summer, curve.year80, curve.endYear])].filter(
    (t): t is number => t != null,
  );
  const legend: LegendItem[] = [
    { swatch: 'line', color: 'var(--signal)', label: `Forecast curve · ages ${from}–${to}` },
    { swatch: 'dashed', color: 'var(--signal)', label: 'Extrapolation' },
    ...(hasObserved
      ? [
          {
            swatch: 'ring',
            color: 'var(--foreground)',
            label: `${curve.summer} model estimate`,
          } as const,
        ]
      : []),
    { swatch: 'tick', color: 'var(--ring)', label: 'Selected year' },
  ];

  return (
    <figure className={styles.chart}>
      <ChartLegend items={legend} />
      <div ref={ref}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Supplied growth curve from ${curve.fireYear} to ${curve.endYear}, reaching 80% of the neighbouring forest height after ${curve.yearsTo80.toFixed(1)} years. ${
            hasObserved
              ? `The ${curve.summer} whole-fire model estimate is ${formatShare(observed)}.`
              : `No whole-fire model estimate is supplied for ${curve.summer}.`
          } Selected year ${year}.`}
        >
          <YGrid
            scale={y}
            ticks={4}
            left={M.left}
            right={right}
            format={(t) => `${Math.round(t * 100)}%`}
          />
          <line
            x1={M.left}
            x2={right}
            y1={y(TARGET)}
            y2={y(TARGET)}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 3"
          />
          {/* Left end: the curve is low there, so the label never meets it. */}
          <AxisText x={M.left + 4} y={y(TARGET) - 4} anchor="start">
            80% of neighbouring forest
          </AxisText>
          <path
            d={path(points)}
            fill="none"
            stroke="var(--signal)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <path d={path(reliable)} fill="none" stroke="var(--signal)" strokeWidth={2} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={bottom} y2={bottom + 4} stroke="var(--rule-strong)" />
              <AxisText
                x={x(t)}
                y={bottom + 15}
                anchor={t === curve.endYear ? 'end' : t === curve.fireYear ? 'start' : 'middle'}
              >
                {t === curve.fireYear ? `Fire ${t}` : t}
              </AxisText>
            </g>
          ))}
          {current && (
            <g>
              <line x1={x(year)} x2={x(year)} y1={M.top} y2={bottom} stroke="var(--ring)" />
              <circle
                cx={x(year)}
                cy={y(current.value)}
                r={4}
                fill="var(--signal)"
                stroke="var(--background)"
                strokeWidth={2}
              />
            </g>
          )}
          {hasObserved && (
            <circle
              cx={x(curve.summer)}
              cy={y(observed!)}
              r={4.5}
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>
    </figure>
  );
}
