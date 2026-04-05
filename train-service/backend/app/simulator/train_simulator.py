from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from app.schemas.telemetry import (
    AlertItem,
    AlertsModel,
    ConsumptionModel,
    ElectricalModel,
    EnergyModel,
    HealthModel,
    LocomotiveModel,
    MetricsModel,
    NavigationModel,
    PressureModel,
    SystemModel,
    TechnicalModel,
    TelemetryPayload,
    TemperatureModel,
    TopFactor,
    TractionModel,
)


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


@dataclass
class TrainState:
    train_id: str
    profile: Literal["normal", "warning", "alternate"] = "normal"
    allow_faults: bool = False
    model: str = "KZ8A"
    status: Literal["online", "offline", "warning", "critical"] = "online"

    section_km: float = 114.0
    speed_kmh: float = 100

    voltage_v: int = 25000
    current_a: int = 800

    used_kwh: float = 230.0
    recuperated_kwh: float = 40.0

    engine_1_temp: float = 76.0
    engine_2_temp: float = 80.0
    inverter_temp: float = 54.0

    brake_pressure_kpa: float = 320.0
    main_line_kpa: float = 700.0

    pantograph_up: bool = True
    main_switch_on: bool = True
    frequency_hz: float = 50.0

    latency_ms: int = 40
    ws_connected: bool = True
    version: str = "1.0.0"

    active_fault: str | None = None
    ticks_until_fault_clear: int = 0

    def update(self) -> None:
        """Advance the train state by one tick."""
        if self.status == "offline":
            return

        if self.profile == "normal":
            self._update_normal_profile()
        elif self.profile == "warning":
            self._update_warning_profile()
        else:
            self._update_alternate_profile()

        self.section_km += self.speed_kmh / 3600.0

        if self.allow_faults:
            self._maybe_inject_fault()
            self._apply_fault_effects()

    def _update_normal_profile(self) -> None:
        self.speed_kmh = clamp(self.speed_kmh + random.uniform(-2.2, 2.2), 82, 98)
        self.current_a = int(clamp(self.current_a + random.randint(-18, 18), 500, 680))
        self.voltage_v = int(clamp(self.voltage_v + random.randint(-120, 120), 25200, 27000))

        self.used_kwh = clamp(self.used_kwh + random.uniform(0.6, 2.2), 0, 100000)
        self.recuperated_kwh = clamp(self.recuperated_kwh + random.uniform(0.1, 0.8), 0, 100000)

        self.engine_1_temp = clamp(self.engine_1_temp + random.uniform(-0.9, 0.9), 72, 84)
        self.engine_2_temp = clamp(self.engine_2_temp + random.uniform(-0.9, 0.9), 75, 90)
        self.inverter_temp = clamp(self.inverter_temp + random.uniform(-0.7, 0.7), 48, 62)

        self.brake_pressure_kpa = clamp(self.brake_pressure_kpa + random.uniform(-4, 4), 310, 350)
        self.main_line_kpa = clamp(self.main_line_kpa + random.uniform(-3, 3), 690, 730)

        self.frequency_hz = clamp(self.frequency_hz + random.uniform(-0.1, 0.1), 49.7, 50.3)
        self.latency_ms = int(clamp(self.latency_ms + random.randint(-3, 3), 28, 70))

    def _update_warning_profile(self) -> None:
        # Keep train-02 in warning bands while avoiding critical thresholds.
        self.speed_kmh = clamp(self.speed_kmh + random.uniform(-2.5, 2.5), 101, 106)
        self.current_a = int(clamp(self.current_a + random.randint(-20, 20), 720, 860))
        self.voltage_v = int(clamp(self.voltage_v + random.randint(-180, 180), 24600, 27800))

        self.used_kwh = clamp(self.used_kwh + random.uniform(1.0, 3.4), 0, 100000)
        self.recuperated_kwh = clamp(self.recuperated_kwh + random.uniform(0.0, 0.6), 0, 100000)

        self.engine_1_temp = clamp(self.engine_1_temp + random.uniform(-1.0, 1.0), 84, 98)
        self.engine_2_temp = clamp(self.engine_2_temp + random.uniform(-1.0, 1.0), 96, 104)
        self.inverter_temp = clamp(self.inverter_temp + random.uniform(-0.8, 0.8), 58, 72)

        self.brake_pressure_kpa = clamp(self.brake_pressure_kpa + random.uniform(-6, 6), 240, 295)
        self.main_line_kpa = clamp(self.main_line_kpa + random.uniform(-4, 4), 670, 715)

        self.frequency_hz = clamp(self.frequency_hz + random.uniform(-0.15, 0.15), 49.5, 50.5)
        self.latency_ms = int(clamp(self.latency_ms + random.randint(-5, 5), 90, 160))

    def _update_alternate_profile(self) -> None:
        # Distinct but still non-critical operating pattern for train-03.
        self.speed_kmh = clamp(self.speed_kmh + random.uniform(-3.0, 3.0), 68, 92)
        self.current_a = int(clamp(self.current_a + random.randint(-22, 22), 420, 690))
        self.voltage_v = int(clamp(self.voltage_v + random.randint(-170, 170), 25100, 27300))

        self.used_kwh = clamp(self.used_kwh + random.uniform(0.7, 2.9), 0, 100000)
        self.recuperated_kwh = clamp(self.recuperated_kwh + random.uniform(0.2, 1.2), 0, 100000)

        self.engine_1_temp = clamp(self.engine_1_temp + random.uniform(-1.1, 1.1), 69, 86)
        self.engine_2_temp = clamp(self.engine_2_temp + random.uniform(-1.1, 1.1), 82, 94)
        self.inverter_temp = clamp(self.inverter_temp + random.uniform(-0.9, 0.9), 50, 66)

        self.brake_pressure_kpa = clamp(self.brake_pressure_kpa + random.uniform(-5, 5), 305, 345)
        self.main_line_kpa = clamp(self.main_line_kpa + random.uniform(-4, 4), 685, 725)

        self.frequency_hz = clamp(self.frequency_hz + random.uniform(-0.1, 0.1), 49.6, 50.4)
        self.latency_ms = int(clamp(self.latency_ms + random.randint(-4, 4), 45, 95))

    def _maybe_inject_fault(self) -> None:
        if self.active_fault is not None:
            self.ticks_until_fault_clear -= 1
            if self.ticks_until_fault_clear <= 0:
                self.active_fault = None
                self.status = "online"
            return

        # ~3% chance each tick
        if random.random() < 0.03:
            self.active_fault = random.choice(
                [
                    "engine_2_overheat",
                    "low_brake_pressure",
                    "voltage_instability",
                ]
            )
            self.ticks_until_fault_clear = random.randint(5, 15)
            self.status = "warning"

    def _apply_fault_effects(self) -> None:
        if self.active_fault == "engine_2_overheat":
            self.engine_2_temp = clamp(self.engine_2_temp + random.uniform(2, 4), 50, 120)
            if self.engine_2_temp >= 95:
                self.status = "warning"
            if self.engine_2_temp > 110:
                self.status = "critical"

        elif self.active_fault == "low_brake_pressure":
            self.brake_pressure_kpa = clamp(
                self.brake_pressure_kpa - random.uniform(10, 20), 180, 380
            )
            self.status = "critical" if self.brake_pressure_kpa < 200 else "warning"

        elif self.active_fault == "voltage_instability":
            self.voltage_v = int(clamp(self.voltage_v + random.randint(-900, 900), 22000, 28000))
            self.status = (
                "critical"
                if self.voltage_v < 24000 or self.voltage_v > 28000
                else "warning"
            )


