"""Reexporta los modelos para que SQLAlchemy registre todas las tablas."""

from app.models.entities import (  # noqa: F401
    Payment,
    Request,
    RequestCargoItem,
    User,
    UserFactor,
    Vehicle,
)

__all__ = [
    "Payment",
    "Request",
    "RequestCargoItem",
    "User",
    "UserFactor",
    "Vehicle",
]
