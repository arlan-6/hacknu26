from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import WebSocketManager
from app.services.dispatcher import DispatcherProcessor

router = APIRouter(tags=["telemetry-ws"])


@router.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket) -> None:
    manager = getattr(websocket.app.state, "websocket_manager", None)
    if not isinstance(manager, WebSocketManager):
        await websocket.close(code=1011)
        return

    await manager.connect(websocket)

    dispatcher = getattr(websocket.app.state, "dispatcher", None)
    if isinstance(dispatcher, DispatcherProcessor):
        latest = await dispatcher.aggregator.get_latest_all()
        for event in latest.values():
            await websocket.send_json(event.model_dump(mode="json"))

    try:
        # Keep the socket open; clients may send pings/heartbeats.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
