import { useEffect, useMemo, useState } from "react";
import { createTelemetrySocket, type ConnectionState } from "./lib/ws";
import type { DispatcherTelemetryEvent } from "./types/telemetry";
import { MetricCard } from "./components/MetricCard";
import { SafetyRadar } from "./components/SafetyRadar";
import TrainImage from "./components/TrainImage";
import AlertsSummaryCard from "./components/AlertsSummaryCard";
import { getLatestTrains, getTrainHistory } from "./lib/history";
import {
  isPressureCritical,
  isSpeedCritical,
  isTempCritical,
  isVoltageCritical,
} from "./lib/safety";

type ThemeMode = "dark" | "light" | "ops";

type HistoryBucket = {
  speed: number[];
  temp: number[];
  pressure: number[];
  voltage: number[];
};

type DashboardTrain = {
  id: string;
  model: string;
  status: string;
  timestamp: string;
  speedKmh: number | null;
  pressureKpa: number | null;
  tempC: number | null;
  voltageV: number | null;
  currentA: number | null;
  latencyMs: number | null;
  sectionKm: number | null;
  version: string;
  wsConnected: boolean | null;
  usedKwh: number | null;
  recuperatedKwh: number | null;
  pantographUp: boolean | null;
  mainSwitchOn: boolean | null;
};

