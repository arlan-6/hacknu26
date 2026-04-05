import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  critical?: boolean;
  trend?: "up" | "down" | "stable";
  data?: number[];
  limit?: number;
}

export function MetricCard({
  label,
  value,
  unit,
  critical = false,
  trend = "stable",
  data,
  limit,
}: MetricCardProps) {
  const trendMark = trend === "up" ? "↑" : trend === "down" ? "↓" : "•";
  const chartData = data?.map((d) => ({ val: d })) ?? [];
  const safeLabelId = label.replace(/\s+/g, '');

  return (
    <article className="relative overflow-hidden rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 shadow-[var(--ui-shadow)] flex flex-col justify-between hover:bg-[var(--ui-panel-accent)] transition-colors duration-300 min-h-[140px]">
      <div className="relative z-10 flex flex-col justify-between h-full">
        <h3 className="text-xs font-semibold tracking-[0.16em] text-[var(--ui-text-muted)] uppercase">
          {label}
        </h3>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p
            className={`text-4xl leading-none font-semibold tracking-tight ${
              critical ? "text-[var(--status-critical)]" : "text-[var(--ui-text)]"
            }`}
          >
            {value}
            {unit ? (
              <span className="ml-1 text-base font-medium opacity-80">
                {unit}
              </span>
            ) : null}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              trend === "up"
                ? "bg-[var(--status-warning)]/20 text-[var(--status-warning)]"
                : trend === "down"
                  ? "bg-[var(--status-info)]/20 text-[var(--status-info)]"
                  : "bg-[var(--ui-panel-muted)] text-[var(--ui-text-muted)]"
            }`}
            aria-label={`Trend ${trend}`}
          >
            {trendMark}
          </span>
        </div>
      </div>

      {data && data.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 top-10 opacity-70 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${safeLabelId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={critical ? "var(--status-critical)" : "var(--status-info)"} stopOpacity={0.6}/>
                  <stop offset="95%" stopColor={critical ? "var(--status-critical)" : "var(--status-info)"} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <YAxis domain={['auto', 'auto']} hide />
              {limit !== undefined && (
                <ReferenceLine 
                  y={limit} 
                  stroke="var(--status-critical)" 
                  strokeDasharray="4 4" 
                  opacity={0.8} 
                  strokeWidth={1.5} 
                />
              )}
              <Area 
                type="monotone" 
                dataKey="val" 
                stroke={critical ? "var(--status-critical)" : "var(--status-info)"} 
                strokeWidth={2.5}
                fill={`url(#grad-${safeLabelId})`} 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
