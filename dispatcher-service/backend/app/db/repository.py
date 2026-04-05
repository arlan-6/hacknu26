from datetime import datetime, timedelta, timezone

from sqlmodel import Session, delete, func, select

from app.core.config import settings
from app.core.db import engine
from app.models import TelemetryEvent
from app.schemas.telemetry import EnrichedTelemetry


class TelemetryRepository:
    def __init__(self, retention_rows: int | None = None) -> None:
        self.retention_rows = retention_rows or settings.TELEMETRY_RETENTION_ROWS

    def insert_event(self, enriched: EnrichedTelemetry) -> None:
        payload_dict = enriched.model_dump(mode="json")
        event = TelemetryEvent(
            train_id=enriched.payload.train_id,
            recorded_at=enriched.payload.recorded_at,
            payload=payload_dict,
        )

        with Session(engine) as session:
            session.add(event)
            session.commit()
            if self.retention_rows > 0:
                self._trim_if_needed(session)

    def _trim_if_needed(self, session: Session) -> None:
        count = session.exec(select(func.count()).select_from(TelemetryEvent)).one()
        overflow = int(count) - self.retention_rows
        if overflow <= 0:
            return

        ids_to_delete = session.exec(
            select(TelemetryEvent.id)
            .order_by(TelemetryEvent.recorded_at.asc())
            .limit(overflow)
        ).all()
        if ids_to_delete:
            session.exec(delete(TelemetryEvent).where(TelemetryEvent.id.in_(ids_to_delete)))
            session.commit()

    def get_history(self, train_id: str, minutes: int, limit: int = 1000) -> list[dict]:
        earliest = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        with Session(engine) as session:
            rows = session.exec(
                select(TelemetryEvent)
                .where(
                    TelemetryEvent.train_id == train_id,
                    TelemetryEvent.recorded_at >= earliest,
                )
                .order_by(TelemetryEvent.recorded_at.desc())
                .limit(limit)
            ).all()
        return [row.payload for row in rows]

    def get_recent_events(self, minutes: int, limit: int = 10000) -> list[TelemetryEvent]:
        earliest = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        with Session(engine) as session:
            rows = session.exec(
                select(TelemetryEvent)
                .where(TelemetryEvent.recorded_at >= earliest)
                .order_by(TelemetryEvent.recorded_at.desc())
                .limit(limit)
            ).all()
        return rows
