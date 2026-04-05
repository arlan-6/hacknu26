# Backend README

FastAPI backend for train telemetry simulation, websocket streaming, auth, and persistence.

## Features

- User auth and user management.
- Train simulator that emits live telemetry.a
- WebSocket stream at /ws/telemetry.
- Telemetry persistence into PostgreSQL for every emitted train payload.
- Automatic retention cap: maximum 1000 telemetry rows (oldest rows are replaced).
- REST APIs for latest telemetry and persisted history.

## Main Endpoints

- GET /docs
- GET /ws/telemetry
- GET /simulator/status
- GET /api/latest
- GET /api/history?limit=100&train_id=train-01

## Telemetry Storage

Telemetry is stored in table telemetryevent.

Columns:

- id (UUID)
- train_id (indexed text)
- recorded_at (timestamp with timezone)
- payload (JSON)

Persistence flow:

1. Simulator emits payload batch.
2. Each payload is broadcast to WebSocket clients.
3. Payload batch is persisted in Postgres.
4. Optional RabbitMQ publish runs as best effort.

## Bus (RabbitMQ)

The backend includes a bus publisher in app/bus/publisher.py.

How it works:

- Class: RabbitPublisher
- Transport: RabbitMQ via aio-pika
- Exchange type: FANOUT
- Exchange name: configured by TELEMETRY_EXCHANGE
- Payload format: compact JSON, content_type application/json

Runtime behavior:

1. On startup, backend tries to connect to RabbitMQ and declare the exchange.
2. During each telemetry tick, payloads are still broadcast to WebSocket clients and saved to Postgres.
3. Bus publish is best effort, so if RabbitMQ is down, simulator and API continue to work.

Related settings in backend .env:

- AMQP_URL
- TELEMETRY_EXCHANGE

## Setup

1. Install dependencies.

```bash
uv sync
```

2. Start Postgres (Docker recommended).

```bash
docker compose up -d db
```

3. Apply migrations.

```bash
uv run alembic upgrade head
```

4. Seed initial admin user.

```bash
uv run python app/initial_data.py
```

5. Run backend.

```bash
uv run fastapi dev app/main.py
```

## Verify Telemetry Persistence

1. Open websocket dashboard in frontend.
2. Call latest endpoint:

```bash
curl http://127.0.0.1:8000/api/latest
```

3. Call history endpoint:

```bash
curl "http://127.0.0.1:8000/api/history?limit=20"
```

4. Filter by train:

```bash
curl "http://127.0.0.1:8000/api/history?limit=20&train_id=train-01"
```

## Environment Notes

- Check backend .env for DB and CORS configuration.
- Ensure POSTGRES_PORT matches your running DB container port.
- For local frontend and backend, keep CORS origins aligned with your Vite port.

```bash
uv run fastapi dev app/main.py
```

Your local FastAPI instance will connect to the PostgreSQL container running on Docker Desktop.

**Useful commands:**

```bash
# View database logs:
docker compose logs -f db

# Stop the database:
docker compose down

# Stop and reset database (removes all data):
docker compose down -v

# Check container status:
docker compose ps
```

## Local Migration Workflow

Create a new migration after model changes:

```bash
uv run alembic revision --autogenerate -m "describe change"
```

Apply migrations:

```bash
uv run alembic upgrade head
```

## Testing and Quality

Run tests:

```bash
bash scripts/test.sh
```

Run linting:

```bash
bash scripts/lint.sh
```

Format code:

```bash
bash scripts/format.sh
```
