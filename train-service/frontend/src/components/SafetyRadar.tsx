import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  scoreCurrent,
  scorePressure,
  scoreSpeed,
  scoreTemperature,
  scoreVoltage,
} from "../lib/safety";

interface SafetyRadarProps {
  speedKmh: number;
  pressureKpa: number;
  tempC: number;
  voltageV: number;
  currentA: number;
  healthIndex: number;
}



const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel)]/95 p-3 shadow-[0_4px_24px_rgba(0,0,0,0.3)] backdrop-blur">
        <p className="mb-2 border-b border-[var(--ui-border)] pb-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--ui-text-muted)]">
          {data.metric} Subsystem
        </p>
        <div className="flex flex-col gap-1 text-sm pt-1">
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-[var(--ui-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-normal)]"></span> 
              Raw Feed:
            </span>
            <span className="font-semibold tracking-wider tabular-nums">{data.rawValue} {data.unit}</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-[var(--ui-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-info)]"></span> 
              Balance Score:
            </span>
            <span className="font-mono uppercase font-bold text-[var(--status-info)] tabular-nums">{data.score}/100</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function SafetyRadar({
  speedKmh,
  pressureKpa,
  tempC,
  voltageV,
  currentA,
  healthIndex,
}: SafetyRadarProps) {
  const radarData = [
    {
      metric: "Engine",
      score: scoreTemperature(tempC),
      warning: 100, // < 95 is normal, warning begins immediately as score drops
      rawValue: tempC.toFixed(1),
      unit: "°C",
    },
    {
      metric: "Brakes",
      score: scorePressure(pressureKpa),
      warning: 67, // exactly 300 kPa mapped to score
      rawValue: pressureKpa.toFixed(0),
      unit: "kPa",
    },
    {
      metric: "Electrical",
      score: Math.round((scoreVoltage(voltageV) + scoreCurrent(currentA)) / 2),
      warning: 100, // bounds are sharp at normal limits
      rawValue: voltageV.toFixed(0),
      unit: "V",
    },
    {
      metric: "Cooling",
      score: Math.max(0, Math.min(100, 100 - Math.max(0, tempC - 85) * 5)),
      warning: 50, // at temp 95, this formula drops to 50
      rawValue: tempC.toFixed(1),
      unit: "°C",
    },
    {
      metric: "Energy",
      score: Math.round(
        (scoreVoltage(voltageV) + scorePressure(pressureKpa)) / 2,
      ),
      warning: 84, // average of voltage (100) and pressure (67)
      rawValue: currentA.toFixed(0),
      unit: "A",
    },
    {
      metric: "Load",
      score: Math.round((scoreSpeed(speedKmh) + healthIndex) / 2),
      warning: 85, // average of speed (100) and health (70)
      rawValue: speedKmh.toFixed(1),
      unit: "km/h",
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 shadow-[var(--ui-shadow)] flex-grow flex flex-col justify-between min-h-0">
      <h3 className="text-xs font-semibold tracking-[0.16em] text-[var(--ui-text-muted)] uppercase">
        Subsystem Balance Matrix
      </h3>
      <div className="mt-2 flex-grow min-h-[260px] w-full relative">
        {/* Ambient background scanner glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--status-info)_0%,transparent_60%)] opacity-[0.03] pointer-events-none" />
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="68%">
            <defs>
              <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="30%" stopColor="var(--status-info)" stopOpacity={0.6} />
                <stop offset="100%" stopColor="var(--status-info)" stopOpacity={0.1} />
              </radialGradient>
              <radialGradient id="warningGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="70%" stopColor="var(--status-warning)" stopOpacity={0.02} />
                <stop offset="100%" stopColor="var(--status-warning)" stopOpacity={0.15} />
              </radialGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <PolarGrid gridType="circle" stroke="var(--ui-border)" strokeDasharray="2 4" strokeWidth={1} />
            
            <PolarRadiusAxis
              domain={[0, 100]}
              tickCount={5}
              axisLine={false}
              tick={{ fill: "var(--ui-text-muted)", fontSize: 9, fontWeight: 600 }}
              orientation="middle"
            />

            <PolarAngleAxis
              dataKey="metric"
              tick={(props: any) => {
                const { x, y, payload } = props;
                const item = radarData.find((d) => d.metric === payload.value);
                
                return (
                  <g transform={`translate(${x},${y})`}>
                    <rect x={-45} y={-16} width={90} height={34} rx={6} fill="var(--ui-panel)" fillOpacity={0.7} stroke="var(--ui-border)" strokeWidth={1} />
                    <text x={0} y={-1} dy={0} textAnchor="middle" fill="var(--ui-text)" fontSize={10} fontWeight={700} className="uppercase tracking-widest drop-shadow-md">
                      {payload.value}
                    </text>
                    <text x={0} y={11} dy={0} textAnchor="middle" fill="var(--status-info)" fontSize={10} fontWeight={700} className="tabular-nums drop-shadow-md">
                      {item ? `${item.rawValue} ${item.unit}` : ""}
                    </text>
                  </g>
                );
              }}
            />
            
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--status-info)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            
            {/* Warning Geometry Contour */}
            <Radar
              name="Warning Boundary"
              dataKey="warning"
              stroke="var(--status-warning)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#warningGlow)"
            />
            
            {/* Live Data Geometry */}
            <Radar
              name="Real-time Balance"
              dataKey="score"
              stroke="var(--status-info)"
              strokeWidth={2.5}
              fill="url(#radarGlow)"
              style={{ filter: "drop-shadow(0px 0px 8px rgba(59,130,246,0.6))" }}
              activeDot={{ r: 5, fill: "#fff", stroke: "var(--status-info)", strokeWidth: 3, filter: "url(#neonGlow)" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
