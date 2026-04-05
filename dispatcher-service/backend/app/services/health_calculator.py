from app.schemas.telemetry import HealthResult, TelemetryPayload


def _extract_float_values(data: object) -> list[float]:
    if data is None:
        return []
    if isinstance(data, dict):
        values: list[float] = []
        for value in data.values():
            if isinstance(value, int | float):
                values.append(float(value))
        return values
    if isinstance(data, list):
        values = []
        for value in data:
            if isinstance(value, int | float):
                values.append(float(value))
        return values
    if isinstance(data, int | float):
        return [float(data)]
    return []


def _extract_incoming_health(payload: TelemetryPayload) -> HealthResult | None:
    metrics = getattr(payload, "metrics", None)
    if not isinstance(metrics, dict):
        return None

    incoming_health = metrics.get("health")
    if not isinstance(incoming_health, dict):
        return None

    index = incoming_health.get("index")
    level = incoming_health.get("level")
    if not isinstance(index, int | float):
        return None
    if level not in {"normal", "warning", "critical"}:
        return None

    return HealthResult(
        health_index=max(0, min(100, int(round(float(index))))),
        level=level,
        explanation=["health provided by train simulator"],
    )


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


def calculate_health(payload: TelemetryPayload) -> HealthResult:
    incoming_health = _extract_incoming_health(payload)
    if incoming_health is not None:
        return incoming_health

    penalties: list[tuple[str, float]] = []

    speed = _extract_nested_number(payload, "metrics", "speed_kmh")
    if speed is not None:
        if speed > 110:
            penalties.append((f"critical speed {speed:.1f} km/h", 18.0))
        elif speed > 100:
            penalties.append((f"high speed {speed:.1f} km/h", 8.0))

    temperatures = _extract_float_values(payload.temperatures)
    if temperatures:
        max_temp = max(temperatures)
        if max_temp > 110:
            penalties.append((f"critical temperature {max_temp:.1f}C", 35.0))
        elif max_temp >= 95:
            penalties.append((f"high temperature {max_temp:.1f}C", 12.0))

    pressure_values = _extract_float_values(payload.pressure)
    if pressure_values:
        min_pressure = min(pressure_values)
        if min_pressure < 200:
            penalties.append((f"critical low pressure {min_pressure:.1f}", 28.0))
        elif min_pressure < 300:
            penalties.append((f"low pressure {min_pressure:.1f}", 10.0))

    voltage_values = _extract_float_values(payload.voltage)
    if voltage_values:
        min_voltage = min(voltage_values)
        max_voltage = max(voltage_values)
        if min_voltage < 24000 or max_voltage > 28000:
            penalties.append(
                (f"critical voltage range {min_voltage:.0f}-{max_voltage:.0f}V", 22.0)
            )
        elif min_voltage < 25000 or max_voltage > 27500:
            penalties.append((f"voltage out of normal range {min_voltage:.0f}-{max_voltage:.0f}V", 8.0))

    current = _extract_nested_number(payload, "energy", "traction", "current_a")
    if current is not None:
        if current > 900:
            penalties.append((f"critical current {current:.0f}A", 18.0))
        elif current > 700:
            penalties.append((f"high current {current:.0f}A", 8.0))

    if payload.alerts:
        penalties.append(("incoming train alerts present", 10.0))

    total_penalty = sum(points for _, points in penalties)
    health_index = max(0, min(100, int(round(100 - total_penalty))))

    if health_index >= 70:
        level = "normal"
    elif health_index >= 50:
        level = "warning"
    else:
        level = "critical"

    explanation = [factor for factor, _ in penalties[:3]]
    if not explanation:
        explanation = ["all key metrics are within expected ranges"]

    return HealthResult(
        health_index=health_index,
        level=level,
        explanation=explanation,
    )
