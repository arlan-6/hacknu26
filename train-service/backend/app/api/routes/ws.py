from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["ws"])


@router.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket) -> None:
    runtime = websocket.app.state.telemetry_runtime
    websocket_manager = websocket.app.state.websocket_manager
    await websocket_manager.connect(websocket)

    for payload in runtime.latest_payloads():
        await websocket.send_json(payload)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
