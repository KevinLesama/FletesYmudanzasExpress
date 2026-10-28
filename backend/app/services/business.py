"""Reglas de negocio del dominio."""

from __future__ import annotations

from datetime import date, time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Solicitud, Usuario, Vehiculo


def _overlaps(a_from: time, a_to: time, b_from: time, b_to: time) -> bool:
    return a_from < b_to and b_from < a_to


def driver_conflicts(
    db: Session,
    driver_id: int,
    day: date,
    start: time,
    end: time,
    exclude_id: int | None = None,
) -> list[Solicitud]:
    """Viajes confirmada del mismo chofer ese dia que se solapan con el rango."""
    stmt = select(Solicitud).where(
        Solicitud.chofer_id == driver_id,
        Solicitud.fecha == day,
        Solicitud.estado == "confirmada",
    )
    if exclude_id:
        stmt = stmt.where(Solicitud.id != exclude_id)
    return [
        r
        for r in db.scalars(stmt).all()
        if _overlaps(start, end, r.hora_desde, r.hora_hasta)
    ]


def vehicle_conflicts(
    db: Session,
    vehicle_id: int,
    day: date,
    start: time,
    end: time,
    exclude_id: int | None = None,
) -> list[Solicitud]:
    stmt = select(Solicitud).where(
        Solicitud.vehiculo_id == vehicle_id,
        Solicitud.fecha == day,
        Solicitud.estado == "confirmada",
    )
    if exclude_id:
        stmt = stmt.where(Solicitud.id != exclude_id)
    return [
        r
        for r in db.scalars(stmt).all()
        if _overlaps(start, end, r.hora_desde, r.hora_hasta)
    ]


def vehicle_is_assignable(db: Session, vehicle: Vehiculo) -> bool:
    """Un vehiculo en taller o fuera de servicio nunca es asignable."""
    return vehicle.estado not in ("en_taller", "fuera_de_servicio")


def refresh_vehicle_status(db: Session, vehicle: Vehiculo, exclude_id: int | None = None) -> None:
    if vehicle.estado == "en_taller":
        return
    stmt = (
        select(Solicitud)
        .where(
            Solicitud.vehiculo_id == vehicle.id,
            Solicitud.estado == "confirmada",
        )
        .order_by(Solicitud.fecha, Solicitud.hora_desde)
    )
    if exclude_id:
        stmt = stmt.where(Solicitud.id != exclude_id)
    upcoming = db.scalars(stmt).all()
    if upcoming:
        vehicle.estado = "disponible"
    else:
        vehicle.estado = "disponible"


def driver_exists(db: Session, driver_id: int) -> Usuario | None:
    return db.get(Usuario, driver_id)


def count_requests_for_driver(db: Session, driver_id: int) -> int:
    return int(
        db.scalar(select(func.count()).select_from(Solicitud).where(Solicitud.chofer_id == driver_id))
        or 0
    )
