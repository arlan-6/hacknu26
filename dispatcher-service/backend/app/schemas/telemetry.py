from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TelemetryPayload(BaseModel):
    """Shared telemetry payload contract consumed from RabbitMQ."""

    model_config = ConfigDict(extra="allow")

    train_id: str | None = None
    recorded_at: datetime | None = None
    temperatures: dict[str, float] | list[float] | None = None
    pressure: float | dict[str, float] | None = None
    voltage: float | dict[str, float] | list[float] | None = None
    alerts: list[str] | list[dict[str, Any]] | dict[str, Any] | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_incoming(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        alerts = normalized.get("alerts")
        # train-service format is alerts={count: int, items: [...]}
        if isinstance(alerts, dict):
            items = alerts.get("items")
            if isinstance(items, list):
                normalized["alerts"] = items

        return normalized

    @field_validator("temperatures", mode="before")
    @classmethod
    def normalize_temperatures(cls, value: object) -> object:
        if isinstance(value, dict):
            normalized: dict[str, float] = {}
            for key, item in value.items():
                if isinstance(item, int | float):
                    normalized[key] = float(item)
            return normalized
        if isinstance(value, list):
            return [float(item) for item in value if isinstance(item, int | float)]
        return value

    @field_validator("pressure", mode="before")
    @classmethod
    def normalize_pressure(cls, value: object) -> object:
        if isinstance(value, int | float):
            return float(value)
        if isinstance(value, dict):
            normalized: dict[str, float] = {}
            for key, item in value.items():
                if isinstance(item, int | float):
                    normalized[key] = float(item)
            return normalized
        return value

    @field_validator("voltage", mode="before")
    @classmethod
    def normalize_voltage(cls, value: object) -> object:
        if isinstance(value, int | float):
            return float(value)
        if isinstance(value, dict):
            normalized: dict[str, float] = {}
            for key, item in value.items():
                if isinstance(item, int | float):
                    normalized[key] = float(item)
            return normalized
        if isinstance(value, list):
            return [float(item) for item in value if isinstance(item, int | float)]
        return value

    @model_validator(mode="after")
    def ensure_recorded_at(self) -> "TelemetryPayload":
        # Keep compatibility with train-service payloads that use locomotive.id.
        if not self.train_id:
            locomotive = getattr(self, "locomotive", None)
            if isinstance(locomotive, dict):
                train_id = locomotive.get("id")
                if isinstance(train_id, str) and train_id:
                    self.train_id = train_id

        if not self.train_id:
            raise ValueError("train_id is required and could not be derived")

        # Extract nested telemetry fields if the flat fields are absent.
        if self.temperatures is None:
            technical = getattr(self, "technical", None)
            if isinstance(technical, dict):
                maybe_temps = technical.get("temperature_c")
                if isinstance(maybe_temps, dict):
                    self.temperatures = {
                        key: float(item)
                        for key, item in maybe_temps.items()
                        if isinstance(item, int | float)
                    }
                elif isinstance(maybe_temps, list):
                    self.temperatures = [
                        float(item) for item in maybe_temps if isinstance(item, int | float)
                    ]

        if self.pressure is None:
            technical = getattr(self, "technical", None)
            if isinstance(technical, dict):
                maybe_pressure = technical.get("pressure_kpa")
                if isinstance(maybe_pressure, dict):
                    self.pressure = {
                        key: float(item)
                        for key, item in maybe_pressure.items()
                        if isinstance(item, int | float)
                    }
                elif isinstance(maybe_pressure, int | float):
                    self.pressure = float(maybe_pressure)

        if self.voltage is None:
            energy = getattr(self, "energy", None)
            if isinstance(energy, dict):
                traction = energy.get("traction")
                if isinstance(traction, dict):
                    maybe_voltage = traction.get("voltage_v")
                    if isinstance(maybe_voltage, dict):
                        self.voltage = {
                            key: float(item)
                            for key, item in maybe_voltage.items()
                            if isinstance(item, int | float)
                        }
                    elif isinstance(maybe_voltage, list):
                        self.voltage = [
                            float(item)
                            for item in maybe_voltage
                            if isinstance(item, int | float)
                        ]
                    elif isinstance(maybe_voltage, int | float):
                        self.voltage = float(maybe_voltage)

        if self.recorded_at is None:
            locomotive = getattr(self, "locomotive", None)
            if isinstance(locomotive, dict):
                timestamp = locomotive.get("timestamp")
                if isinstance(timestamp, str):
                    try:
                        self.recorded_at = datetime.fromisoformat(
                            timestamp.replace("Z", "+00:00")
                        )
                    except ValueError:
                        self.recorded_at = None
            if self.recorded_at is None:
                self.recorded_at = datetime.now(timezone.utc)
        return self


class HealthResult(BaseModel):
    health_index: int = Field(ge=0, le=100)
    level: Literal["normal", "warning", "critical"]
    explanation: list[str]


class AlertResult(BaseModel):
    code: str
    severity: Literal["info", "warning", "critical"]
    message: str


class EnrichedTelemetry(BaseModel):
    payload: TelemetryPayload
    health: HealthResult
    generated_alerts: list[AlertResult]
