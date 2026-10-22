"""Base declarativa de SQLAlchemy 2.x."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Campos de auditoria comunes a todas las tablas.

    La base esta en espanol: las columnas son `creado_en` / `actualizado_en`.
    El atributo de Python queda en ingles para no tocar el resto del codigo.
    """

    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        "actualizado_en",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
