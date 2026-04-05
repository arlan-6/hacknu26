import { useEffect, useMemo, useState } from "react";
import { createTelemetrySocket, type ConnectionState } from "./lib/ws";
import { MetricCard } from "./components/MetricCard";
import { SafetyRadar } from "./components/SafetyRadar";
import {
  isPressureCritical,
  isSpeedCritical,
  isTempCritical,
  isVoltageCritical,
} from "./lib/safety";
import type { TelemetryPayload } from "./types/telemetry";
import TrainImage from "./components/TrainImage";
import AlertsSummaryCard from "./components/AlertsSummaryCard";

type ThemeMode = "dark" | "light" | "ops";

const THEME_STORAGE_KEY = "kz8a-theme";
const THEME_ORDER: ThemeMode[] = ["dark", "light", "ops"];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getHealthTone(index: number): "critical" | "warning" | "normal" {
  if (index < 50) {
    return "critical";
  }
  if (index < 80) {
    return "warning";
  }
  return "normal";
}

function getLatencyTone(
  latencyMs: number | undefined,
): "critical" | "warning" | "normal" {
  if (latencyMs === undefined) {
    return "normal";
  }
  if (latencyMs >= 180) {
    return "critical";
  }
  if (latencyMs >= 100) {
    return "warning";
  }
  return "normal";
}

