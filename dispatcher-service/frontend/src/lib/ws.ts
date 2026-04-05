import type { DispatcherTelemetryEvent } from "../types/telemetry";

export type ConnectionState = "connecting" | "connected" | "disconnected";

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 8000;
const RECONNECT_JITTER_RATIO = 0.2;
const WS_LOG_PREFIX = "[telemetry-ws]";
const WS_DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_TELEMETRY_WS_DEBUG === "true";

interface TelemetrySocketOptions {
  onMessage: (payload: DispatcherTelemetryEvent) => void;
  onStateChange: (state: ConnectionState) => void;
}

type RawTelemetryAlert = {
  type: "info" | "warning" | "critical";
  code: string;
  message: string;
};

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

function isAlertItem(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.severity === "info" ||
      value.severity === "warning" ||
      value.severity === "critical") &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isRawTelemetryAlert(value: unknown): value is RawTelemetryAlert {
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

function isRawTelemetryPayload(
  value: unknown,
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const locomotive = value.locomotive;
  const metrics = value.metrics;
  const health = isRecord(metrics) ? metrics.health : null;

  return (
    isRecord(locomotive) &&
    typeof locomotive.id === "string" &&
    typeof locomotive.timestamp === "string" &&
    isRecord(metrics) &&
    typeof metrics.speed_kmh === "number" &&
    isRecord(health) &&
    typeof health.index === "number"
  );
}

function normalizeRawTelemetryPayload(
  value: Record<string, unknown>,
): DispatcherTelemetryEvent {
  const locomotive = isRecord(value.locomotive) ? value.locomotive : {};
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  const health = isRecord(metrics.health) ? metrics.health : {};
  const alerts = isRecord(value.alerts) ? value.alerts : {};
  const rawItems = Array.isArray(alerts.items) ? alerts.items : [];

  const generatedAlerts = rawItems.filter(isRawTelemetryAlert).map((item) => ({
    code: item.code,
    severity: item.type,
    message: item.message,
  }));

  const topFactors = Array.isArray(health.top_factors)
    ? health.top_factors
        .filter(isRecord)
        .map((factor) => factor.name)
        .filter((name): name is string => typeof name === "string")
    : [];

  const description =
    typeof health.description === "string" ? health.description : null;
  const explanation =
    topFactors.length > 0
      ? topFactors
      : description
        ? [description]
        : ["health derived from train payload"];

  const healthLevel =
    health.level === "normal" ||
    health.level === "warning" ||
    health.level === "critical"
      ? health.level
      : "normal";

  const payload: DispatcherTelemetryEvent["payload"] = {
    ...value,
    train_id: typeof locomotive.id === "string" ? locomotive.id : undefined,
    recorded_at:
      typeof locomotive.timestamp === "string"
        ? locomotive.timestamp
        : undefined,
  };

  return {
    payload,
    health: {
      health_index:
        typeof health.index === "number" ? Math.round(health.index) : 100,
      level: healthLevel,
      explanation,
    },
    generated_alerts: generatedAlerts,
  };
}

function isDispatcherTelemetryEvent(
  value: unknown,
): value is DispatcherTelemetryEvent {
  if (!isRecord(value)) {
    return false;
  }

  const payload = value.payload;
  const health = value.health;
  const generatedAlerts = value.generated_alerts;

  if (
    !isRecord(payload) ||
    !isRecord(health) ||
    !Array.isArray(generatedAlerts)
  ) {
    return false;
  }

  return (
    typeof health.health_index === "number" &&
    (health.level === "normal" ||
      health.level === "warning" ||
      health.level === "critical") &&
    Array.isArray(health.explanation) &&
    health.explanation.every((item) => typeof item === "string") &&
    generatedAlerts.every(isAlertItem)
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

function resolveWsUrls(): string[] {
  const fromEnvList = import.meta.env.VITE_TELEMETRY_WS_URLS;
  if (typeof fromEnvList === "string" && fromEnvList.trim().length > 0) {
    const urls = fromEnvList
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (urls.length > 0) {
      wsLog("info", "Using websocket URL list from env", { urls });
      return urls;
    }
  }

  const fromEnv = import.meta.env.VITE_TELEMETRY_WS_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    const envUrl = fromEnv.trim();
    wsLog("info", "Using websocket URL from env", { envUrl });
    return [envUrl];
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const urls = [
    `${protocol}://${window.location.host}/ws/telemetry`,
    `${protocol}://127.0.0.1:8001/ws/telemetry`,
    `${protocol}://127.0.0.1:8000/ws/telemetry`,
  ];
  wsLog("info", "Using fallback websocket URL list", { urls });
  return urls;
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
    const wsUrls = resolveWsUrls();
    const wsUrl = wsUrls[reconnectAttempts % wsUrls.length];

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
        if (isDispatcherTelemetryEvent(parsed)) {
          wsLog("debug", "Received telemetry payload", {
            trainId: parsed.payload.train_id,
            health: parsed.health.health_index,
          });
          options.onMessage(parsed);
          return;
        }

        if (isRawTelemetryPayload(parsed)) {
          const normalized = normalizeRawTelemetryPayload(parsed);
          wsLog("warn", "Received raw train payload; normalizing for UI", {
            trainId: normalized.payload.train_id,
          });
          options.onMessage(normalized);
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
