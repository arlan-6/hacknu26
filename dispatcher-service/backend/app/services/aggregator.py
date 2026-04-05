import asyncio

from app.schemas.telemetry import EnrichedTelemetry, TelemetryPayload
from app.services.alert_engine import build_alerts
from app.services.health_calculator import calculate_health


class TelemetryAggregator:
    def __init__(self) -> None:
        self._latest_state: dict[str, EnrichedTelemetry] = {}
        self._lock = asyncio.Lock()

    async def process_payload(self, payload: TelemetryPayload) -> EnrichedTelemetry:
        enriched = EnrichedTelemetry(
            payload=payload,
            health=calculate_health(payload),
            generated_alerts=build_alerts(payload),
        )
        # print(f"Processed telemetry for train {payload.train_id}: health={enriched.health.health_index}, alerts={len(enriched.generated_alerts)}")

        async with self._lock:
            self._latest_state[payload.train_id] = enriched
        return enriched

    async def get_latest_all(self) -> dict[str, EnrichedTelemetry]:
        async with self._lock:
            return dict(self._latest_state)

    async def get_latest(self, train_id: str) -> EnrichedTelemetry | None:
        async with self._lock:
            return self._latest_state.get(train_id)
