export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/* -------------------- SPEED -------------------- */
/*
Normal: 0–120
Warning: >100
Critical: >110
*/
export function isSpeedWarning(speed: number): boolean {
  return speed > 100;
}

export function isSpeedCritical(speed: number): boolean {
  return speed > 110;
}

export function scoreSpeed(speed: number): number {
  if (speed <= 100) return 100;
  if (speed >= 110) return 0;
  return Math.round((1 - (speed - 100) / 10) * 100);
}

/* -------------------- HEALTH -------------------- */
/*
Normal: 80–100
Warning: <70
Critical: <50
*/
export function isHealthWarning(healthIndex: number): boolean {
  return healthIndex < 70;
}

export function isHealthCritical(healthIndex: number): boolean {
  return healthIndex < 50;
}

export function scoreHealth(healthIndex: number): number {
  return Math.max(0, Math.min(100, Math.round(healthIndex)));
}

/* -------------------- PRESSURE -------------------- */
/*
Normal: 350–500
Warning: <300
Critical: <200
*/
export function isPressureWarning(pressureKpa: number): boolean {
  return pressureKpa < 300;
}

export function isPressureCritical(pressureKpa: number): boolean {
  return pressureKpa < 200;
}

export function scorePressure(pressure: number): number {
  if (pressure >= 350 && pressure <= 500) return 100;
  if (pressure <= 200) return 0;

  if (pressure < 350) {
    return Math.round(clamp01((pressure - 200) / 150) * 100);
  }

  // optional soft penalty above normal range
  if (pressure >= 600) return 0;
  return Math.round(clamp01((600 - pressure) / 100) * 100);
}

/* -------------------- TEMPERATURE -------------------- */
/*
Normal: <95
Warning: 95–110
Critical: >110
*/
export function isTempWarning(tempC: number): boolean {
  return tempC >= 95;
}

export function isTempCritical(tempC: number): boolean {
  return tempC > 110;
}

export function scoreTemperature(temp: number): number {
  if (temp < 95) return 100;
  if (temp > 110) return 0;
  return Math.round((1 - (temp - 95) / 15) * 100);
}

/* -------------------- VOLTAGE -------------------- */
/*
Normal: 25–27.5 kV
Warning: 24–25 kV or 27.5–28 kV
Critical: <24 kV or >28 kV
*/
export function isVoltageWarning(voltageV: number): boolean {
  return (voltageV >= 24000 && voltageV < 25000) || (voltageV > 27500 && voltageV <= 28000);
}

export function isVoltageCritical(voltageV: number): boolean {
  return voltageV < 24000 || voltageV > 28000;
}

export function scoreVoltage(voltage: number): number {
  if (voltage < 24000 || voltage > 28000) return 0;
  if (voltage >= 25000 && voltage <= 27500) return 100;

  if (voltage < 25000) {
    return Math.round(clamp01((voltage - 24000) / 1000) * 100);
  }

  return Math.round(clamp01((28000 - voltage) / 500) * 100);
}

/* -------------------- CURRENT -------------------- */
/*
Normal: 0–700
Warning: >700
Critical: >900
*/
export function isCurrentWarning(currentA: number): boolean {
  return currentA > 700;
}

export function isCurrentCritical(currentA: number): boolean {
  return currentA > 900;
}

export function scoreCurrent(current: number): number {
  if (current <= 700) return 100;
  if (current > 900) return 0;
  return Math.round((1 - (current - 700) / 200) * 100);
}

/* -------------------- UNIFIED HELPER -------------------- */

export type Status = "normal" | "warning" | "critical";

export function getMetricStatus({
  value,
  isWarning,
  isCritical,
}: {
  value: number;
  isWarning: (v: number) => boolean;
  isCritical: (v: number) => boolean;
}): Status {
  if (isCritical(value)) return "critical";
  if (isWarning(value)) return "warning";
  return "normal";
}
