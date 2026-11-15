import { useMemo, useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { ChartLegend, type LegendItem } from '@/components/visualizations/ChartLegend';
import { AxisText, YGrid } from '@/components/visualizations/svgAxes';
import { useElementWidth } from '@/hooks/useElementWidth';
import { curvePoints, TARGET, type GrowthCurve } from '../../domain/fire/growthForecast';
import { formatShare, isProvided } from '../../domain/fire/fireSummary';
import styles from './FireResults.module.css';
import { formatForecastPercent } from '@/domain/fire/forecastFormatting';

const HEIGHT = 190;
const M = { top: 12, right: 14, bottom: 24, left: 36 };

/**
 * The supplied growth curve by calendar year, with the observation summer's model
 * estimate as a separate point and the selected forecast year as an indicator.
 * Bundle series and uncertainty are drawn directly, with gaps for missing values.
 * Legacy exports alone use their explicit validated age range to mark extrapolation.
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
  const firstYear = curve.series?.years[0] ?? curve.fireYear;
  const x = scaleLinear().domain([firstYear, curve.endYear]).range([M.left, right]);
  const y = scaleLinear()
    .domain([
      0,
      Math.max(
        1,
        observed ?? 0,
        ...points.map((point) => point.value),
        ...(curve.series?.low.filter((value): value is number => value !== null) ?? []),
        ...(curve.series?.high.filter((value): value is number => value !== null) ?? []),
      ),
    ])
    .range([bottom, M.top]);
  const path = (subset: typeof points) =>
    subset
      .map(
        (p, i) =>
          `${i && p.year === subset[i - 1]!.year + 1 ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`,
      )
      .join('');
  const [from, to] = curve.reliableAge ?? [null, null];
  const reliable =
    from == null || to == null
      ? points
      : points.filter((p) => p.year - curve.fireYear >= from && p.year - curve.fireYear <= to);
  const current = points.find((p) => p.year === year);
  const hasObserved = isProvided(observed);
  const formatValue = curve.series ? formatForecastPercent : formatShare;
  const bands: string[] = [];
  if (curve.series) {
    let indices: number[] = [];
    const finish = () => {
      if (indices.length) {
        bands.push(
          indices
            .map(
              (index, offset) =>
                `${offset ? 'L' : 'M'}${x(curve.series!.years[index]!)},${y(curve.series!.high[index]!)}`,
            )
            .join(' ') +
            ' ' +
            indices
              .toReversed()
              .map((index) => `L${x(curve.series!.years[index]!)},${y(curve.series!.low[index]!)}`)
              .join(' ') +
            ' Z',
        );
        indices = [];
      }
    };
    curve.series.years.forEach((_, index) => {
      if (curve.series!.low[index] === null || curve.series!.high[index] === null) finish();
      else indices.push(index);
    });
    finish();
  }

  const ticks = [...new Set([curve.fireYear, curve.summer, curve.year80, curve.endYear])].filter(
    (t): t is number => t != null && t >= firstYear && t <= curve.endYear,
  );
  const missingBounds =
    curve.series?.low.some(
      (value, index) => value === null || curve.series!.high[index] === null,
    ) ?? false;
  const anyBounds =
    curve.series?.low.some(
      (value, index) => value !== null || curve.series!.high[index] !== null,
    ) ?? false;
  const boundPoints = (bound: 'low' | 'high') =>
    curve.series?.years.flatMap((year, index) =>
      curve.series![bound][index] == null ? [] : [{ year, value: curve.series![bound][index]! }],
    ) ?? [];
  const legend: LegendItem[] = [
    {
      swatch: 'line',
      color: 'var(--signal)',
      label: curve.series
        ? 'Supplied whole-fire recovery series'
        : `Forecast curve · ages ${from}–${to}`,
    },
    ...(curve.reliableAge
      ? [{ swatch: 'dashed' as const, color: 'var(--signal)', label: 'Extrapolation' }]
      : []),
    ...(curve.series
      ? [
          {
            swatch: 'dashed' as const,
            color: 'var(--signal)',
            label: '80% uncertainty bounds; shaded where both supplied',
          },
        ]
      : []),
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
    <figure
      className={styles.chart}
      data-forecast-source={
        curve.series ? (curve.seriesSource ?? 'model2.series') : 'growth_forecast'
      }
    >
      <ChartLegend items={legend} />
      <div ref={ref}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Supplied whole-fire recovery from ${firstYear} to ${curve.endYear}. ${curve.yearsTo80 == null ? 'No years-to-80% milestone supplied.' : `Supplied years to 80%: ${curve.yearsTo80}.`} ${curve.series ? 'Lower and upper 80% uncertainty bounds are shown where supplied; missing values remain gaps.' : 'No forecast uncertainty bounds supplied.'} ${
            hasObserved
              ? `The ${curve.summer} whole-fire model estimate is ${formatValue(observed)}.`
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
          {bands.map((band, index) => (
            <path
              key={index}
              data-forecast-interval="80"
              d={band}
              fill="var(--signal)"
              opacity={0.18}
            />
          ))}
          {curve.series &&
            (['low', 'high'] as const).map((bound) => (
              <g key={bound} data-forecast-bound={bound}>
                <path
                  d={path(boundPoints(bound))}
                  fill="none"
                  stroke="var(--signal)"
                  strokeOpacity={0.6}
                  strokeDasharray="2 3"
                />
                {boundPoints(bound).map((point) => (
                  <circle
                    key={point.year}
                    cx={x(point.year)}
                    cy={y(point.value)}
                    r={1}
                    fill="var(--signal)"
                  />
                ))}
              </g>
            ))}
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
          {curve.reliableAge && (
            <path
              d={path(points)}
              fill="none"
              stroke="var(--signal)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}
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
      {missingBounds && (
        <p>
          {anyBounds
            ? 'Some uncertainty bounds are not supplied. Available bounds remain visible; the shaded band stops at missing bounds.'
            : 'Uncertainty bounds are not supplied for any year. No uncertainty band can be drawn.'}
        </p>
      )}
    </figure>
  );
}
