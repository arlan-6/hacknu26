from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def service_health(request: Request) -> dict[str, object]:
    runtime = request.app.state.telemetry_runtime
    websocket_manager = request.app.state.websocket_manager
    return {
        "status": "ok",
        "simulator_running": runtime.running,
        "connected_clients": websocket_manager.client_count,
    }
