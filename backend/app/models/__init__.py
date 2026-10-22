"""Reexporta los modelos para que SQLAlchemy registre todas las tablas."""

from app.models.entities import (  # noqa: F401
    Client,
    Driver,
    DriverFactor,
    Incident,
    Payment,
    Request,
    RequestCargoItem,
    Vehicle,
)

__all__ = [
    "Client",
    "Driver",
    "DriverFactor",
    "Incident",
    "Payment",
    "Request",
    "RequestCargoItem",
    "Vehicle",
]
