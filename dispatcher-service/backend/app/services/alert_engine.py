from app.schemas.telemetry import AlertResult, TelemetryPayload
from app.services.health_calculator import _extract_float_values


def _extract_nested_number(payload: TelemetryPayload, *path: str) -> float | None:
    cursor: object = payload
    for segment in path:
        if isinstance(cursor, dict):
            cursor = cursor.get(segment)
            continue
        cursor = getattr(cursor, segment, None)
    if isinstance(cursor, int | float):
        return float(cursor)
    return None


def build_alerts(payload: TelemetryPayload) -> list[AlertResult]:
    alerts: list[AlertResult] = []

    speed = _extract_nested_number(payload, "metrics", "speed_kmh")
    if speed is not None:
        if speed > 110:
            alerts.append(
                AlertResult(
                    code="speed_critical",
                    severity="critical",
                    message=f"Train {payload.train_id} speed is critical ({speed:.1f} km/h)",
                )
            )
        elif speed > 100:
            alerts.append(
                AlertResult(
                    code="speed_high",
                    severity="warning",
                    message=f"Train {payload.train_id} speed is high ({speed:.1f} km/h)",
                )
            )

    temperatures = _extract_float_values(payload.temperatures)
    if temperatures:
        max_temp = max(temperatures)
        if max_temp > 110:
            alerts.append(
                AlertResult(
                    code="temp_critical",
                    severity="critical",
                    message=f"Train {payload.train_id} temperature is critical ({max_temp:.1f}C)",
                )
            )
        elif max_temp >= 95:
            alerts.append(
                AlertResult(
                    code="temp_high",
                    severity="warning",
                    message=f"Train {payload.train_id} temperature is high ({max_temp:.1f}C)",
                )
            )

    pressure_values = _extract_float_values(payload.pressure)
    if pressure_values:
        min_pressure = min(pressure_values)
        if min_pressure < 200:
            alerts.append(
                AlertResult(
                    code="pressure_critical",
                    severity="critical",
                    message=(
                        f"Train {payload.train_id} brake pressure is critical ({min_pressure:.1f})"
                    ),
                )
            )
        elif min_pressure < 300:
            alerts.append(
                AlertResult(
                    code="pressure_low",
                    severity="warning",
                    message=f"Train {payload.train_id} brake pressure is low ({min_pressure:.1f})",
                )
            )

    voltage_values = _extract_float_values(payload.voltage)
    if voltage_values:
        min_voltage = min(voltage_values)
        max_voltage = max(voltage_values)
        if min_voltage < 24000 or max_voltage > 28000:
            alerts.append(
                AlertResult(
                    code="voltage_critical",
                    severity="critical",
                    message=(
                        f"Train {payload.train_id} voltage is critical ({min_voltage:.0f}-{max_voltage:.0f} V)"
                    ),
                )
            )
        elif min_voltage < 25000 or max_voltage > 27500:
            alerts.append(
                AlertResult(
                    code="voltage_unstable",
                    severity="warning",
                    message=(
                        f"Train {payload.train_id} voltage is outside normal range ({min_voltage:.0f}-{max_voltage:.0f} V)"
                    ),
                )
            )

    current = _extract_nested_number(payload, "energy", "traction", "current_a")
    if current is not None:
        if current > 900:
            alerts.append(
                AlertResult(
                    code="current_critical",
                    severity="critical",
                    message=f"Train {payload.train_id} traction current is critical ({current:.0f} A)",
                )
            )
        elif current > 700:
            alerts.append(
                AlertResult(
                    code="current_high",
                    severity="warning",
                    message=f"Train {payload.train_id} traction current is high ({current:.0f} A)",
                )
            )

    return alerts