def build_alerts(state: TrainState) -> list[AlertItem]:
    alerts: list[AlertItem] = []

    if state.speed_kmh > 110:
        alerts.append(
            AlertItem(
                type="critical",
                code="SPEED_CRITICAL",
                message="Speed exceeds safe operating threshold",
            )
        )
    elif state.speed_kmh > 100:
        alerts.append(
            AlertItem(
                type="warning",
                code="SPEED_HIGH",
                message="Speed is above recommended operating range",
            )
        )

    if state.engine_2_temp > 110:
        alerts.append(
            AlertItem(
                type="critical",
                code="ENGINE_OVERHEAT_2",
                message="Engine 2 overheating",
            )
        )
    elif state.engine_2_temp >= 95:
        alerts.append(
            AlertItem(
                type="warning",
                code="ENGINE_TEMP_HIGH_2",
                message="Engine 2 temperature is high",
            )
        )

    if state.brake_pressure_kpa < 300:
        alert_type = "critical" if state.brake_pressure_kpa < 200 else "warning"
        alerts.append(
            AlertItem(
                type=alert_type,
                code="LOW_BRAKE_PRESSURE",
                message="Brake pressure is below normal",
            )
        )

    if state.voltage_v < 24000 or state.voltage_v > 28000:
        alerts.append(
            AlertItem(
                type="critical",
                code="VOLTAGE_CRITICAL",
                message="Voltage is outside critical range",
            )
        )
    elif state.voltage_v < 25000 or state.voltage_v > 27500:
        alerts.append(
            AlertItem(
                type="warning",
                code="VOLTAGE_UNSTABLE",
                message="Voltage is outside normal range",
            )
        )

    if state.current_a > 900:
        alerts.append(
            AlertItem(
                type="critical",
                code="CURRENT_CRITICAL",
                message="Traction current is critically high",
            )
        )
    elif state.current_a > 700:
        alerts.append(
            AlertItem(
                type="warning",
                code="CURRENT_HIGH",
                message="Traction current is above recommended range",
            )
        )

    return alerts


