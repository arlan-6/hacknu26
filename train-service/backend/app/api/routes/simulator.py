from fastapi import APIRouter, Request
from sqlmodel import Session

from app import crud
from app.core.db import engine
from app.models import TelemetryEventsPublic

router = APIRouter(tags=["simulator"])


@router.post("/simulator/start")
async def simulator_start(request: Request) -> dict[str, object]:
    runtime = request.app.state.telemetry_runtime
    await runtime.start()
    return {"running": runtime.running}


@router.post("/simulator/stop")
async def simulator_stop(request: Request) -> dict[str, object]:
    runtime = request.app.state.telemetry_runtime
    await runtime.stop()
    return {"running": runtime.running}


@router.get("/simulator/status")
async def simulator_status(request: Request) -> dict[str, object]:
    runtime = request.app.state.telemetry_runtime
    return {
        "running": runtime.running,
        "latest_count": len(runtime.latest_payloads()),
    }


@router.get("/api/latest")
async def latest_snapshot(request: Request) -> dict[str, object]:
    runtime = request.app.state.telemetry_runtime
    payloads = runtime.latest_payloads()
    return {
        "count": len(payloads),
        "items": payloads,
    }


@router.get("/api/history", response_model=TelemetryEventsPublic)
async def telemetry_history(limit: int = 100, train_id: str | None = None) -> TelemetryEventsPublic:
    bounded_limit = min(max(limit, 1), 1000)
    with Session(engine) as session:
        rows = crud.get_telemetry_events(
            session=session,
            limit=bounded_limit,
            train_id=train_id,
        )

    return TelemetryEventsPublic(data=rows, count=len(rows))
