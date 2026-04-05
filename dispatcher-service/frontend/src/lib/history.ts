import type { DispatcherTelemetryEvent } from "../types/telemetry";

export interface TrainHistoryOptions {
  minutes?: number;
  limit?: number;
  signal?: AbortSignal;
}

function resolveApiBaseUrls(): string[] {
  const fromEnvList = import.meta.env.VITE_DISPATCHER_API_URLS;
  if (typeof fromEnvList === "string" && fromEnvList.trim().length > 0) {
    const urls = fromEnvList
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => item.replace(/\/$/, ""));

    if (urls.length > 0) {
      return urls;
    }
  }

  const fromEnv = import.meta.env.VITE_DISPATCHER_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return [fromEnv.trim().replace(/\/$/, "")];
  }

  const protocol = window.location.protocol;
  const { hostname } = window.location;
  const resolvedHost =
    hostname === "localhost" || hostname === "::1" ? "127.0.0.1" : hostname;

  return [
    `${protocol}//${resolvedHost}:8001`,
    `${protocol}//${resolvedHost}:8000`,
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  return (
    isRecord(payload) &&
    isRecord(health) &&
    typeof health.health_index === "number" &&
    (health.level === "normal" ||
      health.level === "warning" ||
      health.level === "critical") &&
    Array.isArray(health.explanation) &&
    health.explanation.every((item) => typeof item === "string") &&
    Array.isArray(generatedAlerts)
  );
}

export async function getTrainHistory(
  trainId: string,
  options: TrainHistoryOptions = {},
): Promise<DispatcherTelemetryEvent[]> {
  const minutes = options.minutes ?? 10;
  const limit = options.limit ?? 1000;
  const path = `/trains/${encodeURIComponent(trainId)}/history`;

  let lastError: unknown = null;
  for (const baseUrl of resolveApiBaseUrls()) {
    const url = new URL(path, baseUrl);
    url.searchParams.set("minutes", String(minutes));
    url.searchParams.set("limit", String(limit));

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load train history: ${response.status}`);
      }

      const body = (await response.json()) as unknown;
      if (!isRecord(body) || !Array.isArray(body.data)) {
        return [];
      }

      return body.data.filter(isDispatcherTelemetryEvent);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load train history");
}

export async function getLatestTrains(
  signal?: AbortSignal,
): Promise<DispatcherTelemetryEvent[]> {
  let lastError: unknown = null;
  for (const baseUrl of resolveApiBaseUrls()) {
    const url = new URL("/trains/latest", baseUrl);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load latest trains: ${response.status}`);
      }

      const body = (await response.json()) as unknown;
      if (!isRecord(body) || !Array.isArray(body.data)) {
        return [];
      }

      return body.data.filter(isDispatcherTelemetryEvent);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load latest trains");
}
