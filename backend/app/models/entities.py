"""Entidades del dominio.

Cada modelo coincide con las tablas definidas en backend/sql/schema.sql.

La BASE está en español (tablas, columnas, índices y restricciones), pero los
atributos de Python y el contrato de la API (JSON) siguen en inglés: así el
frontend no cambia y la capa de la base queda como la pidió el equipo.

Los estados se validan con CheckConstraints usando literales en español,
exactamente los mismos que consume el frontend.
"""

from __future__ import annotations

import uuid
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
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

REQUEST_STATUSES = (
    "Pendiente de revisión",
    "Pendiente de seña",
    "Confirmada",
    "Cancelada",
)
USER_ROLES = ("admin", "chofer", "cliente")
USER_STATUSES = ("Activo", "Inactivo")
VEHICLE_STATUSES = ("Disponible", "Asignado", "En taller")
PAYMENT_CONCEPTS = ("Seña", "Saldo")
PAYMENT_METHODS = ("Transferencia", "Cuenta corriente", "Efectivo")
RECEIVED_BY = ("Administración", "Chofer")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class User(Base, TimestampMixin):
    """Administradores, choferes y clientes comparten la misma tabla."""

    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    role: Mapped[str] = mapped_column("rol", Text, nullable=False, default="cliente")
    name: Mapped[str] = mapped_column("nombre", Text, nullable=False)
    phone: Mapped[str] = mapped_column("telefono", Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Cuenta de Supabase Auth vinculada a este usuario (se completa en el
    # primer ingreso, cuando el email de la cuenta coincide con usuarios.email).
    auth_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, unique=True)
    initials: Mapped[str | None] = mapped_column("iniciales", Text, nullable=True)
    status: Mapped[str] = mapped_column("estado", Text, nullable=False, default="Activo")
    base_rate: Mapped[float] = mapped_column("tarifa_base", Numeric(12, 2), nullable=False, default=0)
    rate_per_km: Mapped[float] = mapped_column("tarifa_por_km", Numeric(12, 2), nullable=False, default=0)
    rate_per_hour: Mapped[float] = mapped_column("tarifa_por_hora", Numeric(12, 2), nullable=False, default=0)

    factors: Mapped[list["UserFactor"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="UserFactor.position"
    )
    client_requests: Mapped[list["Request"]] = relationship(
        back_populates="client", foreign_keys="Request.client_id"
    )
    driver_requests: Mapped[list["Request"]] = relationship(
        back_populates="driver", foreign_keys="Request.driver_id"
    )

    __table_args__ = (
        CheckConstraint(_in_list("rol", USER_ROLES), name="ck_usuarios_rol"),
        CheckConstraint(_in_list("estado", USER_STATUSES), name="ck_usuarios_estado"),
        UniqueConstraint("rol", "telefono", name="uq_usuarios_rol_telefono"),
        UniqueConstraint("email", name="uq_usuarios_email"),
    )


class UserFactor(Base, TimestampMixin):
    """Factores extra de la tarifa de un chofer."""

    __tablename__ = "factores_tarifa"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        "usuario_id", Text, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column("etiqueta", Text, nullable=False)
    amount: Mapped[float] = mapped_column("monto", Numeric(12, 2), nullable=False, default=0)
    position: Mapped[int] = mapped_column("posicion", Integer, nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="factors")

    __table_args__ = (Index("ix_factores_tarifa_usuario_id", "usuario_id"),)


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehiculos"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    type: Mapped[str] = mapped_column("tipo", Text, nullable=False)
    capacity_kg: Mapped[int] = mapped_column("capacidad_kg", Integer, nullable=False)
    status: Mapped[str] = mapped_column("estado", Text, nullable=False, default="Disponible")
    assigned_note: Mapped[str | None] = mapped_column("nota_asignacion", Text, nullable=True)

    requests: Mapped[list["Request"]] = relationship(back_populates="vehicle")

    __table_args__ = (
        CheckConstraint(_in_list("estado", VEHICLE_STATUSES), name="ck_vehiculos_estado"),
        CheckConstraint("capacidad_kg > 0", name="ck_vehiculos_capacidad_positiva"),
    )


class Request(Base, TimestampMixin):
    __tablename__ = "solicitudes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # FEX-1048
    client_id: Mapped[str] = mapped_column(
        "cliente_id", Text, ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )
    client_name: Mapped[str] = mapped_column("cliente_nombre", Text, nullable=False)
    phone: Mapped[str] = mapped_column("telefono", Text, nullable=False)
    status: Mapped[str] = mapped_column("estado", Text, nullable=False, default="Pendiente de revisión")
    date: Mapped[date] = mapped_column("fecha", Date, nullable=False)

    arrival_from: Mapped[time] = mapped_column("llegada_desde", Time, nullable=False)
    arrival_to: Mapped[time] = mapped_column("llegada_hasta", Time, nullable=False)
    service_from: Mapped[time] = mapped_column("servicio_desde", Time, nullable=False)
    service_to: Mapped[time] = mapped_column("servicio_hasta", Time, nullable=False)

    origin_address: Mapped[str] = mapped_column("origen_direccion", Text, nullable=False)
    origin_barrio: Mapped[str] = mapped_column("origen_barrio", Text, nullable=False)
    origin_floor: Mapped[str] = mapped_column("origen_piso", Text, nullable=False)
    origin_elevator: Mapped[bool] = mapped_column("origen_ascensor", Boolean, nullable=False, default=False)

    destination_address: Mapped[str] = mapped_column("destino_direccion", Text, nullable=False)
    destination_barrio: Mapped[str] = mapped_column("destino_barrio", Text, nullable=False)
    destination_floor: Mapped[str] = mapped_column("destino_piso", Text, nullable=False)
    destination_elevator: Mapped[bool] = mapped_column("destino_ascensor", Boolean, nullable=False, default=False)

    cargo_approx_units: Mapped[int] = mapped_column("carga_unidades", Integer, nullable=False, default=0)
    cargo_fragile: Mapped[bool] = mapped_column("carga_fragil", Boolean, nullable=False, default=False)
    cargo_notes: Mapped[str] = mapped_column("carga_notas", Text, nullable=False, default="")

    driver_id: Mapped[str | None] = mapped_column(
        "chofer_id", Text, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    vehicle_id: Mapped[str | None] = mapped_column(
        "vehiculo_id", Text, ForeignKey("vehiculos.id", ondelete="SET NULL"), nullable=True
    )

    price: Mapped[float] = mapped_column("precio", Numeric(12, 2), nullable=False, default=0)
    deposit_required: Mapped[float] = mapped_column("sena_requerida", Numeric(12, 2), nullable=False, default=0)
    estimated_km: Mapped[int | None] = mapped_column("km_estimados", Integer, nullable=True)
    estimated_hours: Mapped[int | None] = mapped_column("horas_estimadas", Integer, nullable=True)

    client: Mapped["User"] = relationship(
        back_populates="client_requests", foreign_keys=[client_id]
    )
    driver: Mapped["User | None"] = relationship(
        back_populates="driver_requests", foreign_keys=[driver_id]
    )
    vehicle: Mapped["Vehicle | None"] = relationship(back_populates="requests")
    cargo_items: Mapped[list["RequestCargoItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="RequestCargoItem.position"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="Payment.date"
    )

    __table_args__ = (
        CheckConstraint(_in_list("estado", REQUEST_STATUSES), name="ck_solicitudes_estado"),
        CheckConstraint("sena_requerida >= 0", name="ck_solicitudes_sena_no_negativa"),
        CheckConstraint("precio >= 0", name="ck_solicitudes_precio_no_negativo"),
        Index("ix_solicitudes_fecha", "fecha"),
        Index("ix_solicitudes_estado", "estado"),
        Index("ix_solicitudes_cliente_id", "cliente_id"),
        Index("ix_solicitudes_chofer_id", "chofer_id"),
        Index("ix_solicitudes_vehiculo_id", "vehiculo_id"),
    )


class RequestCargoItem(Base, TimestampMixin):
    __tablename__ = "items_carga"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(
        "solicitud_id", Text, ForeignKey("solicitudes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column("nombre", Text, nullable=False)
    units: Mapped[int] = mapped_column("unidades", Integer, nullable=False, default=1)
    note: Mapped[str | None] = mapped_column("nota", Text, nullable=True)
    position: Mapped[int] = mapped_column("posicion", Integer, nullable=False, default=0)

    request: Mapped["Request"] = relationship(back_populates="cargo_items")

    __table_args__ = (Index("ix_items_carga_solicitud_id", "solicitud_id"),)


class Payment(Base, TimestampMixin):
    __tablename__ = "pagos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[str] = mapped_column(
        "solicitud_id", Text, ForeignKey("solicitudes.id", ondelete="CASCADE"), nullable=False
    )
    concept: Mapped[str] = mapped_column("concepto", Text, nullable=False)
    method: Mapped[str] = mapped_column("metodo", Text, nullable=False)
    received_by: Mapped[str] = mapped_column("recibido_por", Text, nullable=False)
    amount: Mapped[float] = mapped_column("monto", Numeric(12, 2), nullable=False)
    date: Mapped[date] = mapped_column("fecha", Date, nullable=False)
    notes: Mapped[str | None] = mapped_column("notas", Text, nullable=True)
    remito_name: Mapped[str | None] = mapped_column("remito_nombre", Text, nullable=True)
    remito_data_url: Mapped[str | None] = mapped_column("remito_datos_url", Text, nullable=True)

    request: Mapped["Request"] = relationship(back_populates="payments")

    __table_args__ = (
        CheckConstraint(_in_list("concepto", PAYMENT_CONCEPTS), name="ck_pagos_concepto"),
        CheckConstraint(_in_list("metodo", PAYMENT_METHODS), name="ck_pagos_metodo"),
        CheckConstraint(_in_list("recibido_por", RECEIVED_BY), name="ck_pagos_recibido_por"),
        CheckConstraint("monto > 0", name="ck_pagos_monto_positivo"),
        Index("ix_pagos_solicitud_id", "solicitud_id"),
        Index("ix_pagos_fecha", "fecha"),
    )
