"""Add telemetry event table

Revision ID: 3f9f4f11b2f2
Revises: fe56fa70289e
Create Date: 2026-04-04 12:40:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "3f9f4f11b2f2"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "telemetryevent",
        sa.Column("train_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_telemetryevent_train_id"), "telemetryevent", ["train_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_telemetryevent_train_id"), table_name="telemetryevent")
    op.drop_table("telemetryevent")
