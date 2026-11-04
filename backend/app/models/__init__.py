"""Reexporta los modelos para que SQLAlchemy registre todas las tablas."""

from app.models.entities import (  # noqa: F401
    ConfiguracionSistema,
    ItemCarga,
    Pago,
    Solicitud,
    Usuario,
    Vehiculo,
)

__all__ = [
    "ConfiguracionSistema",
    "Usuario",
    "Vehiculo",
    "Solicitud",
    "ItemCarga",
    "Pago",
]
