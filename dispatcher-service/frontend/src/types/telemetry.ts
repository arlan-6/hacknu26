export type AlertLevel = "info" | "warning" | "critical";
export type HealthLevel = "normal" | "warning" | "critical";

export interface GeneratedAlert {
  code: string;
  severity: AlertLevel;
  message: string;
}

export interface DispatcherTelemetryEvent {
  payload: Record<string, unknown> & {
    train_id?: string;
    recorded_at?: string;
  };
  health: {
    health_index: number;
    level: HealthLevel;
    explanation: string[];
  };
  generated_alerts: GeneratedAlert[];
}