def build_health(state: TrainState, alerts: list[AlertItem]) -> HealthModel:
    score = 100
    factors: list[TopFactor] = []

    if state.speed_kmh > 110:
        penalty = 18
        score -= penalty
        factors.append(TopFactor(name="speed", impact=-penalty))
    elif state.speed_kmh > 100:
        penalty = 8
        score -= penalty
        factors.append(TopFactor(name="speed", impact=-penalty))

    # Engine 2 temperature penalty
    if state.engine_2_temp > 110:
        penalty = int((state.engine_2_temp - 110) * 1.4 + 20)
        score -= penalty
        factors.append(TopFactor(name="engine_2_temperature", impact=-penalty))
    elif state.engine_2_temp > 95:
        penalty = int((state.engine_2_temp - 95) * 0.9 + 8)
        score -= penalty
        factors.append(TopFactor(name="engine_2_temperature", impact=-penalty))

    # Brake pressure penalty
    if state.brake_pressure_kpa < 300:
        penalty = int((300 - state.brake_pressure_kpa) * 0.12)
        if state.brake_pressure_kpa < 200:
            penalty += 18
        score -= penalty
        factors.append(TopFactor(name="brake_pressure", impact=-penalty))

    # Voltage penalty
    if state.voltage_v < 24000 or state.voltage_v > 28000:
        penalty = 20
        score -= penalty
        factors.append(TopFactor(name="voltage", impact=-penalty))
    elif state.voltage_v < 25000 or state.voltage_v > 27500:
        penalty = 8
        score -= penalty
        factors.append(TopFactor(name="voltage", impact=-penalty))

    # Current penalty
    if state.current_a > 900:
        penalty = 18
        score -= penalty
        factors.append(TopFactor(name="current", impact=-penalty))
    elif state.current_a > 700:
        penalty = 8
        score -= penalty
        factors.append(TopFactor(name="current", impact=-penalty))

    # Load can help show positive contribution
    if 400 <= state.current_a <= 700:
        factors.append(TopFactor(name="load", impact=2))

    # Alert penalty
    if alerts:
        alert_penalty = sum(10 if a.type == "critical" else 4 for a in alerts)
        score -= alert_penalty
        factors.append(TopFactor(name="alerts", impact=-alert_penalty))

    score = max(0, min(score, 100))

    if score >= 70:
        level: Literal["normal", "warning", "critical"] = "normal"
        description = "stable"
    elif score >= 50:
        level = "warning"
        description = "attention required"
    else:
        level = "critical"
        description = "critical condition"

    # Keep top 5 most relevant by absolute impact
    factors = sorted(factors, key=lambda f: abs(f.impact), reverse=True)[:5]

    return HealthModel(
        index=score,
        level=level,
        description=description,
        top_factors=factors,
    )


