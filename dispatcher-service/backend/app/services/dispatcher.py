import asyncio
import logging

from app.core.websocket_manager import WebSocketManager
from app.db.repository import TelemetryRepository
from app.schemas.telemetry import EnrichedTelemetry, TelemetryPayload
from app.services.aggregator import TelemetryAggregator

logger = logging.getLogger(__name__)


class DispatcherProcessor:
    def __init__(
        self,
        aggregator: TelemetryAggregator,
        repository: TelemetryRepository,
        websocket_manager: WebSocketManager,
    ) -> None:
        self.aggregator = aggregator
        self.repository = repository
        self.websocket_manager = websocket_manager

    async def handle_payload(self, payload: TelemetryPayload) -> EnrichedTelemetry:
        enriched = await self.aggregator.process_payload(payload)

        try:
            await asyncio.to_thread(self.repository.insert_event, enriched)
        except Exception:
            logger.exception("Failed to persist telemetry event")

        try:
            await self.websocket_manager.broadcast_json(
                enriched.model_dump(mode="json")
            )
        except Exception:
            logger.exception("Failed to broadcast telemetry event")

        return enriched
