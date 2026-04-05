from __future__ import annotations

import json
import logging
from typing import Any

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractExchange

logger = logging.getLogger(__name__)


class RabbitPublisher:
    def __init__(self, amqp_url: str, exchange_name: str) -> None:
        self.amqp_url = amqp_url
        self.exchange_name = exchange_name
        self._connection: AbstractConnection | None = None
        self._channel: AbstractChannel | None = None
        self._exchange: AbstractExchange | None = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(self.amqp_url)
        self._channel = await self._connection.channel()
        self._exchange = await self._channel.declare_exchange(
            self.exchange_name,
            aio_pika.ExchangeType.FANOUT,
            durable=True,
        )
        logger.info("RabbitMQ connected: exchange=%s", self.exchange_name)

    async def publish(self, payload: dict[str, Any]) -> None:
        if self._exchange is None:
            return

        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        await self._exchange.publish(
            aio_pika.Message(
                body=body,
                content_type="application/json",
            ),
            routing_key="",
        )

    async def close(self) -> None:
        if self._channel is not None and not self._channel.is_closed:
            await self._channel.close()
        if self._connection is not None and not self._connection.is_closed:
            await self._connection.close()