const THEME_STORAGE_KEY = "kz8a-theme";
const THEME_ORDER: ThemeMode[] = ["dark", "light", "ops"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getTrainId(event: DispatcherTelemetryEvent): string {
  if (typeof event.payload.train_id === "string" && event.payload.train_id) {
    return event.payload.train_id;
  }

  const locomotive = asRecord(event.payload.locomotive);
  const nestedId = locomotive?.id;
  return typeof nestedId === "string" ? nestedId : "unknown";
}

function getNestedNumber(
  root: Record<string, unknown>,
  path: string[],
): number | null {
  let cursor: unknown = root;
  for (const segment of path) {
    const record = asRecord(cursor);
    if (!record) {
      return null;
    }
    cursor = record[segment];
  }
  return typeof cursor === "number" ? cursor : null;
}

function getNestedString(
  root: Record<string, unknown>,
  path: string[],
): string | null {
  let cursor: unknown = root;
  for (const segment of path) {
    const record = asRecord(cursor);
    if (!record) {
      return null;
    }
    cursor = record[segment];
  }
  return typeof cursor === "string" ? cursor : null;
}

function getNestedBoolean(
  root: Record<string, unknown>,
  path: string[],
): boolean | null {
  let cursor: unknown = root;
  for (const segment of path) {
    const record = asRecord(cursor);
    if (!record) {
      return null;
    }
    cursor = record[segment];
  }
  return typeof cursor === "boolean" ? cursor : null;
}

function toDashboardTrain(
  event: DispatcherTelemetryEvent,
  trainId: string,
): DashboardTrain {
  const payload = event.payload;

  return {
    id: trainId,
    model: getNestedString(payload, ["locomotive", "model"]) ?? "n/a",
    status:
      getNestedString(payload, ["locomotive", "status"]) ?? event.health.level,
    timestamp:
      (typeof payload.recorded_at === "string" ? payload.recorded_at : null) ??
      getNestedString(payload, ["locomotive", "timestamp"]) ??
      "n/a",
    speedKmh: getNestedNumber(payload, ["metrics", "speed_kmh"]),
    pressureKpa: getNestedNumber(payload, [
      "technical",
      "pressure_kpa",
      "brake_system",
    ]),
    tempC: getNestedNumber(payload, ["technical", "temperature_c", "engine_2"]),
    voltageV: getNestedNumber(payload, ["energy", "traction", "voltage_v"]),
    currentA: getNestedNumber(payload, ["energy", "traction", "current_a"]),
    latencyMs: getNestedNumber(payload, ["system", "latency_ms"]),
    sectionKm: getNestedNumber(payload, ["navigation", "section_km"]),
    version: getNestedString(payload, ["system", "version"]) ?? "n/a",
    wsConnected: getNestedBoolean(payload, ["system", "ws_connected"]),
    usedKwh: getNestedNumber(payload, ["energy", "consumption", "used_kwh"]),
    recuperatedKwh: getNestedNumber(payload, [
      "energy",
      "consumption",
      "recuperated_kwh",
    ]),
    pantographUp: getNestedBoolean(payload, [
      "technical",
      "electrical",
      "pantograph_up",
    ]),
    mainSwitchOn: getNestedBoolean(payload, [
      "technical",
      "electrical",
      "main_switch_on",
    ]),
  };
}

function appendHistoryEvent(
  previous: HistoryBucket,
  event: DispatcherTelemetryEvent,
  trainId: string,
): HistoryBucket {
  const train = toDashboardTrain(event, trainId);
  return {
    speed:
      train.speedKmh === null
        ? previous.speed
        : [...previous.speed.slice(-29), train.speedKmh],
    temp:
      train.tempC === null
        ? previous.temp
        : [...previous.temp.slice(-29), train.tempC],
    pressure:
      train.pressureKpa === null
        ? previous.pressure
        : [...previous.pressure.slice(-29), train.pressureKpa],
    voltage:
      train.voltageV === null
        ? previous.voltage
        : [...previous.voltage.slice(-29), train.voltageV],
  };
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
  latencyMs: number | null,
): "critical" | "warning" | "normal" {
  if (latencyMs === null) {
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetric(value: number | null, digits = 1): string {
  if (value === null) {
    return "--";
  }
  return value.toFixed(digits);
}

function App() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [trains, setTrains] = useState<
    Record<string, DispatcherTelemetryEvent>
  >({});
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [metricHistory, setMetricHistory] = useState<
    Record<string, HistoryBucket>
  >({});
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
        const trainId = getTrainId(payload);

        setMessageCount((prev) => prev + 1);
        setTrains((prev) => ({
          ...prev,
          [trainId]: payload,
        }));

        setMetricHistory((prev) => {
          const current = prev[trainId] ?? {
            speed: [],
            temp: [],
            pressure: [],
            voltage: [],
          };
          return {
            ...prev,
            [trainId]: appendHistoryEvent(current, payload, trainId),
          };
        });
      },
    });

    return () => ws.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const hydrateLatest = async () => {
      try {
        const latest = await getLatestTrains(controller.signal);
        if (latest.length === 0) {
          return;
        }

        setTrains((prev) => {
          const next = { ...prev };
          for (const event of latest) {
            const trainId = getTrainId(event);
            next[trainId] = event;
          }
          return next;
        });

        setMetricHistory((prev) => {
          const next = { ...prev };
          for (const event of latest) {
            const trainId = getTrainId(event);
            const current = next[trainId] ?? {
              speed: [],
              temp: [],
              pressure: [],
              voltage: [],
            };
            next[trainId] = appendHistoryEvent(current, event, trainId);
          }
          return next;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[latest] failed to load latest trains", error);
        }
      }
    };

    void hydrateLatest();
    const timerId = window.setInterval(() => {
      void hydrateLatest();
    }, 3000);

    return () => {
      controller.abort();
      window.clearInterval(timerId);
    };
  }, []);

  const sortedTrains = useMemo(
    () =>
      Object.entries(trains)
        .map(([trainId, event]) => ({
          trainId,
          event,
          dashboard: toDashboardTrain(event, trainId),
        }))
        .sort((a, b) => a.trainId.localeCompare(b.trainId)),
    [trains],
  );

  useEffect(() => {
    if (sortedTrains.length === 0) {
      setSelectedTrainId(null);
      return;
    }

    if (!selectedTrainId || !trains[selectedTrainId]) {
      setSelectedTrainId(sortedTrains[0].trainId);
    }
  }, [selectedTrainId, sortedTrains, trains]);

  useEffect(() => {
    if (!selectedTrainId) {
      return;
    }

    const controller = new AbortController();
    const seedHistory = async () => {
      try {
        const history = await getTrainHistory(selectedTrainId, {
          minutes: 10,
          limit: 200,
          signal: controller.signal,
        });

        setMetricHistory((prev) => {
          let bucket: HistoryBucket = {
            speed: [],
            temp: [],
            pressure: [],
            voltage: [],
          };

          const ordered = [...history].reverse();
          for (const event of ordered) {
            bucket = appendHistoryEvent(bucket, event, selectedTrainId);
          }

          if (bucket.speed.length === 0 && bucket.temp.length === 0) {
            return prev;
          }

          const existing = prev[selectedTrainId];
          if (!existing) {
            return { ...prev, [selectedTrainId]: bucket };
          }

          return {
            ...prev,
            [selectedTrainId]: {
              speed: [...bucket.speed, ...existing.speed].slice(-30),
              temp: [...bucket.temp, ...existing.temp].slice(-30),
              pressure: [...bucket.pressure, ...existing.pressure].slice(-30),
              voltage: [...bucket.voltage, ...existing.voltage].slice(-30),
            },
          };
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[history] failed to load train history", error);
        }
      }
    };

    void seedHistory();
    return () => controller.abort();
  }, [selectedTrainId]);

  const focused = useMemo(() => {
    if (sortedTrains.length === 0 || selectedTrainId === null) {
      return null;
    }
    const matched = sortedTrains.find(
      (item) => item.trainId === selectedTrainId,
    );
    return matched ?? sortedTrains[0];
  }, [selectedTrainId, sortedTrains]);

  const train = focused?.dashboard ?? null;
  const health = focused?.event.health ?? null;
  const alerts = focused?.event.generated_alerts ?? [];

  const healthIndex = health?.health_index ?? 0;
  const healthTone = getHealthTone(healthIndex);
  const latencyTone = getLatencyTone(train?.latencyMs ?? null);
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

  const topFactors =
    health?.explanation.slice(0, 3).map((factor, idx) => ({
      name: factor,
      impact: Math.max(5, Math.round((100 - healthIndex) / (idx + 1))),
    })) ?? [];

  const priorityIssue =
    alerts[0]?.message ??
    health?.explanation[0] ??
    "No dominant issue detected.";

  const nextThemeLabel =
    theme === "dark" ? "Light" : theme === "light" ? "Operations" : "Dark";

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  };

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
              KZ8A Dispatcher Twin
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
              className={`rounded-full border px-3 py-1 font-semibold uppercase ${
                connectionState === "connected"
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
              className={`rounded-full border px-3 py-1 ${
                latencyTone === "critical"
                  ? "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                  : latencyTone === "warning"
                    ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                    : "border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--status-info)]"
              }`}
            >
              Latency {train?.latencyMs ?? "--"} ms
            </span>

            {sortedTrains.length > 0 && (
              <label className="flex items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-1">
                <span className="text-[var(--ui-text-muted)]">Train</span>
                <select
                  className="bg-transparent text-[var(--ui-text)] outline-none"
                  value={selectedTrainId ?? sortedTrains[0].trainId}
                  onChange={(event) => setSelectedTrainId(event.target.value)}
                >
                  {sortedTrains.map((item) => (
                    <option key={item.trainId} value={item.trainId}>
                      {item.trainId}
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

        {!train && (
          <section className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-8 text-center shadow-[var(--ui-shadow)] backdrop-blur">
            <p className="text-lg text-[var(--ui-text-muted)]">
              Waiting for telemetry stream...
            </p>
          </section>
        )}

        {train && health && (
          <div className="grid items-start gap-6 xl:grid-cols-[380px_1fr]">
            <aside className="flex flex-col gap-6 xl:sticky xl:top-28">
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
                      className={`mt-2 text-sm font-semibold tracking-[0.16em] uppercase ${
                        healthTone === "critical"
                          ? "text-[var(--status-critical)]"
                          : healthTone === "warning"
                            ? "text-[var(--status-warning)]"
                            : "text-[var(--status-normal)]"
                      }`}
                    >
                      {health.level}
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

              <AlertsSummaryCard alerts={alerts} />
            </aside>

            <section className="flex w-full min-w-0 flex-col gap-6">
              <TrainImage
                className="w-full rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] shadow-[var(--ui-shadow)]"
                temperatureC={train.tempC ?? 0}
                brakePressureKpa={train.pressureKpa ?? 0}
                voltageV={train.voltageV ?? 0}
                theme={theme}
                showEngineFault={isTempCritical(train.tempC)}
                showBrakeFault={isPressureCritical(train.pressureKpa)}
                showElectricalFault={isVoltageCritical(train.voltageV)}
              />

              <section className="grid gap-5 lg:grid-cols-2 xl:min-h-[36vh]">
                <article className="flex flex-col justify-between rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 shadow-[var(--ui-shadow)]">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-[var(--ui-text-muted)] uppercase">
                      Primary Recommendation
                    </p>
                    <h3 className="mt-4 text-2xl font-semibold text-[var(--status-info)]">
                      {healthTone === "critical"
                        ? "Reduce Traction"
                        : "Stabilize Conditions"}
                    </h3>
                    <p className="mt-3 text-sm text-[var(--ui-text)]">
                      {recommendation}
                    </p>
                  </div>

                  <ul className="mt-6 space-y-2 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4 text-sm text-[var(--ui-text-muted)]">
                    {topFactors.length === 0 && (
                      <li>No dominant factors detected.</li>
                    )}
                    {topFactors.map((factor) => (
                      <li key={factor.name} className="flex items-start gap-2">
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--status-warning)]" />
                        <span>
                          {factor.name} ({factor.impact > 0 ? "+" : ""}
                          {factor.impact})
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>

                <SafetyRadar
                  speedKmh={train.speedKmh ?? 0}
                  pressureKpa={train.pressureKpa ?? 0}
                  tempC={train.tempC ?? 0}
                  voltageV={train.voltageV ?? 0}
                  currentA={train.currentA ?? 0}
                  healthIndex={healthIndex}
                />
              </section>

              <section className="grid min-h-[140px] grid-cols-2 gap-4 xl:grid-cols-4">
                <MetricCard
                  label="Velocity"
                  value={formatMetric(train.speedKmh)}
                  unit="km/h"
                  critical={isSpeedCritical(train.speedKmh)}
                  trend="up"
                  data={metricHistory[train.id]?.speed}
                  limit={120}
                />
                <MetricCard
                  label="Engine Temperature"
                  value={formatMetric(train.tempC)}
                  unit="°C"
                  critical={isTempCritical(train.tempC)}
                  trend="up"
                  data={metricHistory[train.id]?.temp}
                  limit={95}
                />
                <MetricCard
                  label="Brake Pressure"
                  value={formatMetric(train.pressureKpa)}
                  unit="kPa"
                  critical={isPressureCritical(train.pressureKpa)}
                  trend="down"
                  data={metricHistory[train.id]?.pressure}
                  limit={200}
                />
                <MetricCard
                  label="Electrical"
                  value={formatMetric(train.voltageV, 0)}
                  unit={`V (${formatMetric(train.currentA, 0)} A)`}
                  critical={isVoltageCritical(train.voltageV)}
                  trend="stable"
                  data={metricHistory[train.id]?.voltage}
                  limit={24000}
                />
              </section>

              <details className="group rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-4 shadow-[var(--ui-shadow)]">
                <summary className="cursor-pointer list-none text-sm font-semibold tracking-[0.14em] uppercase">
                  Diagnostics and System Details
                </summary>
                <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      System
                    </p>
                    <p className="mt-2">Connection: {connectionState}</p>
                    <p>Latency: {train.latencyMs ?? "--"} ms</p>
                    <p>Version: {train.version}</p>
                    <p>
                      WS Connected:{" "}
                      {train.wsConnected === null
                        ? "unknown"
                        : train.wsConnected
                          ? "yes"
                          : "no"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      Telemetry Snapshot
                    </p>
                    <p className="mt-2">Train: {train.id}</p>
                    <p>Model: {train.model}</p>
                    <p>Status: {train.status}</p>
                    <p>Timestamp: {train.timestamp}</p>
                    <p>Section: {formatMetric(train.sectionKm)} km</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      Energy and Electrical
                    </p>
                    <p className="mt-2">
                      Used: {formatMetric(train.usedKwh)} kWh
                    </p>
                    <p>Recuperated: {formatMetric(train.recuperatedKwh)} kWh</p>
                    <p>
                      Pantograph:{" "}
                      {train.pantographUp === null
                        ? "unknown"
                        : train.pantographUp
                          ? "up"
                          : "down"}
                    </p>
                    <p>
                      Main switch:{" "}
                      {train.mainSwitchOn === null
                        ? "unknown"
                        : train.mainSwitchOn
                          ? "on"
                          : "off"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] p-4">
                    <p className="text-xs tracking-[0.12em] text-[var(--ui-text-muted)] uppercase">
                      Event Log
                    </p>
                    <ul className="mt-2 space-y-2">
                      {alerts.length === 0 && <li>No recent events.</li>}
                      {alerts.slice(0, 5).map((alert) => (
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
