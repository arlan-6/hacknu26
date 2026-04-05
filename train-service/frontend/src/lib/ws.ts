import type { TelemetryPayload } from "../types/telemetry";

export type ConnectionState = "connecting" | "connected" | "disconnected";

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 8000;
const RECONNECT_JITTER_RATIO = 0.2;
const WS_LOG_PREFIX = "[telemetry-ws]";
const WS_DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_TELEMETRY_WS_DEBUG === "true";

interface TelemetrySocketOptions {
  onMessage: (payload: TelemetryPayload) => void;
  onStateChange: (state: ConnectionState) => void;
}

function wsLog(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  details?: unknown,
) {
  if (!WS_DEBUG_ENABLED) {
    return;
  }

  const logger = console[level] ?? console.log;
  if (details === undefined) {
    logger(`${WS_LOG_PREFIX} ${message}`);
    return;
  }

  logger(`${WS_LOG_PREFIX} ${message}`, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAlertItem(
  value: unknown,
): value is TelemetryPayload["alerts"]["items"][number] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.type === "info" ||
      value.type === "warning" ||
      value.type === "critical") &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isTelemetryPayload(value: unknown): value is TelemetryPayload {
  if (!isRecord(value)) {
    return false;
  }

  const locomotive = value.locomotive;
  const metrics = value.metrics;
  const energy = value.energy;
  const technical = value.technical;
  const alerts = value.alerts;
  const navigation = value.navigation;
  const system = value.system;

  if (
    !isRecord(locomotive) ||
    !isRecord(metrics) ||
    !isRecord(energy) ||
    !isRecord(technical) ||
    !isRecord(alerts) ||
    !isRecord(navigation) ||
    !isRecord(system)
  ) {
    return false;
  }

  const health = metrics.health;
  const traction = energy.traction;
  const consumption = energy.consumption;
  const temperature = technical.temperature_c;
  const pressure = technical.pressure_kpa;
  const electrical = technical.electrical;

  return (
    typeof locomotive.id === "string" &&
    typeof locomotive.model === "string" &&
    (locomotive.status === "online" ||
      locomotive.status === "offline" ||
      locomotive.status === "warning" ||
      locomotive.status === "critical") &&
    typeof locomotive.timestamp === "string" &&
    (typeof locomotive.fault_state === "string" ||
      locomotive.fault_state === null) &&
    typeof metrics.speed_kmh === "number" &&
    isRecord(health) &&
    typeof health.index === "number" &&
    (health.level === "normal" ||
      health.level === "warning" ||
      health.level === "critical") &&
    typeof health.description === "string" &&
    Array.isArray(health.top_factors) &&
    health.top_factors.every(
      (factor) =>
        isRecord(factor) &&
        typeof factor.name === "string" &&
        typeof factor.impact === "number",
    ) &&
    isRecord(traction) &&
    typeof traction.voltage_v === "number" &&
    typeof traction.current_a === "number" &&
    isRecord(consumption) &&
    typeof consumption.used_kwh === "number" &&
    typeof consumption.recuperated_kwh === "number" &&
    isRecord(temperature) &&
    typeof temperature.engine_1 === "number" &&
    typeof temperature.engine_2 === "number" &&
    typeof temperature.inverter === "number" &&
    isRecord(pressure) &&
    typeof pressure.brake_system === "number" &&
    typeof pressure.main_line === "number" &&
    isRecord(electrical) &&
    typeof electrical.pantograph_up === "boolean" &&
    typeof electrical.main_switch_on === "boolean" &&
    typeof electrical.frequency_hz === "number" &&
    typeof alerts.count === "number" &&
    Array.isArray(alerts.items) &&
    alerts.items.every(isAlertItem) &&
    typeof navigation.section_km === "number" &&
    typeof system.latency_ms === "number" &&
    typeof system.ws_connected === "boolean" &&
    typeof system.version === "string"
  );
}

function looksLikeTelemetryPayload(value: unknown): value is TelemetryPayload {
  if (!isRecord(value)) {
    return false;
  }

  const locomotive = value.locomotive;
  const metrics = value.metrics;
  const technical = value.technical;

  if (!isRecord(locomotive) || !isRecord(metrics) || !isRecord(technical)) {
    return false;
  }

  return (
    typeof locomotive.id === "string" &&
    typeof locomotive.status === "string" &&
    typeof metrics.speed_kmh === "number"
  );
}

function getReconnectDelayMs(attempt: number): number {
  const baseDelay = Math.min(
    BASE_RECONNECT_DELAY_MS * 2 ** attempt,
    MAX_RECONNECT_DELAY_MS,
  );
  const jitter = baseDelay * RECONNECT_JITTER_RATIO * Math.random();
  return Math.round(baseDelay + jitter);
}

function resolveWsUrl(): string {
  const fromEnv = import.meta.env.VITE_TELEMETRY_WS_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    const envUrl = fromEnv.trim();
    wsLog("info", "Using websocket URL from env", { envUrl });
    return envUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const { hostname } = window.location;
  const resolvedHost =
    hostname === "localhost" || hostname === "::1" ? "127.0.0.1" : hostname;
  const fallbackUrl = `${protocol}://${resolvedHost}:8000/ws/telemetry`;
  wsLog("info", "Using fallback websocket URL", { fallbackUrl });
  return fallbackUrl;
}

export function createTelemetrySocket(options: TelemetrySocketOptions) {
  let socket: WebSocket | null = null;
  let closedByClient = false;
  let reconnectAttempts = 0;
  let reconnectTimer: number | null = null;
  let initialConnectTimer: number | null = null;
  let connectionId = 0;

  const connect = () => {
    if (closedByClient) {
      return;
    }

    connectionId += 1;
    const currentId = connectionId;
    const wsUrl = resolveWsUrl();

    wsLog("info", "Connecting", {
      currentId,
      reconnectAttempts,
      wsUrl,
    });

    options.onStateChange("connecting");

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (currentId !== connectionId || closedByClient) {
        return;
      }

      reconnectAttempts = 0;
      wsLog("info", "Connected", { currentId });
      options.onStateChange("connected");
    };

    socket.onmessage = (event) => {
      if (currentId !== connectionId || closedByClient) {
        return;
      }

      if (typeof event.data !== "string") {
        wsLog("warn", "Ignoring non-string websocket frame", {
          dataType: typeof event.data,
        });
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as unknown;
        if (isTelemetryPayload(parsed)) {
          wsLog("debug", "Received telemetry payload", {
            trainId: parsed.locomotive.id,
            status: parsed.locomotive.status,
          });
          options.onMessage(parsed);
          return;
        }

        if (looksLikeTelemetryPayload(parsed)) {
          wsLog(
            "warn",
            "Received telemetry payload that failed strict validation",
            {
              trainId: parsed.locomotive.id,
              status: parsed.locomotive.status,
            },
          );
          options.onMessage(parsed);
          return;
        }

        wsLog("warn", "Ignoring websocket payload with unexpected shape", {
          sample: event.data.slice(0, 200),
        });
      } catch {
        wsLog("warn", "Ignoring malformed websocket payload", {
          sample: event.data.slice(0, 200),
        });
      }
    };

    socket.onclose = (event) => {
      if (currentId !== connectionId) {
        return;
      }

      if (closedByClient) {
        wsLog("info", "Websocket closed by client", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        return;
      }

      options.onStateChange("disconnected");

      reconnectAttempts += 1;
      const delay = getReconnectDelayMs(reconnectAttempts);
      wsLog("warn", "Websocket disconnected, scheduling reconnect", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        reconnectAttempts,
        delay,
      });

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      reconnectTimer = window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      if (currentId !== connectionId || closedByClient) {
        return;
      }

      wsLog("error", "Websocket error event");
      socket?.close();
    };
  };

  // In React StrictMode dev, effects mount/unmount once immediately.
  // Deferring the first connect avoids opening then instantly closing a socket.
  initialConnectTimer = window.setTimeout(connect, 0);

  return {
    close: () => {
      wsLog("info", "Closing websocket client by request");
      closedByClient = true;
      if (initialConnectTimer !== null) {
        window.clearTimeout(initialConnectTimer);
        initialConnectTimer = null;
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
    },
  };
}
