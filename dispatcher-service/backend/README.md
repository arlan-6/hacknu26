# Dispatcher Service Backend

Dispatcher service for the Train Telemetry Platform.

This service consumes train telemetry events from RabbitMQ, computes health and alerts, stores events in PostgreSQL, and exposes unified REST + WebSocket interfaces for frontend dashboards.

Architecture:

`train-service -> RabbitMQ -> dispatcher-service -> frontend`

## Main Responsibilities

- Consume telemetry from RabbitMQ fanout exchange.
- Parse incoming JSON into a Pydantic telemetry payload model.
- Maintain in-memory latest state per train.
- Compute health index and status level for each event.
- Generate threshold-based alerts.
- Persist enriched events to PostgreSQL (`telemetry_event` table).
- Broadcast enriched telemetry to connected WebSocket clients.
- Serve latest and history APIs for frontend clients.

## Tech Stack

- FastAPI
- SQLModel + SQLAlchemy
- PostgreSQL
- RabbitMQ (`aio-pika`)
- Pydantic v2
- Alembic
- asyncio

## Project Structure

```text
.
|-- app/
|   |-- api/
|   |   |-- rest/
|   |   |   \-- trains.py            # /trains endpoints
|   |   \-- ws/
|   |       \-- telemetry_ws.py      # /ws/telemetry endpoint
|   |-- bus/
|   |   \-- consumer.py              # RabbitMQ consumer with reconnect
|   |-- core/
|   |   |-- config.py
|   |   |-- db.py
|   |   \-- websocket_manager.py
|   |-- db/
|   |   \-- repository.py            # telemetry storage/history queries
|   |-- schemas/
|   |   \-- telemetry.py
|   |-- services/
|   |   |-- aggregator.py            # latest_state per train
|   |   |-- alert_engine.py
|   |   |-- dispatcher.py            # orchestrates process/persist/broadcast
|   |   \-- health_calculator.py
|   |-- models.py                    # includes TelemetryEvent SQLModel
|   \-- main.py                      # app startup + consumer lifecycle
|-- compose.yml                      # local PostgreSQL only
|-- alembic.ini
|-- pyproject.toml
\-- tests/
```

## Runtime Flow

1. On startup, FastAPI initializes DB tables and starts a background RabbitMQ consumer.
2. For each telemetry message:
   - parse payload
   - update latest state (`latest_state[train_id]`)
   - compute health index (`0-100`, `normal|warning|critical`)
   - generate alerts (`info|warning|critical`)
   - persist event payload to PostgreSQL
   - broadcast enriched payload over `/ws/telemetry`
3. If RabbitMQ is unavailable, consumer retries and logs errors without crashing the API process.

## API Endpoints

REST:

- `GET /api/v1/utils/health-check/`
- `GET /trains/latest`
- `GET /trains/{train_id}`
- `GET /trains/{train_id}/history?minutes=10&limit=1000`
- `GET /trains/history/csv?minutes=10&limit=10000`

WebSocket:

- `/ws/telemetry`

## Environment Variables

Core:

- `PROJECT_NAME`
- `ENVIRONMENT`
- `POSTGRES_SERVER`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Dispatcher/RabbitMQ:

- `AMQP_URL` (example: `amqp://guest:guest@localhost/`)
- `TELEMETRY_EXCHANGE` (default: `telemetry`)
- `TELEMETRY_QUEUE` (default: `dispatcher.telemetry`)
- `TELEMETRY_PREFETCH` (default: `100`)
- `TELEMETRY_RETENTION_ROWS` (default: `10000`)

Note: RabbitMQ is expected to be already running externally. Current `compose.yml` does not start RabbitMQ.

## Local Development

Prerequisites:

- Python 3.10+
- `uv`
- PostgreSQL
- RabbitMQ (already running)

1. Install dependencies:

```bash
uv sync
```

2. Ensure `.env` has valid Postgres and RabbitMQ settings.

3. Start PostgreSQL with Docker (optional):

```bash
docker compose -f compose.yml up -d db
```

4. Apply migrations:

```bash
uv run alembic upgrade head
```

5. Start backend:

```bash
uv run fastapi dev app/main.py
```

6. Open docs:

- Swagger UI: http://localhost:8000/docs

## Quick Smoke Checks

1. Check health endpoint:

```bash
curl http://localhost:8000/api/v1/utils/health-check/
```

2. Check latest trains endpoint:

```bash
curl http://localhost:8000/trains/latest
```

3. Connect frontend/client to:

- WebSocket: `ws://localhost:8000/ws/telemetry`

## Testing and Quality

Run tests:

```bash
uv run pytest -q
```

Run lint:

```bash
uv run ruff check app
```
