from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.api.routes import health, simulator, ws
from app.bus.publisher import RabbitPublisher
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.simulator.runtime import TelemetryRuntime
from app.simulator.train_simulator import TrainSimulator

def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    websocket_manager = WebSocketManager()
    simulator_engine = TrainSimulator(train_count=settings.SIMULATOR_TRAIN_COUNT)
    publisher = RabbitPublisher(
        amqp_url=settings.AMQP_URL,
        exchange_name=settings.TELEMETRY_EXCHANGE,
    )
    runtime = TelemetryRuntime(
        simulator=simulator_engine,
        publisher=publisher,
        websocket_manager=websocket_manager,
        tick_seconds=settings.SIMULATOR_TICK_SECONDS,
    )

    app.state.websocket_manager = websocket_manager
    app.state.telemetry_runtime = runtime

    await runtime.start()
    try:
        yield
    finally:
        await runtime.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(health.router)
app.include_router(simulator.router)
app.include_router(ws.router)