function App() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [trains, setTrains] = useState<Record<string, TelemetryPayload>>({});
  const [messageCount, setMessageCount] = useState(0);
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [metricHistory, setMetricHistory] = useState<Record<string, { speed: number[]; temp: number[]; pressure: number[]; voltage: number[]; }>>({});
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "ops") {
      return stored;
    }
    return "dark";
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme !== "light");
  }, [theme]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const ws = createTelemetrySocket({
      onStateChange: setConnectionState,
      onMessage: (payload) => {
        setMessageCount((prev) => prev + 1);
        setTrains((prev) => ({
          ...prev,
          [payload.locomotive.id]: payload,
        }));
        
        setMetricHistory((prev) => {
          const id = payload.locomotive.id;
          const current = prev[id] || { speed: [], temp: [], pressure: [], voltage: [] };
          // Keep sliding window of last 30 points for fluid AreaCharts
          return {
            ...prev,
            [id]: {
              speed: [...current.speed.slice(-29), payload.metrics.speed_kmh],
              temp: [...current.temp.slice(-29), payload.technical.temperature_c.engine_2],
              pressure: [...current.pressure.slice(-29), payload.technical.pressure_kpa.brake_system],
              voltage: [...current.voltage.slice(-29), payload.energy.traction.voltage_v],
            }
          };
        });
      },
    });

    return () => ws.close();
  }, []);

  useEffect(() => {
    console.info("[telemetry-ui] connection state", { connectionState });
  }, [connectionState]);

  const sortedTrains = useMemo(
    () =>
      Object.values(trains).sort((a, b) =>
        a.locomotive.id.localeCompare(b.locomotive.id),
      ),
    [trains],
  );

  useEffect(() => {
    if (sortedTrains.length === 0) {
      setSelectedTrainId(null);
      return;
    }

    if (!selectedTrainId || !trains[selectedTrainId]) {
      setSelectedTrainId(sortedTrains[0].locomotive.id);
    }
  }, [selectedTrainId, sortedTrains, trains]);

  const focusedTrain = selectedTrainId
    ? (trains[selectedTrainId] ?? null)
    : (sortedTrains[0] ?? null);
  const healthIndex = focusedTrain?.metrics.health.index ?? 0;
  const healthTone = getHealthTone(healthIndex);
  const ringColor =
    healthTone === "critical"
      ? "#ef4444"
      : healthTone === "warning"
        ? "#facc15"
        : "#22c55e";
  const recommendation =
    healthTone === "critical"
      ? "Reduce traction immediately and cool engine 2."
      : healthTone === "warning"
        ? "Monitor brake pressure and voltage fluctuations."
        : "System operating in nominal range.";

  const nextThemeLabel =
    theme === "dark" ? "Light" : theme === "light" ? "Operations" : "Dark";

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  };

  const topFactors = focusedTrain?.metrics.health.top_factors.slice(0, 3) ?? [];
  const latencyTone = getLatencyTone(focusedTrain?.system.latency_ms);
  const priorityIssue =
    focusedTrain?.alerts.items[0]?.message ??
    focusedTrain?.metrics.health.description ??
    "No dominant issue detected.";

  const actionNow =
    healthTone === "critical"
      ? [
        "Reduce traction to 60%.",
        "Inspect engine 2 cooling loop.",
        "Re-check brake pressure in 3 minutes.",
      ]
      : healthTone === "warning"
        ? [
          "Maintain current speed profile.",
          "Watch brake and voltage drift.",
          "Prepare intervention if index falls below 70.",
        ]
        : ["Continue route plan.", "Run periodic checks every 10 minutes."];

  const subsystemBadges = [
    {
      label: "Engine",
      critical: isTempCritical(
        focusedTrain?.technical.temperature_c.engine_2 ?? 0,
      ),
    },
    {
      label: "Brakes",
      critical: isPressureCritical(
        focusedTrain?.technical.pressure_kpa.brake_system ?? 0,
      ),
    },
    {
      label: "Electrical",
      critical: isVoltageCritical(focusedTrain?.energy.traction.voltage_v ?? 0),
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--ui-bg)] px-4 py-6 text-[var(--ui-text)] transition-colors duration-300 md:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_10%,var(--ui-glow),transparent_38%)]" />
      <div className="mx-auto w-full">
        <header className="sticky top-4 z-30 mb-5 flex flex-col items-start justify-between gap-4 rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-bg)]/85 px-4 py-3 shadow-[var(--ui-shadow)] backdrop-blur md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--status-info)]/40 bg-[var(--status-info)]/10 text-[var(--status-info)]">
              A
            </span>
            <h1 className="text-xl font-semibold tracking-[0.08em] uppercase md:text-2xl">
              KZ8A Digital Twin
            </h1>
            <span className="text-sm text-[var(--status-info)]">V2.1</span>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 text-sm"
            role="status"
          >
            <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1 font-semibold text-[var(--ui-text-muted)]">
              {formatTime(currentTime)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 font-semibold uppercase ${connectionState === "connected"
                  ? "border-[var(--status-normal)]/40 bg-[var(--status-normal)]/15 text-[var(--status-normal)]"
                  : connectionState === "connecting"
                    ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                    : "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                }`}
            >
              WS {connectionState}
            </span>
            <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1 text-[var(--ui-text-muted)]">
              Msgs {messageCount}
            </span>
            <span
              className={`rounded-full border px-3 py-1 ${latencyTone === "critical"
                  ? "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                  : latencyTone === "warning"
                    ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                    : "border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--status-info)]"
                }`}
            >
              Latency {focusedTrain?.system.latency_ms ?? "--"} ms
            </span>
            {sortedTrains.length > 0 && (
              <label className="flex items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1">
                <span className="text-[var(--ui-text-muted)]">Train</span>
                <select
                  className="bg-transparent text-[var(--ui-text)] outline-none"
                  value={selectedTrainId ?? sortedTrains[0].locomotive.id}
                  onChange={(event) => setSelectedTrainId(event.target.value)}
                >
                  {sortedTrains.map((train) => (
                    <option
                      key={train.locomotive.id}
                      value={train.locomotive.id}
                    >
                      {train.locomotive.id}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={cycleTheme}
              className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1 font-semibold text-[var(--ui-text)] transition hover:bg-[var(--ui-panel-accent)]"
            >
              Theme: {theme} {"->"} {nextThemeLabel}
            </button>
          </div>
        </header>

        {!focusedTrain && (
          <section className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-8 text-center shadow-[var(--ui-shadow)] backdrop-blur">
            <p className="text-lg text-[var(--ui-text-muted)]">
              Waiting for telemetry stream...
            </p>
          </section>
        )}

        {focusedTrain && (
          <div className="grid gap-6 xl:grid-cols-[380px_1fr] items-start">
            {/* Sidebar Monitoring Panel */}
            <aside className="xl:sticky xl:top-28 flex flex-col gap-6">
              <article className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 shadow-[var(--ui-shadow)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--ui-text-muted)] uppercase">
                      Health Index
                    </p>
                    <p className="mt-3 text-6xl leading-none font-semibold tabular-nums">
                      {healthIndex}
                    </p>
                    <p
                      className={`mt-2 text-sm font-semibold tracking-[0.16em] uppercase ${healthTone === "critical"
                          ? "text-[var(--status-critical)]"
                          : healthTone === "warning"
                            ? "text-[var(--status-warning)]"
                            : "text-[var(--status-normal)]"
                        }`}
                    >
                      {focusedTrain.metrics.health.level}
                    </p>
                  </div>

                  <div className="relative h-34 w-34 shrink-0">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(${ringColor} ${healthIndex}%, color-mix(in srgb, var(--ui-text-muted) 20%, transparent) 0)`,
                      }}
                    />
                    <div className="absolute inset-[12px] grid place-items-center rounded-full bg-[var(--ui-panel-muted)] text-center">
                      <span className="text-2xl font-semibold tabular-nums">
                        {healthIndex}
                      </span>
                      <span className="text-[10px] tracking-[0.18em] text-[var(--ui-text-muted)] uppercase">
                        score
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[var(--ui-text-muted)] uppercase">
                    Immediate Status
                  </p>
                  <p className="mt-2 text-sm text-[var(--ui-text)]">
                    {priorityIssue}
                  </p>
                </div>
              </article>

              <AlertsSummaryCard train={focusedTrain} />
            </aside>

            {/* Main Content Area */}
            <section className="flex flex-col gap-6 w-full min-w-0">
              {/* Top layer: Locomotive Live View (Priority 1) */}
              <TrainImage
                className="w-full rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] shadow-[var(--ui-shadow)]"
                temperatureC={focusedTrain.technical.temperature_c.engine_2}
                brakePressureKpa={
                  focusedTrain.technical.pressure_kpa.brake_system
                }
                voltageV={focusedTrain.energy.traction.voltage_v}
                theme={theme}
                showEngineFault={isTempCritical(
                  focusedTrain.technical.temperature_c.engine_2,
                )}
                showBrakeFault={isPressureCritical(
                  focusedTrain.technical.pressure_kpa.brake_system,
                )}
                showElectricalFault={isVoltageCritical(
                  focusedTrain.energy.traction.voltage_v,
                )}
              />

              {/* Middle layer: Recommendation & Operational context row */}
              <section className="grid gap-5 xl:min-h-[36vh] lg:grid-cols-2">
                <article className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 shadow-[var(--ui-shadow)] flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-[var(--ui-text-muted)] uppercase">
                      Primary Recommendation
                    </p>
                    <h3 className="mt-4 text-2xl font-semibold text-[var(--status-info)]">
                      {healthTone === "critical"
                        ? "Reduce Traction"
                        : "Stabilize Conditions"}
                    </h3>
                    <dl className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 text-sm">
                      <div>
                        <dt className="text-[var(--ui-text-muted)]">Action</dt>
                        <dd className="font-medium">{recommendation}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--ui-text-muted)]">Reason</dt>
                        <dd className="font-medium">{priorityIssue}</dd>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                        <dt className="text-[var(--ui-text-muted)]">
                          Expected recovery
                        </dt>
                        <dd className="font-medium">4.2 min (estimate)</dd>
                      </div>
                    </dl>
                  </div>

                  <ol className="mt-6 flex flex-col gap-2 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4 text-sm">
                    {actionNow.map((item, idx) => (
                      <li key={item} className="flex gap-3 items-center bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-xl px-4 py-3 shadow-[var(--ui-shadow)]">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[var(--status-info)]/10 text-[var(--status-info)] font-bold">
                          {idx + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </article>

                <article className="flex flex-col gap-4 rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 shadow-[var(--ui-shadow)] min-h-0">
                  <SafetyRadar
                    speedKmh={focusedTrain.metrics.speed_kmh}
                    pressureKpa={
                      focusedTrain.technical.pressure_kpa.brake_system
                    }
                    tempC={focusedTrain.technical.temperature_c.engine_2}
                    voltageV={focusedTrain.energy.traction.voltage_v}
                    currentA={focusedTrain.energy.traction.current_a}
                    healthIndex={focusedTrain.metrics.health.index}
                  />

                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--ui-text-muted)] uppercase">
                      System Insight
                    </p>
                    <p className="mt-2 text-sm text-[var(--ui-text)]">
                      {topFactors.length > 1
                        ? "Impact is spread across multiple subsystems. Prioritize the highest-severity contributor first."
                        : "Impact is localized. Targeted intervention should recover index quickly."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {subsystemBadges.map((badge) => (
                        <span
                          key={badge.label}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${badge.critical
                              ? "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                              : "border-[var(--status-normal)]/40 bg-[var(--status-normal)]/15 text-[var(--status-normal)]"
                            }`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-[var(--ui-text-muted)]">
                      {topFactors.length === 0 && (
                        <li>No dominant factors detected.</li>
                      )}
                      {topFactors.map((factor) => (
                        <li
                          key={factor.name}
                          className="flex items-start gap-2"
                        >
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--status-warning)]" />
                          <span>
                            {factor.name.replaceAll("_", " ")} (
                            {factor.impact > 0 ? "+" : ""}
                            {factor.impact})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </section>

              {/* Bottom layer: Metrics row (Priority 3) */}
              <section className="grid gap-4 grid-cols-2 xl:grid-cols-4 min-h-[140px]">
                <MetricCard
                  label="Velocity"
                  value={focusedTrain.metrics.speed_kmh.toFixed(1)}
                  unit="km/h"
                  critical={isSpeedCritical(focusedTrain.metrics.speed_kmh)}
                  trend="up"
                  data={metricHistory[focusedTrain.locomotive.id]?.speed}
                  limit={120}
                />
                <MetricCard
                  label="Engine Temperature"
                  value={focusedTrain.technical.temperature_c.engine_2.toFixed(1)}
                  unit="°C"
                  critical={isTempCritical(focusedTrain.technical.temperature_c.engine_2)}
                  trend="up"
                  data={metricHistory[focusedTrain.locomotive.id]?.temp}
                  limit={95}
                />
                <MetricCard
                  label="Brake Pressure"
                  value={focusedTrain.technical.pressure_kpa.brake_system.toFixed(1)}
                  unit="kPa"
                  critical={isPressureCritical(focusedTrain.technical.pressure_kpa.brake_system)}
                  trend="down"
                  data={metricHistory[focusedTrain.locomotive.id]?.pressure}
                  limit={200}
                />
                <MetricCard
                  label="Electrical"
                  value={focusedTrain.energy.traction.voltage_v.toString()}
                  unit={`V (${focusedTrain.energy.traction.current_a} A)`}
                  critical={isVoltageCritical(focusedTrain.energy.traction.voltage_v)}
                  trend="stable"
                  data={metricHistory[focusedTrain.locomotive.id]?.voltage}
                  limit={24000}
                />
              </section>

              {/* Diagnostics */}
              <details className="group rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 shadow-[var(--ui-shadow)] mt-2">
                <summary className="cursor-pointer list-none text-sm font-semibold tracking-[0.14em] uppercase">
                  Diagnostics and System Details
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4 text-sm">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      System
                    </p>
                    <p className="mt-2">Connection: {connectionState}</p>
                    <p>Latency: {focusedTrain.system.latency_ms} ms</p>
                    <p>Version: {focusedTrain.system.version}</p>
                    <p>
                      WS Connected:{" "}
                      {focusedTrain.system.ws_connected ? "yes" : "no"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4 text-sm">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      Telemetry Snapshot
                    </p>
                    <p className="mt-2">Train: {focusedTrain.locomotive.id}</p>
                    <p>Status: {focusedTrain.locomotive.status}</p>
                    <p>Timestamp: {focusedTrain.locomotive.timestamp}</p>
                    <p>Alerts: {focusedTrain.alerts.count}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4 text-sm">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      Energy and Electrical
                    </p>
                    <p className="mt-2">
                      Used:{" "}
                      {focusedTrain.energy.consumption.used_kwh.toFixed(1)} kWh
                    </p>
                    <p>
                      Recuperated:{" "}
                      {focusedTrain.energy.consumption.recuperated_kwh.toFixed(
                        1,
                      )}{" "}
                      kWh
                    </p>
                    <p>
                      Pantograph:{" "}
                      {focusedTrain.technical.electrical.pantograph_up
                        ? "up"
                        : "down"}
                    </p>
                    <p>
                      Main switch:{" "}
                      {focusedTrain.technical.electrical.main_switch_on
                        ? "on"
                        : "off"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4 text-sm">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      Event Log
                    </p>
                    <ul className="mt-2 space-y-2">
                      {focusedTrain.alerts.items.length === 0 && (
                        <li>No recent events.</li>
                      )}
                      {focusedTrain.alerts.items.slice(0, 5).map((alert) => (
                        <li
                          key={`${alert.code}-diag`}
                          className="rounded-lg border border-[var(--ui-border)] px-2 py-1"
                        >
                          {alert.code.replaceAll("_", " ")} - {alert.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
