"""Entidades del dominio.

Cada modelo coincide con las tablas definidas en backend/sql/schema.sql.
Los estados se validan con CheckConstraints usando literales en español/minúsculas
exactamente los que usa el esquema.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    FetchedValue,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

SOLICITUD_ESTADOS = ("pendiente", "confirmada", "finalizada", "cancelada")
USUARIO_ROLES = ("administrador", "chofer", "cliente")
VEHICULO_ESTADOS = ("disponible", "en_taller", "fuera_de_servicio")
PAGO_CONCEPTOS = ("sena", "saldo")
PAGO_METODOS = ("efectivo", "transferencia")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    rol: Mapped[str] = mapped_column(Text, nullable=False)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    telefono: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    licencia: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tarifa_base: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tarifa_por_km: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tarifa_por_hora: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    solicitudes_cliente: Mapped[list["Solicitud"]] = relationship(
        back_populates="cliente",
        foreign_keys="Solicitud.cliente_id",
    )
    solicitudes_chofer: Mapped[list["Solicitud"]] = relationship(
        back_populates="chofer",
        foreign_keys="Solicitud.chofer_id",
    )
    precios_modificados: Mapped[list["Solicitud"]] = relationship(
        back_populates="precio_modificado_por_usuario",
        foreign_keys="Solicitud.precio_modificado_por",
    )
    remitos_subidos: Mapped[list["Solicitud"]] = relationship(
        back_populates="remito_subido_por",
        foreign_keys="Solicitud.remito_subido_por_id",
    )
    pagos_recibidos: Mapped[list["Pago"]] = relationship(back_populates="recibido_por")

    __table_args__ = (
        CheckConstraint(_in_list("rol", USUARIO_ROLES), name="ck_usuarios_rol"),
        CheckConstraint("length(btrim(nombre)) > 0", name="ck_usuarios_nombre"),
        CheckConstraint(
            "length(regexp_replace(telefono, '\\D', '', 'g')) >= 6",
            name="ck_usuarios_telefono",
        ),
        CheckConstraint(
            "email IS NULL OR (position('@' IN email) > 1 AND email = btrim(email))",
            name="ck_usuarios_email",
        ),
        CheckConstraint(
            "rol = 'chofer' OR (tarifa_base = 0 AND tarifa_por_km = 0 AND tarifa_por_hora = 0)",
            name="ck_usuarios_tarifas",
        ),
        CheckConstraint("rol = 'chofer' OR licencia IS NULL", name="ck_usuarios_licencia"),
        CheckConstraint("rol = 'cliente' OR email IS NOT NULL", name="ck_usuarios_email_personal"),
        UniqueConstraint("id", "rol", name="uq_usuarios_id_rol"),
    )


class Vehiculo(Base):
    __tablename__ = "vehiculos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    patente: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(Text, nullable=False)
    capacidad_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[str] = mapped_column(Text, nullable=False, default="disponible")
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    solicitudes: Mapped[list["Solicitud"]] = relationship(back_populates="vehiculo")

    __table_args__ = (
        CheckConstraint(_in_list("estado", VEHICULO_ESTADOS), name="ck_vehiculos_estado"),
        CheckConstraint("capacidad_kg > 0", name="ck_vehiculos_capacidad"),
        CheckConstraint("length(btrim(patente)) > 0", name="ck_vehiculos_patente"),
        CheckConstraint("length(btrim(tipo)) > 0", name="ck_vehiculos_tipo"),
    )


class Solicitud(Base):
    __tablename__ = "solicitudes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    codigo: Mapped[str] = mapped_column(Text, nullable=False, server_default=FetchedValue())
    cliente_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    cliente_rol: Mapped[str] = mapped_column(Text, nullable=False, default="cliente")
    estado: Mapped[str] = mapped_column(Text, nullable=False, default="pendiente")
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora_desde: Mapped[time] = mapped_column(Time, nullable=False)
    hora_hasta: Mapped[time] = mapped_column(Time, nullable=False)

    origen_direccion: Mapped[str] = mapped_column(Text, nullable=False)
    origen_barrio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origen_piso: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origen_ascensor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    origen_notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    destino_direccion: Mapped[str] = mapped_column(Text, nullable=False)
    destino_barrio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    destino_piso: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    destino_ascensor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    destino_notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Geolocalizacion: se guarda el place_id y las coordenadas resueltas por el
    # backend (nunca coordenadas inventadas por el cliente).
    origen_place_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origen_lat: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    origen_lng: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    destino_place_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    destino_lat: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    destino_lng: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)

    chofer_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    chofer_rol: Mapped[str] = mapped_column(Text, nullable=False, default="chofer")
    vehiculo_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Recorrido y cotizacion.
    # km_estimados = distancia de IDA (lo que se muestra como recorrido).
    # km_total    = ida + vuelta (base del costo del chofer).
    km_estimados: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    km_vuelta: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    km_total: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    duracion_ida_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duracion_vuelta_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    espera_min: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    horas_estimadas: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    # Tarifas del chofer al momento de cotizar: si manana cambia su tarifa, el
    # viaje conserva el numero con el que se le pago.
    tarifa_base_aplicada: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    tarifa_km_aplicada: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    tarifa_hora_aplicada: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    costo_chofer: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    precio_calculado: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    precio_final: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    precio_modificado_por: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    precio_modificado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    remito_numero: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    remito_ruta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    remito_nombre: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    remito_subido_por_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    receptor_nombre: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    receptor_documento: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    finalizada_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_cancelacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    cliente: Mapped["Usuario"] = relationship(
        back_populates="solicitudes_cliente",
        foreign_keys=[cliente_id, cliente_rol],
        primaryjoin="and_(Solicitud.cliente_id==Usuario.id, Solicitud.cliente_rol==Usuario.rol)",
    )
    chofer: Mapped[Optional["Usuario"]] = relationship(
        back_populates="solicitudes_chofer",
        foreign_keys=[chofer_id, chofer_rol],
        primaryjoin="and_(Solicitud.chofer_id==Usuario.id, Solicitud.chofer_rol==Usuario.rol)",
    )
    vehiculo: Mapped[Optional["Vehiculo"]] = relationship(back_populates="solicitudes")
    precio_modificado_por_usuario: Mapped[Optional["Usuario"]] = relationship(
        back_populates="precios_modificados",
        foreign_keys=[precio_modificado_por],
    )
    remito_subido_por: Mapped[Optional["Usuario"]] = relationship(
        back_populates="remitos_subidos",
        foreign_keys=[remito_subido_por_id],
    )
    items_carga: Mapped[list["ItemCarga"]] = relationship(
        back_populates="solicitud", cascade="all, delete-orphan", order_by="ItemCarga.posicion"
    )
    pagos: Mapped[list["Pago"]] = relationship(
        back_populates="solicitud", cascade="all, delete-orphan", order_by="Pago.fecha"
    )

    __table_args__ = (
        CheckConstraint(_in_list("estado", SOLICITUD_ESTADOS), name="ck_solicitudes_estado"),
        CheckConstraint("hora_hasta > hora_desde", name="ck_solicitudes_ventana"),
        CheckConstraint(
            "length(btrim(origen_direccion)) > 0 AND length(btrim(destino_direccion)) > 0",
            name="ck_solicitudes_direcciones",
        ),
        CheckConstraint("km_estimados IS NULL OR km_estimados >= 0", name="ck_solicitudes_km"),
        CheckConstraint("km_vuelta IS NULL OR km_vuelta >= 0", name="ck_solicitudes_km_vuelta"),
        CheckConstraint("km_total IS NULL OR km_total >= 0", name="ck_solicitudes_km_total"),
        CheckConstraint("espera_min >= 0 AND espera_min <= 1440", name="ck_solicitudes_espera"),
        CheckConstraint(
            "(duracion_ida_min IS NULL OR duracion_ida_min >= 0)"
            " AND (duracion_vuelta_min IS NULL OR duracion_vuelta_min >= 0)",
            name="ck_solicitudes_duraciones",
        ),
        CheckConstraint(
            "(origen_lat IS NULL OR (origen_lat BETWEEN -90 AND 90))"
            " AND (origen_lng IS NULL OR (origen_lng BETWEEN -180 AND 180))"
            " AND (destino_lat IS NULL OR (destino_lat BETWEEN -90 AND 90))"
            " AND (destino_lng IS NULL OR (destino_lng BETWEEN -180 AND 180))",
            name="ck_solicitudes_coordenadas",
        ),
        CheckConstraint(
            "(tarifa_base_aplicada IS NULL OR tarifa_base_aplicada >= 0)"
            " AND (tarifa_km_aplicada IS NULL OR tarifa_km_aplicada >= 0)"
            " AND (tarifa_hora_aplicada IS NULL OR tarifa_hora_aplicada >= 0)"
            " AND (costo_chofer IS NULL OR costo_chofer >= 0)",
            name="ck_solicitudes_tarifas",
        ),
        CheckConstraint("horas_estimadas IS NULL OR horas_estimadas > 0", name="ck_solicitudes_horas"),
        CheckConstraint(
            "(precio_calculado IS NULL OR precio_calculado >= 0) AND precio_final >= 0",
            name="ck_solicitudes_precios",
        ),
        CheckConstraint("cliente_rol = 'cliente'", name="ck_solicitudes_cliente_rol"),
        CheckConstraint("chofer_rol = 'chofer'", name="ck_solicitudes_chofer_rol"),
        CheckConstraint(
            "precio_modificado_por IS NULL OR precio_modificado_en IS NOT NULL",
            name="ck_solicitudes_ajuste_auditado",
        ),
        CheckConstraint(
            "estado NOT IN ('confirmada', 'finalizada') OR (chofer_id IS NOT NULL AND vehiculo_id IS NOT NULL)",
            name="ck_solicitudes_con_chofer_y_vehiculo",
        ),
        CheckConstraint(
            "(estado = 'finalizada') = (finalizada_en IS NOT NULL)",
            name="ck_solicitudes_finalizada_en",
        ),
        CheckConstraint("remito_nombre IS NULL OR remito_ruta IS NOT NULL", name="ck_solicitudes_remito"),
        ForeignKeyConstraint(
            ["cliente_id", "cliente_rol"],
            ["usuarios.id", "usuarios.rol"],
            onupdate="RESTRICT",
            ondelete="RESTRICT",
            name="fk_solicitudes_cliente",
        ),
        ForeignKeyConstraint(
            ["chofer_id", "chofer_rol"],
            ["usuarios.id", "usuarios.rol"],
            onupdate="RESTRICT",
            ondelete="RESTRICT",
            name="fk_solicitudes_chofer",
        ),
        ForeignKeyConstraint(
            ["vehiculo_id"],
            ["vehiculos.id"],
            onupdate="CASCADE",
            ondelete="RESTRICT",
            name="fk_solicitudes_vehiculo",
        ),
        ForeignKeyConstraint(
            ["precio_modificado_por"],
            ["usuarios.id"],
            onupdate="CASCADE",
            ondelete="RESTRICT",
            name="fk_solicitudes_precio_modificado_por",
        ),
        ForeignKeyConstraint(
            ["remito_subido_por_id"],
            ["usuarios.id"],
            onupdate="CASCADE",
            ondelete="RESTRICT",
            name="fk_solicitudes_remito_subido_por",
        ),
    )


class ItemCarga(Base):
    __tablename__ = "items_carga"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    solicitud_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fragil: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    nota: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    posicion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    solicitud: Mapped["Solicitud"] = relationship(back_populates="items_carga")

    __table_args__ = (
        CheckConstraint("length(btrim(descripcion)) > 0", name="ck_items_carga_descripcion"),
        CheckConstraint("cantidad > 0", name="ck_items_carga_cantidad"),
        ForeignKeyConstraint(
            ["solicitud_id"],
            ["solicitudes.id"],
            onupdate="CASCADE",
            ondelete="CASCADE",
            name="fk_items_carga_solicitud",
        ),
    )


class Pago(Base):
    __tablename__ = "pagos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    solicitud_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    concepto: Mapped[str] = mapped_column(Text, nullable=False)
    metodo: Mapped[str] = mapped_column(Text, nullable=False)
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    recibido_por_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    comprobante_ruta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comprobante_nombre: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    solicitud: Mapped["Solicitud"] = relationship(back_populates="pagos")
    recibido_por: Mapped["Usuario"] = relationship(back_populates="pagos_recibidos")

    __table_args__ = (
        CheckConstraint(_in_list("concepto", PAGO_CONCEPTOS), name="ck_pagos_concepto"),
        CheckConstraint(_in_list("metodo", PAGO_METODOS), name="ck_pagos_metodo"),
        CheckConstraint("monto > 0", name="ck_pagos_monto"),
        CheckConstraint(
            "comprobante_nombre IS NULL OR comprobante_ruta IS NOT NULL",
            name="ck_pagos_comprobante",
        ),
        ForeignKeyConstraint(
            ["solicitud_id"],
            ["solicitudes.id"],
            onupdate="CASCADE",
            ondelete="CASCADE",
            name="fk_pagos_solicitud",
        ),
        ForeignKeyConstraint(
            ["recibido_por_id"],
            ["usuarios.id"],
            onupdate="CASCADE",
            ondelete="RESTRICT",
            name="fk_pagos_recibido_por",
        ),
    )
