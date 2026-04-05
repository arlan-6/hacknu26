import asyncio
import websockets

async def main():
    try:
        async with websockets.connect("ws://127.0.0.1:8001/ws/telemetry") as ws:
            print("connected")
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2)
                print("message", msg[:120])
            except Exception as exc:
                print("no_message", type(exc).__name__)
    except Exception as exc:
        print("connect_failed", type(exc).__name__, exc)

asyncio.run(main())
