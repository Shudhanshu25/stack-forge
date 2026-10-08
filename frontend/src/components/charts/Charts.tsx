import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cubicBezier, durationMs, easingToken, useReducedMotion } from '../../lib/motion';
import { ChartCard, swatch } from './ChartCard';
import { useChartPalette, type ChartPalette, type SeriesSpec } from './theme';

type Row = Record<string, number | string | null>;

interface TooltipPayload {
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
  name?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
  xLabel,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  format: (v: number) => string;
  xLabel: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="title">
        {xLabel} {label}
      </div>
      {payload.map((p) => (
        <div className="row" key={String(p.dataKey)}>
          <span className="key">
            <span className="dot" style={swatch(p.color)} />
            {p.name}
          </span>
          <span>{typeof p.value === 'number' ? format(p.value) : '—'}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = (palette: ChartPalette) =>
  ({
    tick: { fill: palette.label, fontSize: 12 },
    stroke: palette.axis,
    tickLine: false,
  }) as const;

/**
 * Data-change animation: off for the first draw (charts appear drawn, not from empty), then on,
 * so a new turn moves the existing line or bars to their new state. Off entirely under reduced
 * motion. Duration and easing are the motion tokens.
 */
function useChartAnimation() {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return useMemo(
    () => ({
      isAnimationActive: mounted && !reduced,
      animationDuration: durationMs('--dur-slow'),
      animationEasing: cubicBezier(easingToken()),
    }),
    [mounted, reduced],
  );
}

const RANGES = [
  { turns: 0, label: 'All' },
  { turns: 12, label: '12' },
  { turns: 6, label: '6' },
] as const;

/** All turns, or the last 12 or 6, once there are more than six to choose from. */
function RangeControl({ value, onChange }: { value: number; onChange: (turns: number) => void }) {
  return (
    <div className="segmented small flush" role="group" aria-label="Turns shown">
      {RANGES.map((r) => (
        <button
          key={r.label}
          type="button"
          className={value === r.turns ? 'active' : ''}
          aria-pressed={value === r.turns}
          aria-label={r.turns ? `Last ${r.turns} turns` : 'All turns'}
          onClick={() => onChange(r.turns)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

interface CommonProps {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: Row[];
  series: SeriesSpec[];
  format: (v: number) => string;
  height?: number;
  xKey?: string;
  xLabel?: string;
  actions?: ReactNode;
  dataTour?: string;
}

/**
 * Lines over turns on one y-axis: 2px strokes, hairline grid, crosshair tooltip, and a
 * direct label at each line's end when there are at most four series. With `ranges`, a
 * control limits the chart to the latest turns.
 */
export function LineChartCard({
  title,
  subtitle,
  rows: allRows,
  series,
  format,
  height = 240,
  xKey = 'turn',
  xLabel = 'Turn',
  zeroLine = false,
  actions,
  dataTour,
  ranges = false,
}: CommonProps & { zeroLine?: boolean; ranges?: boolean }) {
  const palette = useChartPalette();
  const animation = useChartAnimation();
  const [range, setRange] = useState(0);
  const rangeable = ranges && allRows.length > 6;
  const rows = rangeable && range ? allRows.slice(-range) : allRows;
  const directLabels = series.length <= 4;
  const lastIndex = rows.length - 1;
  const drawable = rows.length >= 2;
  const axis = axisProps(palette);
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      series={series}
      rows={rows}
      xKey={xKey}
      xLabel={xLabel}
      format={format}
      actions={
        <>
          {rangeable && <RangeControl value={range} onChange={setRange} />}
          {actions}
        </>
      }
      dataTour={dataTour}
    >
      {!drawable ? (
        <div className="chart-empty" style={{ height }}>
          The chart fills in after the first turn.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={rows}
            margin={{ top: 8, right: directLabels ? 72 : 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={palette.grid} />
            <XAxis dataKey={xKey} {...axis} />
            <YAxis {...axis} axisLine={false} width={68} tickFormatter={(v: number) => format(v)} />
            {zeroLine && <ReferenceLine y={0} stroke={palette.axis} />}
            <Tooltip
              content={<ChartTooltip format={format} xLabel={xLabel} />}
              cursor={{ stroke: palette.axis }}
              isAnimationActive={false}
            />
            {series.map((s) => {
              const color = palette.resolve(s.color);
              return (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  dot={false}
                  activeDot={{ r: 4, stroke: palette.surface, strokeWidth: 2 }}
                  connectNulls
                  {...animation}
                  label={
                    directLabels
                      ? (props: { x?: number | string; y?: number | string; index?: number }) =>
                          props.index === lastIndex &&
                          props.x !== undefined &&
                          props.y !== undefined ? (
                            <text
                              x={Number(props.x) + 8}
                              y={Number(props.y) + 4}
                              fill={palette.labelStrong}
                              fontSize={12}
                            >
                              {s.label}
                            </text>
                          ) : (
                            <g />
                          )
                      : undefined
                  }
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/** Stacked bars per turn with a 2px surface gap between segments. */
export function StackedBarCard({
  title,
  subtitle,
  rows,
  series,
  format,
  height = 240,
  xKey = 'turn',
  xLabel = 'Turn',
  actions,
  stacked = true,
}: CommonProps & { stacked?: boolean }) {
  const palette = useChartPalette();
  const animation = useChartAnimation();
  const axis = axisProps(palette);
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      series={series}
      rows={rows}
      xKey={xKey}
      xLabel={xLabel}
      format={format}
      actions={actions}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} axisLine={false} width={68} tickFormatter={(v: number) => format(v)} />
          <Tooltip
            content={<ChartTooltip format={format} xLabel={xLabel} />}
            cursor={{ fill: palette.hover }}
            isAnimationActive={false}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'stack' : undefined}
              fill={palette.resolve(s.color)}
              stroke={palette.surface}
              strokeWidth={stacked ? 2 : 0}
              radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
              {...animation}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
