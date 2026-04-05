from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Sequence
from typing import Any

from sqlmodel import Session

from app import crud
from app.bus.publisher import RabbitPublisher
from app.core.db import engine
from app.core.websocket_manager import WebSocketManager
from app.schemas.telemetry import TelemetryPayload
from app.simulator.train_simulator import TrainSimulator

logger = logging.getLogger(__name__)


class TelemetryRuntime:
    def __init__(
        self,
        simulator: TrainSimulator,
        publisher: RabbitPublisher,
        websocket_manager: WebSocketManager,
        tick_seconds: float,
    ) -> None:
        self._simulator = simulator
        self._publisher = publisher
        self._websocket_manager = websocket_manager
        self._tick_seconds = tick_seconds

        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._latest: dict[str, TelemetryPayload] = {}
        self._publisher_connected = False
        self._next_reconnect_at = 0.0
        self._reconnect_interval_seconds = 5.0

    @property
    def running(self) -> bool:
        return self._running

    def latest_payloads(self) -> list[dict[str, Any]]:
        return [
            payload.model_dump(mode="json")
            for payload in sorted(
                self._latest.values(),
                key=lambda item: item.locomotive.id,
            )
        ]

    async def start(self) -> None:
        if self._running:
            return

        try:
            await self._publisher.connect()
            self._publisher_connected = True
            self._next_reconnect_at = 0.0
        except Exception:
            self._publisher_connected = False
            self._next_reconnect_at = (
                time.monotonic() + self._reconnect_interval_seconds
            )
            logger.exception(
                "RabbitMQ connect failed, telemetry websocket will run without publishing"
            )

        self._running = True
        self._task = asyncio.create_task(self._run_loop(), name="telemetry-runtime")
        logger.info("Telemetry runtime started")

    async def stop(self) -> None:
        self._running = False

        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self._publisher_connected:
            await self._publisher.close()
            self._publisher_connected = False

        logger.info("Telemetry runtime stopped")

    async def _run_loop(self) -> None:
        while self._running:
            try:
                await self._maybe_reconnect_publisher()
                payloads = self._simulator.tick()
                await self._emit_batch(payloads)
            except Exception:
                logger.exception("Telemetry tick failed")

            await asyncio.sleep(self._tick_seconds)

    async def _emit_batch(self, payloads: Sequence[TelemetryPayload]) -> None:
        payload_json_batch: list[dict[str, Any]] = []

        for payload in payloads:
            payload_json = payload.model_dump(mode="json")
            payload_json_batch.append(payload_json)

            await self._websocket_manager.broadcast(payload_json)
            self._latest[payload.locomotive.id] = payload

            if self._publisher_connected:
                try:
                    await self._publisher.publish(payload_json)
                except Exception:
                    self._publisher_connected = False
                    self._next_reconnect_at = (
                        time.monotonic() + self._reconnect_interval_seconds
                    )
                    logger.exception(
                        "RabbitMQ publish failed, continuing telemetry broadcast"
                    )

        if payload_json_batch:
            try:
                with Session(engine) as session:
                    crud.create_telemetry_events(session=session, payloads=payload_json_batch)
            except Exception:
                logger.exception("Failed to persist telemetry batch")

        logger.info("Telemetry tick emitted events=%s", len(payloads))

    async def _maybe_reconnect_publisher(self) -> None:
        if self._publisher_connected:
            return

        if time.monotonic() < self._next_reconnect_at:
            return

        try:
            await self._publisher.connect()
            self._publisher_connected = True
            self._next_reconnect_at = 0.0
            logger.info("RabbitMQ publisher reconnected")
        except Exception:
            self._publisher_connected = False
            self._next_reconnect_at = time.monotonic() + self._reconnect_interval_seconds
            logger.exception("RabbitMQ reconnect failed, will retry")
