import uuid
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    ItemCreate,
    TelemetryEvent,
    TelemetryEventPublic,
    User,
    UserCreate,
    UserUpdate,
)


MAX_TELEMETRY_EVENTS = 10_000_000


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        # Prevent timing attacks by running password verification even when user doesn't exist
        # This ensures the response time is similar whether or not the email exists
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def create_telemetry_events(
    *, session: Session, payloads: list[dict[str, Any]]
) -> list[TelemetryEvent]:
    valid_payloads: list[tuple[str, dict[str, Any]]] = []
    for payload in payloads:
        locomotive = payload.get("locomotive")
        if not isinstance(locomotive, dict):
            continue

        train_id = locomotive.get("id")
        if not isinstance(train_id, str) or not train_id:
            continue

        valid_payloads.append((train_id, payload))

    if not valid_payloads:
        return []

    if len(valid_payloads) > MAX_TELEMETRY_EVENTS:
        valid_payloads = valid_payloads[-MAX_TELEMETRY_EVENTS:]

    events: list[TelemetryEvent] = []
    for train_id, payload in valid_payloads:
        event = TelemetryEvent(train_id=train_id, payload=payload)
        session.add(event)
        events.append(event)

    session.flush()

    current_count = session.exec(
        select(func.count()).select_from(TelemetryEvent)
    ).one()
    overflow = current_count - MAX_TELEMETRY_EVENTS
    if overflow > 0:
        oldest_rows = session.exec(
            select(TelemetryEvent)
            .order_by(TelemetryEvent.recorded_at.asc(), TelemetryEvent.id.asc())
            .limit(overflow)
        ).all()
        for row in oldest_rows:
            session.delete(row)

    session.commit()
    for event in events:
        session.refresh(event)
    return events


def get_telemetry_events(
    *, session: Session, limit: int = 100, train_id: str | None = None
) -> list[TelemetryEventPublic]:
    statement = select(TelemetryEvent).order_by(TelemetryEvent.recorded_at.desc())
    if train_id:
        statement = statement.where(TelemetryEvent.train_id == train_id)

    statement = statement.limit(limit)
    rows = session.exec(statement).all()
    return [TelemetryEventPublic.model_validate(row) for row in rows]
