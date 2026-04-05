import type { TelemetryPayload } from "../types/telemetry";
import { useMemo, useState } from "react";

interface StatusProps {
  train: TelemetryPayload | null;
}

export default function Status({ train }: StatusProps) {
  const [expanded, setExpanded] = useState(false);

  if (!train) {
    return (
      <aside className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-[var(--ui-text-muted)] shadow-[var(--ui-shadow)] backdrop-blur">
        <h2 className="text-sm font-semibold tracking-[0.16em] uppercase">
          Active Alerts
        </h2>
        <p className="mt-4 text-sm">Waiting for telemetry stream...</p>
      </aside>
    );
  }

  const factors = useMemo(
    () => train.metrics.health.top_factors.slice(0, 6),
    [train],
  );
  const visibleAlerts = expanded
    ? train.alerts.items
    : train.alerts.items.slice(0, 3);
  const alertLabel = train.alerts.count === 1 ? "alert" : "alerts";

  return (
    <aside className="rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-[var(--ui-text)] shadow-[var(--ui-shadow)] backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-[0.16em] uppercase">
          Alerts
        </h2>
        <span className="rounded-full border border-[var(--status-info)]/40 bg-[var(--status-info)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--status-info)]">
          {train.alerts.count} {alertLabel}
        </span>
      </div>

      {train.alerts.items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleAlerts.map((alert) => (
            <div
              key={`${alert.code}-${alert.message}`}
              className={`rounded-2xl border p-3 ${
                alert.type === "critical"
                  ? "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10"
                  : alert.type === "warning"
                    ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10"
                    : "border-[var(--status-info)]/40 bg-[var(--status-info)]/10"
              }`}
            >
              <p className="text-sm font-semibold tracking-wide uppercase">
                {alert.code.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-sm text-[var(--ui-text)]/90">
                {alert.message}
              </p>
            </div>
          ))}

          {train.alerts.items.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] px-3 py-2 text-sm font-semibold text-[var(--ui-text)] transition hover:bg-[var(--ui-panel-accent)]"
            >
              {expanded
                ? "Show fewer alerts"
                : `Show ${train.alerts.items.length - 3} more`}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--status-normal)]">
          No active alerts
        </p>
      )}

      <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-[var(--ui-text-muted)] uppercase">
        Top Contributors
      </p>
      <ul className="mt-2 space-y-2 text-sm text-[var(--ui-text-muted)]">
        {factors.length === 0 && <li>System stable</li>}
        {factors.map((factor) => (
          <li key={factor.name} className="flex items-start gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]" />
            <span>
              {factor.name.replaceAll("_", " ")} ({factor.impact > 0 ? "+" : ""}
              {factor.impact})
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] px-3 py-2 text-sm text-[var(--ui-text-muted)]">
        Diagnostics: train {train.locomotive.id}
      </div>
    </aside>
  );
}
