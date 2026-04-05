import { useState } from "react";
import type { GeneratedAlert } from "../types/telemetry";

interface AlertsSummaryCardProps {
  alerts: GeneratedAlert[];
}

export default function AlertsSummaryCard({ alerts }: AlertsSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 3);
  const alertLabel = alerts.length === 1 ? "alert" : "alerts";

  return (
    <article className="flex flex-col rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5 text-[var(--ui-text)] shadow-[var(--ui-shadow)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--ui-border)] pb-3">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-[var(--ui-text-muted)] uppercase">
          Alerts Summary
        </h2>
        <span className="rounded-full border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--ui-text)]">
          {alerts.length} {alertLabel} active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {alerts.length > 0 ? (
          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <div
                key={`${alert.code}-${alert.message}`}
                className={`rounded-2xl border p-3 ${
                  alert.severity === "critical"
                    ? "border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10"
                    : alert.severity === "warning"
                      ? "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10"
                      : "border-[var(--status-info)]/40 bg-[var(--status-info)]/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      alert.severity === "critical"
                        ? "bg-[var(--status-critical)]"
                        : alert.severity === "warning"
                          ? "bg-[var(--status-warning)]"
                          : "bg-[var(--status-info)]"
                    }`}
                  />
                  <p className="text-xs font-semibold tracking-wide uppercase">
                    {alert.code.replaceAll("_", " ")}
                  </p>
                </div>
                <p className="mt-2 ml-4 text-sm font-medium text-[var(--ui-text)]/90">
                  {alert.message}
                </p>
              </div>
            ))}

            {alerts.length > 3 && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-2 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-panel-muted)] px-3 py-2 text-xs font-semibold text-[var(--ui-text)] transition hover:bg-[var(--ui-panel-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-border)]"
              >
                {expanded
                  ? "Show fewer alerts"
                  : `Show ${alerts.length - 3} more`}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-[var(--status-normal)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-2 opacity-80"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm font-medium">No active alerts</p>
            <p className="mt-1 text-xs opacity-70">System running nominally</p>
          </div>
        )}
      </div>
    </article>
  );
}
