# HackNU26 Telemetry Platform

HackNU26 is a two-service train telemetry platform built as a monorepo. It contains a simulator-driven train service and a dispatcher service that consumes, enriches, stores, and serves telemetry to dashboards.

The platform is split into two independent stacks:

- `train-service` generates telemetry, broadcasts it over WebSocket, and publishes it to RabbitMQ.
- `dispatcher-service` consumes RabbitMQ telemetry, computes health and alerts, stores events in PostgreSQL, and exposes REST and WebSocket APIs for dashboards.

Each service also has its own frontend dashboard.

## High-Level Flow

1. The train service simulator creates telemetry payloads for one or more trains.
2. The train service broadcasts the payloads to connected WebSocket clients.
3. The train service publishes the same payloads to RabbitMQ.
4. The dispatcher service consumes RabbitMQ messages.
5. The dispatcher enriches each payload with health calculations and alert data.
6. The dispatcher stores the enriched events in PostgreSQL.
7. The dispatcher broadcasts enriched telemetry to its own WebSocket clients.
8. The dispatcher frontend renders the live dashboard from the WebSocket stream.

In short:

`train-service -> RabbitMQ -> dispatcher-service -> frontend`

## Repository Layout

- `train-service/`
  - `backend/`: FastAPI simulator, RabbitMQ publisher, WebSocket stream, PostgreSQL persistence, tests.
  - `frontend/`: React dashboard for the train telemetry view.
- `dispatcher-service/`
  - `backend/`: FastAPI consumer, health and alert processing, PostgreSQL persistence, WebSocket fanout, tests.
  - `frontend/`: React operations dashboard that consumes dispatcher telemetry.

## What Each Service Does

### Train Service

The train service is the source of telemetry. Its backend runs a simulator that periodically creates train payloads and pushes them through two channels:

- WebSocket for real-time clients.
- RabbitMQ for downstream processing.

Its backend also exposes helper endpoints for health, simulator status, and telemetry-related views. The frontend is a live dashboard that connects to the train service WebSocket stream and visualizes the current state of the simulated trains.

### Dispatcher Service

The dispatcher service is the processing layer. It listens for telemetry messages from RabbitMQ, then:

- parses the raw payload
- keeps the latest state per train in memory
- calculates a health index and health level
- generates threshold-based alerts
- persists enriched events into PostgreSQL
- broadcasts enriched telemetry to connected WebSocket clients

Health is calculated in the dispatcher backend by `app/services/health_calculator.py`. The rules are:

- If the incoming payload already includes a valid `metrics.health` block from the train service, the dispatcher keeps that health value and labels the explanation as coming from the simulator.
- Otherwise, the dispatcher starts at a health index of 100 and subtracts penalties for suspicious values.
- Penalties are applied for speed above 100 km/h, temperature above 95 C, brake pressure below 300 kPa, voltage outside the normal range, traction current above 700 A, and any incoming train alerts.
- More severe thresholds use larger penalties, for example speed above 110 km/h, temperature above 110 C, brake pressure below 200 kPa, voltage far outside the normal range, and current above 900 A.
- The final index is clamped to the 0-100 range and mapped to a level: `normal` for 70-100, `warning` for 50-69, and `critical` for below 50.
- The health explanation contains the top contributing factors, or a default message when no penalties were applied.

Its frontend is the operations dashboard. It connects to the dispatcher WebSocket endpoint, falls back across configured URLs when needed, and renders health, metrics, alerts, and train status.

## Runtime Architecture

### Train Service Backend

Core backend pieces:

- `app/simulator/`: generates telemetry payloads on each tick.
- `app/bus/publisher.py`: publishes telemetry to RabbitMQ.
- `app/core/websocket_manager.py`: manages WebSocket connections and fanout.
- `app/api/routes/ws.py`: serves the `/ws/telemetry` stream.
- `app/main.py`: creates the runtime, starts the simulator, and wires the FastAPI app.

### Dispatcher Service Backend

Core backend pieces:

- `app/bus/consumer.py`: receives telemetry from RabbitMQ.
- `app/services/dispatcher.py`: orchestrates processing, persistence, and broadcast.
- `app/services/aggregator.py`: keeps the latest train state in memory.
- `app/services/health_calculator.py`: derives health scores and levels.
- `app/services/alert_engine.py`: builds alert data from telemetry thresholds.
- `app/db/repository.py`: stores and queries telemetry history in PostgreSQL.
- `app/api/rest/trains.py`: exposes latest and history endpoints.
- `app/api/ws/telemetry_ws.py`: serves the dispatcher WebSocket stream.
- `app/main.py`: initializes the consumer, services, database, and API.

### Frontends

Both frontends are React + Vite applications. They use the same basic telemetry UI pattern, but they connect to different backends.

- The train frontend reads the train simulator WebSocket stream.
- The dispatcher frontend reads the enriched dispatcher WebSocket stream and is usually the main operations view.

The dispatcher frontend supports configurable WebSocket URLs through environment variables and automatic reconnect behavior.

## Local Development

The two services can be run independently. Start the stack you want to work on, along with its dependencies.

### Train Service

1. Install backend dependencies and start the database.
2. Run migrations and seed data if needed.
3. Start the simulator backend.
4. Start the train frontend.

Typical commands:

```bash
cd train-service/backend
docker compose up -d db
uv sync
uv run alembic upgrade head
uv run python app/initial_data.py
uv run fastapi dev app/main.py
```

```bash
cd train-service/frontend
npm install
npm run dev
```

### Dispatcher Service

1. Start PostgreSQL.
2. Make sure RabbitMQ is available.
3. Run migrations.
4. Start the dispatcher backend.
5. Start the dispatcher frontend.

Typical commands:

```bash
cd dispatcher-service/backend
docker compose -f compose.yml up -d db
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

```bash
cd dispatcher-service/frontend
npm install
npm run dev
```

## Useful URLs

These are the common local endpoints used by the project:

- Train backend WebSocket: `/ws/telemetry`
- Dispatcher backend WebSocket: `/ws/telemetry`
- Dispatcher train history API: `/trains/{train_id}/history`
- Dispatcher latest trains API: `/trains/latest`
- OpenAPI docs: `/docs`

Exact host and port values depend on your local environment and the `.env` files for each service.

## Configuration Notes

### Dispatcher Frontend WebSocket URLs

The dispatcher frontend can use these environment variables:

- `VITE_TELEMETRY_WS_URL`
- `VITE_TELEMETRY_WS_URLS`
- `VITE_TELEMETRY_WS_DEBUG`

If no value is provided, it falls back to the current host and common local development ports.

### Backend Dependencies

The main backend dependencies are:

- FastAPI
- SQLModel / SQLAlchemy
- PostgreSQL
- RabbitMQ
- Pydantic v2
- Alembic

## Testing and Quality

Each service includes its own tests and tooling. Run the checks from the relevant backend folder.

```bash
uv run pytest -q
uv run ruff check app
```

Frontends use the standard Vite/TypeScript build and lint commands:

```bash
npm run build
npm run lint
```

## Suggested Starting Point

If you are new to the project, start with these files:

- [train-service/backend/app/main.py](train-service/backend/app/main.py)
- [dispatcher-service/backend/app/main.py](dispatcher-service/backend/app/main.py)
- [dispatcher-service/frontend/src/lib/ws.ts](dispatcher-service/frontend/src/lib/ws.ts)
- [train-service/backend/app/simulator/runtime.py](train-service/backend/app/simulator/runtime.py)

These files show how the simulator starts, how telemetry moves through RabbitMQ, and how the dashboards connect.
