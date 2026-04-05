import asyncio
import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from sqlmodel import SQLModel

from app.api.main import api_router
from app.api.rest.trains import router as trains_router
from app.api.ws.telemetry_ws import router as telemetry_ws_router
from app.bus.consumer import TelemetryConsumer
from app.core.config import settings
from app.core.db import engine
from app.core.websocket_manager import WebSocketManager
from app.db.repository import TelemetryRepository
from app.services.aggregator import TelemetryAggregator
from app.services.dispatcher import DispatcherProcessor

logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)

    websocket_manager = WebSocketManager()
    aggregator = TelemetryAggregator()
    repository = TelemetryRepository()
    dispatcher = DispatcherProcessor(
        aggregator=aggregator,
        repository=repository,
        websocket_manager=websocket_manager,
    )
    consumer = TelemetryConsumer(on_payload=dispatcher.handle_payload)
    consumer_task = asyncio.create_task(consumer.start())

    app.state.websocket_manager = websocket_manager
    app.state.dispatcher = dispatcher
    app.state.telemetry_consumer = consumer
    app.state.consumer_task = consumer_task
    


    try:
        yield
    finally:
        await consumer.stop()
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            logger.info("Telemetry consumer task cancelled")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(trains_router)
app.include_router(telemetry_ws_router)