def build_payload(state: TrainState) -> TelemetryPayload:
    alerts = build_alerts(state)
    health = build_health(state, alerts)

    if state.status != "offline":
        if any(alert.type == "critical" for alert in alerts):
            state.status = "critical"
        elif any(alert.type == "warning" for alert in alerts):
            state.status = "warning"
        else:
            state.status = "online"

    return TelemetryPayload(
        locomotive=LocomotiveModel(
            id=state.train_id,
            model=state.model,
            status=state.status,
            timestamp=datetime.now(timezone.utc),
            fault_state=state.active_fault,
        ),
        metrics=MetricsModel(
            speed_kmh=round(state.speed_kmh, 1),
            health=health,
        ),
        energy=EnergyModel(
            traction=TractionModel(
                voltage_v=state.voltage_v,
                current_a=state.current_a,
            ),
            consumption=ConsumptionModel(
                used_kwh=round(state.used_kwh, 1),
                recuperated_kwh=round(state.recuperated_kwh, 1),
            ),
        ),
        technical=TechnicalModel(
            temperature_c=TemperatureModel(
                engine_1=round(state.engine_1_temp, 1),
                engine_2=round(state.engine_2_temp, 1),
                inverter=round(state.inverter_temp, 1),
            ),
            pressure_kpa=PressureModel(
                brake_system=round(state.brake_pressure_kpa, 1),
                main_line=round(state.main_line_kpa, 1),
            ),
            electrical=ElectricalModel(
                pantograph_up=state.pantograph_up,
                main_switch_on=state.main_switch_on,
                frequency_hz=round(state.frequency_hz, 1),
            ),
        ),
        alerts=AlertsModel(
            count=len(alerts),
            items=alerts,
        ),
        navigation=NavigationModel(
            section_km=round(state.section_km, 3),
        ),
        system=SystemModel(
            latency_ms=state.latency_ms,
            ws_connected=state.ws_connected,
            version=state.version,
        ),
    )


class TrainSimulator:
    def __init__(self, train_count: int = 3) -> None:
        self.trains: dict[str, TrainState] = {}
        for i in range(train_count):
            train_id = f"train-{i+1:02d}"
            profile: Literal["normal", "warning", "alternate"]
            if i == 0:
                profile = "normal"
            elif i == 1:
                profile = "warning"
            else:
                profile = "alternate"

            self.trains[train_id] = TrainState(
                train_id=train_id,
                profile=profile,
                section_km=114.0 + i * 5,
                speed_kmh=92 if profile == "normal" else (103 if profile == "warning" else 80),
                engine_1_temp=78 if profile == "normal" else (90 if profile == "warning" else 82),
                engine_2_temp=84 if profile == "normal" else (98 if profile == "warning" else 90),
                brake_pressure_kpa=328 if profile == "normal" else (278 if profile == "warning" else 320),
                current_a=620 if profile == "normal" else (760 if profile == "warning" else 560),
                voltage_v=26000 if profile == "normal" else (24800 if profile == "warning" else 26300),
                latency_ms=45 if profile == "normal" else (110 if profile == "warning" else 70),
                allow_faults=False,
            )

    def tick(self) -> list[TelemetryPayload]:
        payloads: list[TelemetryPayload] = []
        for state in self.trains.values():
            state.update()
            payloads.append(build_payload(state))
        return payloads
