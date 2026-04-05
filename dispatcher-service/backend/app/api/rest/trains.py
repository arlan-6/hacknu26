import asyncio
import csv
import json
from io import StringIO

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.services.dispatcher import DispatcherProcessor

router = APIRouter(prefix="/trains", tags=["trains"])


def _csv_row_from_event(event: object) -> list[str]:
    train_id = getattr(event, "train_id", "")
    recorded_at = getattr(event, "recorded_at", None)
    payload = getattr(event, "payload", {})

    payload_obj = payload if isinstance(payload, dict) else {}
    health = payload_obj.get("health") if isinstance(payload_obj.get("health"), dict) else {}
    generated_alerts = payload_obj.get("generated_alerts")

    alert_count = len(generated_alerts) if isinstance(generated_alerts, list) else 0
    health_index = health.get("health_index") if isinstance(health, dict) else None
    health_level = health.get("level") if isinstance(health, dict) else None

    return [
        str(train_id),
        recorded_at.isoformat() if recorded_at else "",
        "" if health_index is None else str(health_index),
        "" if health_level is None else str(health_level),
        str(alert_count),
        json.dumps(payload_obj, ensure_ascii=True),
    ]


def _get_dispatcher(request: Request) -> DispatcherProcessor:
    dispatcher = getattr(request.app.state, "dispatcher", None)
    if dispatcher is None:
        raise HTTPException(status_code=503, detail="Dispatcher is not initialized")
    return dispatcher


@router.get("/latest")
async def latest_trains(request: Request) -> dict:
    dispatcher = _get_dispatcher(request)
    latest = await dispatcher.aggregator.get_latest_all()
    data = [event.model_dump(mode="json") for event in latest.values()]
    return {"count": len(data), "data": data}


@router.get("/{train_id}")
async def latest_train(train_id: str, request: Request) -> dict:
    dispatcher = _get_dispatcher(request)
    latest = await dispatcher.aggregator.get_latest(train_id)
    if latest is None:
        raise HTTPException(status_code=404, detail="Train not found")
    return latest.model_dump(mode="json")


@router.get("/{train_id}/history")
async def train_history(
    train_id: str,
    request: Request,
    minutes: int = Query(default=10, ge=1, le=1440),
    limit: int = Query(default=1000, ge=1, le=10000),
) -> dict:
    dispatcher = _get_dispatcher(request)
    history = await asyncio.to_thread(
        dispatcher.repository.get_history,
        train_id,
        minutes,
        limit,
    )
    return {"count": len(history), "data": history}


@router.get("/history/csv")
async def export_history_csv(
    request: Request,
    minutes: int = Query(default=10, ge=1, le=10080),
    limit: int = Query(default=10000, ge=1, le=100000),
) -> StreamingResponse:
    dispatcher = _get_dispatcher(request)
    events = await asyncio.to_thread(
        dispatcher.repository.get_recent_events,
        minutes,
        limit,
    )

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "train_id",
            "recorded_at",
            "health_index",
            "health_level",
            "alert_count",
            "payload_json",
        ]
    )

    for event in events:
        writer.writerow(_csv_row_from_event(event))

    content = buffer.getvalue()
    buffer.close()

    filename = f"trains_last_{minutes}_minutes.csv"
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
