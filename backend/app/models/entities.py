"""Entidades del dominio.

Cada modelo coincide con las tablas definidas en backend/sql/schema.sql.
Los estados se validan con CheckConstraints usando literales en espanol,
exactamente los mismos que consume el frontend.
"""

from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

REQUEST_STATUSES = (
    "Pendiente de revisión",
    "Pendiente de seña",
    "Confirmada",
    "Cancelada",
)
DRIVER_STATUSES = ("Activo", "Inactivo")
VEHICLE_STATUSES = ("Disponible", "Asignado", "En taller")
PAYMENT_CONCEPTS = ("Seña", "Saldo")
PAYMENT_METHODS = ("Transferencia", "Efectivo")
RECEIVED_BY = ("Administración", "Chofer")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)

    requests: Mapped[list["Request"]] = relationship(back_populates="client")

    __table_args__ = (UniqueConstraint("name", "phone", name="uq_clients_name_phone"),)


class Driver(Base, TimestampMixin):
    __tablename__ = "drivers"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    initials: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="Activo")
    base_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    rate_per_km: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    rate_per_hour: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    factors: Mapped[list["DriverFactor"]] = relationship(
        back_populates="driver", cascade="all, delete-orphan", order_by="DriverFactor.position"
    )
    requests: Mapped[list["Request"]] = relationship(back_populates="driver")

    __table_args__ = (
        CheckConstraint(_in_list("status", DRIVER_STATUSES), name="ck_drivers_status"),
    )


class DriverFactor(Base, TimestampMixin):
    __tablename__ = "driver_factors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    driver_id: Mapped[str] = mapped_column(
        Text, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    driver: Mapped["Driver"] = relationship(back_populates="factors")

    __table_args__ = (Index("ix_driver_factors_driver_id", "driver_id"),)


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    capacity_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="Disponible")
    assigned_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    requests: Mapped[list["Request"]] = relationship(back_populates="vehicle")

    __table_args__ = (
        CheckConstraint(_in_list("status", VEHICLE_STATUSES), name="ck_vehicles_status"),
        CheckConstraint("capacity_kg > 0", name="ck_vehicles_capacity_positive"),
    )


class Request(Base, TimestampMixin):
    __tablename__ = "requests"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # FEX-1048
    client_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    client_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="Pendiente de revisión")
    date: Mapped[date] = mapped_column(Date, nullable=False)

    arrival_from: Mapped[time] = mapped_column(Time, nullable=False)
    arrival_to: Mapped[time] = mapped_column(Time, nullable=False)
    service_from: Mapped[time] = mapped_column(Time, nullable=False)
    service_to: Mapped[time] = mapped_column(Time, nullable=False)

    origin_address: Mapped[str] = mapped_column(Text, nullable=False)
    origin_barrio: Mapped[str] = mapped_column(Text, nullable=False)
    origin_floor: Mapped[str] = mapped_column(Text, nullable=False)
    origin_elevator: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    destination_address: Mapped[str] = mapped_column(Text, nullable=False)
    destination_barrio: Mapped[str] = mapped_column(Text, nullable=False)
    destination_floor: Mapped[str] = mapped_column(Text, nullable=False)
    destination_elevator: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    cargo_approx_units: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cargo_fragile: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cargo_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")

    driver_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        Text, ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True
    )

    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    deposit_required: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    estimated_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)

    arrived_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    finished_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    remito_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    remito_data_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped["Client"] = relationship(back_populates="requests")
    driver: Mapped["Driver | None"] = relationship(back_populates="requests")
    vehicle: Mapped["Vehicle | None"] = relationship(back_populates="requests")
    cargo_items: Mapped[list["RequestCargoItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="RequestCargoItem.position"
    )
    incidents: Mapped[list["Incident"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="Incident.time"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="Payment.date"
    )

    __table_args__ = (
        CheckConstraint(_in_list("status", REQUEST_STATUSES), name="ck_requests_status"),
        CheckConstraint("deposit_required >= 0", name="ck_requests_deposit_non_negative"),
        CheckConstraint("price >= 0", name="ck_requests_price_non_negative"),
        Index("ix_requests_date", "date"),
        Index("ix_requests_status", "status"),
        Index("ix_requests_client_id", "client_id"),
        Index("ix_requests_driver_id", "driver_id"),
        Index("ix_requests_vehicle_id", "vehicle_id"),
    )


class RequestCargoItem(Base, TimestampMixin):
    __tablename__ = "request_cargo_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(
        Text, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    units: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    request: Mapped["Request"] = relationship(back_populates="cargo_items")

    __table_args__ = (Index("ix_request_cargo_items_request_id", "request_id"),)


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # INC-1001
    request_id: Mapped[str] = mapped_column(
        Text, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    time: Mapped[str] = mapped_column(Text, nullable=False)

    request: Mapped["Request"] = relationship(back_populates="incidents")

    __table_args__ = (Index("ix_incidents_request_id", "request_id"),)


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(
        Text, ForeignKey("requests.id", ondelete="CASCADE"), nullable=False
    )
    concept: Mapped[str] = mapped_column(Text, nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)
    received_by: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    request: Mapped["Request"] = relationship(back_populates="payments")

    __table_args__ = (
        CheckConstraint(_in_list("concept", PAYMENT_CONCEPTS), name="ck_payments_concept"),
        CheckConstraint(_in_list("method", PAYMENT_METHODS), name="ck_payments_method"),
        CheckConstraint(_in_list("received_by", RECEIVED_BY), name="ck_payments_received_by"),
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
        Index("ix_payments_request_id", "request_id"),
        Index("ix_payments_date", "date"),
    )
