# Train Service Project

Monorepo for a train telemetry platform with:

- Backend API and simulator (FastAPI, SQLModel, PostgreSQL).
- Frontend dashboard (React, Vite, TypeScript).
- WebSocket realtime stream + persisted telemetry history.

## Repository Layout

- backend: FastAPI service, simulator, migrations, tests.
- frontend: React dashboard UI.

## Quick Start

1. Start database.

```bash
cd backend
docker compose up -d db
```

2. Apply backend migrations.

```bash
cd backend
uv run alembic upgrade head
```

3. Seed initial data.

```bash
cd backend
uv run python app/initial_data.py
```

4. Start backend.

```bash
cd backend
uv run fastapi dev app/main.py
```

5. Start frontend.

```bash
cd frontend
npm install
npm run dev
```

6. Open frontend local URL shown in terminal.

## Telemetry Data Flow

1. Simulator generates train payloads each tick.
2. Backend broadcasts payloads through /ws/telemetry.
3. Backend stores each payload in PostgreSQL telemetryevent table.
4. Frontend receives messages and updates cards in realtime.

## Useful API Endpoints

- GET /ws/telemetry
- GET /api/latest
- GET /api/history?limit=100
- GET /api/history?train_id=train-01
- GET /simulator/status

## Notes

- Keep backend and frontend running at the same time.
- Ensure backend .env CORS origins include your active Vite port.
- When port 5173 is busy, Vite may switch to 5174 or another port.
