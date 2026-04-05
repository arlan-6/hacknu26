export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const CRITICAL_SCORE_THRESHOLD = 75;
export const MAX_SPEED_KMH = 120;
// const MAX_SPEED_SCORE = MAX_SPEED_KMH * CRITICAL_SCORE_THRESHOLD / 100;

export function isSpeedCritical(speed: number | null): boolean {
  return speed !== null && scoreSpeed(speed) < CRITICAL_SCORE_THRESHOLD;
}

export function isHealthCritical(healthIndex: number | null): boolean {
  return healthIndex !== null && healthIndex < CRITICAL_SCORE_THRESHOLD;
}

export function isPressureCritical(pressureKpa: number | null): boolean {
  return (
    pressureKpa !== null &&
    scorePressure(pressureKpa) < CRITICAL_SCORE_THRESHOLD
  );
}

export function isTempCritical(tempC: number | null): boolean {
  return tempC !== null && scoreTemperature(tempC) < CRITICAL_SCORE_THRESHOLD;
}

export function isVoltageCritical(voltageV: number | null): boolean {
  return voltageV !== null && scoreVoltage(voltageV) < CRITICAL_SCORE_THRESHOLD;
}

export function isCurrentCritical(currentA: number | null): boolean {
  return currentA !== null && scoreCurrent(currentA) < CRITICAL_SCORE_THRESHOLD;
}

export function scoreSpeed(speed: number | null): number {
  if (speed === null) {
    return 0;
  }

  if (speed >= MAX_SPEED_KMH) {
    return MAX_SPEED_KMH;
  }
  return Math.round((speed / MAX_SPEED_KMH) * CRITICAL_SCORE_THRESHOLD);
}

export function scorePressure(pressure: number | null): number {
  if (pressure === null) {
    return 0;
  }
  if (pressure >= 300) {
    return 100;
  }
  if (pressure <= 200) {
    return 0;
  }
  return Math.round(((pressure - 200) / 100) * 100);
}

export function scoreTemperature(temp: number | null): number {
  if (temp === null) {
    return 0;
  }
  if (temp <= 95) {
    return 100;
  }
  if (temp > 110) {
    return 0;
  }
  return Math.round((1 - (temp - 95) / 15) * 100);
}

export function scoreVoltage(voltage: number | null): number {
  if (voltage === null) {
    return 0;
  }
  if (voltage < 24000 || voltage > 28000) {
    return 0;
  }
  if (voltage >= 25000 && voltage <= 27500) {
    return 100;
  }
  if (voltage < 25000) {
    return Math.round(clamp01((voltage - 24000) / 1000) * 100);
  }
  return Math.round(clamp01((28000 - voltage) / 500) * 100);
}

export function scoreCurrent(current: number | null): number {
  if (current === null) {
    return 0;
  }
  if (current <= 700) {
    return 100;
  }
  if (current > 900) {
    return 0;
  }
  return Math.round((1 - (current - 700) / 200) * 100);
}
