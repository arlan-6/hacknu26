from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TopFactor(BaseModel):
    name: str = Field(..., example="engine_2_temperature")
    impact: int = Field(..., example=-3)


class HealthModel(BaseModel):
    index: int = Field(..., ge=0, le=100, example=86)
    level: Literal["normal", "warning", "critical"] = "normal"
    description: str = Field(..., example="stable")
    top_factors: list[TopFactor] = Field(default_factory=list)


class LocomotiveModel(BaseModel):
    id: str = Field(..., example="train-01")
    model: str = Field(..., example="KZ8A")
    status: Literal["online", "offline", "warning", "critical"] = "online"
    timestamp: datetime
    fault_state: str | None = None


class MetricsModel(BaseModel):
    speed_kmh: float = Field(..., ge=0, example=57)
    health: HealthModel


class TractionModel(BaseModel):
    voltage_v: int = Field(..., example=24900)
    current_a: int = Field(..., example=580)


class ConsumptionModel(BaseModel):
    used_kwh: float = Field(..., ge=0, example=230)
    recuperated_kwh: float = Field(..., ge=0, example=40)


class EnergyModel(BaseModel):
    traction: TractionModel
    consumption: ConsumptionModel


class TemperatureModel(BaseModel):
    engine_1: float = Field(..., example=78)
    engine_2: float = Field(..., example=84)
    inverter: float = Field(..., example=55)


class PressureModel(BaseModel):
    brake_system: float = Field(..., example=295)
    main_line: float = Field(..., example=700)


class ElectricalModel(BaseModel):
    pantograph_up: bool = True
    main_switch_on: bool = True
    frequency_hz: float = Field(..., example=50)


class TechnicalModel(BaseModel):
    temperature_c: TemperatureModel
    pressure_kpa: PressureModel
    electrical: ElectricalModel


class AlertItem(BaseModel):
    type: Literal["info", "warning", "critical"]
    code: str = Field(..., example="ENGINE_OVERHEAT_2")
    message: str = Field(..., example="Engine 2 overheating")


class AlertsModel(BaseModel):
    count: int = Field(..., ge=0, example=2)
    items: list[AlertItem] = Field(default_factory=list)


class NavigationModel(BaseModel):
    section_km: float = Field(..., ge=0, example=114)


class SystemModel(BaseModel):
    latency_ms: int = Field(..., ge=0, example=42)
    ws_connected: bool = True
    version: str = Field(..., example="1.0.0")


class TelemetryPayload(BaseModel):
    locomotive: LocomotiveModel
    metrics: MetricsModel
    energy: EnergyModel
    technical: TechnicalModel
    alerts: AlertsModel
    navigation: NavigationModel
    system: SystemModel
