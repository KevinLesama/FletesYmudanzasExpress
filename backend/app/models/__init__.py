"""Reexporta los modelos para que SQLAlchemy registre todas las tablas."""

from app.models.entities import (  # noqa: F401
    ItemCarga,
    Pago,
    Solicitud,
    Usuario,
    Vehiculo,
)

__all__ = [
    "Usuario",
    "Vehiculo",
    "Solicitud",
    "ItemCarga",
    "Pago",
]
