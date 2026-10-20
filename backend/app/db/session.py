"""Conexion y sesiones de base de datos.

El engine se crea de forma perezosa (lazy) para que la API pueda arrancar sin
base de datos configurada (por ejemplo, solo para inspeccionar /docs).
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


class DatabaseNotConfiguredError(RuntimeError):
    """La variable DATABASE_URL no esta definida."""


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings = get_settings()
        if not settings.database_configured:
            raise DatabaseNotConfiguredError(
                "DATABASE_URL no esta configurada. Defini la variable en el archivo .env."
            )
        url = settings.database_url
        connect_args: dict[str, object] = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            future=True,
            connect_args=connect_args,
        )
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: cede una sesion y la cierra siempre."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
