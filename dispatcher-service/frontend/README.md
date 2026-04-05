# Frontend README

React + Vite dashboard for live train telemetry.

## Features

- Realtime telemetry view from backend WebSocket stream.
- Connection state indicator.
- Multi-train payload handling.
- Debug logs for websocket lifecycle and message processing.

## Requirements

- Node.js 20+
- npm
- Dispatcher backend running (typically port 8001)

## Run

1. Install dependencies.

```bash
npm install
```

2. Start dev server.

```bash
npm run dev
```

3. Open the local URL shown in terminal (for example http://localhost:5174).

## Build

```bash
npm run build
```

## WebSocket Configuration

By default, frontend connects to:

- ws://127.0.0.1:8001/ws/telemetry (primary fallback)
- ws://127.0.0.1:8000/ws/telemetry (secondary fallback)

You can override with env variable:

```env
VITE_TELEMETRY_WS_URL=ws://127.0.0.1:8001/ws/telemetry
```

Or provide multiple candidates (comma-separated):

```env
VITE_TELEMETRY_WS_URLS=ws://127.0.0.1:8001/ws/telemetry,ws://127.0.0.1:8000/ws/telemetry
```

Optional debug toggle:

```env
VITE_TELEMETRY_WS_DEBUG=true
```

## Troubleshooting

- If status stays connecting, verify backend is reachable at http://127.0.0.1:8001/docs.
- If WS is connected but numbers do not change, verify backend history endpoint returns fresh rows:

```bash
curl "http://127.0.0.1:8001/trains/latest"
curl "http://127.0.0.1:8001/trains/T-1/history?minutes=10&limit=5"
```
