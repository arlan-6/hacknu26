import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.telemetry import TelemetryPayload

logger = logging.getLogger(__name__)


class TelemetryConsumer:
    def __init__(
        self,
        on_payload: Callable[[TelemetryPayload], Awaitable[object]],
    ) -> None:
        self._on_payload = on_payload
        self._stop_event = asyncio.Event()
        self._connection: aio_pika.RobustConnection | None = None

    async def start(self) -> None:
        retry_delay = 5
        while not self._stop_event.is_set():
            try:
                await self._run_consumer_loop()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("RabbitMQ consumer loop failed, retrying")
                await asyncio.sleep(retry_delay)

    async def stop(self) -> None:
        self._stop_event.set()
        if self._connection is not None:
            await self._connection.close()

    async def _run_consumer_loop(self) -> None:
        logger.info("Connecting to RabbitMQ exchange '%s'", settings.TELEMETRY_EXCHANGE)
        self._connection = await aio_pika.connect_robust(settings.AMQP_URL)
        channel = await self._connection.channel()
        await channel.set_qos(prefetch_count=settings.TELEMETRY_PREFETCH)

        exchange = await channel.declare_exchange(
            settings.TELEMETRY_EXCHANGE,
            aio_pika.ExchangeType.FANOUT,
            durable=True,
        )
        queue = await channel.declare_queue(
            settings.TELEMETRY_QUEUE,
            durable=bool(settings.TELEMETRY_QUEUE),
            exclusive=not settings.TELEMETRY_QUEUE,
            auto_delete=not settings.TELEMETRY_QUEUE,
        )
        await queue.bind(exchange)

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                if self._stop_event.is_set():
                    break
                await self._handle_message(message)

    async def _handle_message(self, message: AbstractIncomingMessage) -> None:
        try:
            raw = json.loads(message.body.decode("utf-8"))
            payload = TelemetryPayload.model_validate(raw)
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
            logger.warning("Invalid telemetry message dropped: %s", exc)
            await message.reject(requeue=False)
            return

        try:
            await self._on_payload(payload)
        except Exception:
            logger.exception("Failed to process telemetry message, requeueing")
            await message.reject(requeue=True)
            return

        await message.ack()
