export type AlertLevel = "info" | "warning" | "critical";

export interface TelemetryPayload {
  locomotive: {
    id: string;
    model: string;
    status: "online" | "offline" | "warning" | "critical";
    timestamp: string;
    fault_state: string | null;
  };
  metrics: {
    speed_kmh: number;
    health: {
      index: number;
      level: "normal" | "warning" | "critical";
      description: string;
      top_factors: Array<{ name: string; impact: number }>;
    };
  };
  energy: {
    traction: {
      voltage_v: number;
      current_a: number;
    };
    consumption: {
      used_kwh: number;
      recuperated_kwh: number;
    };
  };
  technical: {
    temperature_c: {
      engine_1: number;
      engine_2: number;
      inverter: number;
    };
    pressure_kpa: {
      brake_system: number;
      main_line: number;
    };
    electrical: {
      pantograph_up: boolean;
      main_switch_on: boolean;
      frequency_hz: number;
    };
  };
  alerts: {
    count: number;
    items: Array<{
      type: AlertLevel;
      code: string;
      message: string;
    }>;
  };
  navigation: {
    section_km: number;
  };
  system: {
    latency_ms: number;
    ws_connected: boolean;
    version: string;
  };
}
