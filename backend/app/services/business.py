"""Reglas de negocio del dominio (extraidas de la logica del frontend).

- Generacion de identificadores FEX-#### y de ids de usuario (CLI-###).
- Deteccion de conflictos de chofer/vehiculo (solo viajes Confirmada cuentan,
  igual que la funcion hasConflict del mock original).
- Sugerencia de reserva de vehiculo ("Asignado") y liberacion al cancelar.
"""

from __future__ import annotations

import re
from datetime import date, time

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Request, User, Vehicle

FEX_PATTERN = re.compile(r"^FEX-(\d+)$", re.IGNORECASE)
CLI_PATTERN = re.compile(r"^CLI-(\d+)$", re.IGNORECASE)


def next_request_id(db: Session) -> str:
    """Devuelve el proximo FEX-#### correlativo."""
    ids = db.scalars(select(Request.id)).all()
    max_num = 0
    for rid in ids:
        match = FEX_PATTERN.match(rid or "")
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"FEX-{max_num + 1:04d}"


def next_client_id(db: Session) -> str:
    """Devuelve el proximo id de cliente (CLI-###)."""
    ids = db.scalars(select(User.id).where(User.role == "cliente")).all()
    max_num = 0
    for uid in ids:
        match = CLI_PATTERN.match(uid or "")
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"CLI-{max_num + 1:03d}"


def _overlaps(
    a_from: time, a_to: time, b_from: time, b_to: time
) -> bool:
    return a_from < b_to and b_from < a_to


def driver_conflicts(
    db: Session,
    driver_id: str,
    day: date,
    start: time,
    end: time,
    exclude_id: str | None = None,
) -> list[Request]:
    """Viajes Confirmada del mismo chofer ese dia que se solapan con el rango."""
    stmt = select(Request).where(
        Request.driver_id == driver_id,
        Request.date == day,
        Request.status == "Confirmada",
    )
    if exclude_id:
        stmt = stmt.where(Request.id != exclude_id)
    return [
        r
        for r in db.scalars(stmt).all()
        if _overlaps(start, end, r.service_from, r.service_to)
    ]


def vehicle_conflicts(
    db: Session,
    vehicle_id: str,
    day: date,
    start: time,
    end: time,
    exclude_id: str | None = None,
) -> list[Request]:
    stmt = select(Request).where(
        Request.vehicle_id == vehicle_id,
        Request.date == day,
        Request.status == "Confirmada",
    )
    if exclude_id:
        stmt = stmt.where(Request.id != exclude_id)
    return [
        r
        for r in db.scalars(stmt).all()
        if _overlaps(start, end, r.service_from, r.service_to)
    ]


def vehicle_is_assignable(db: Session, vehicle: Vehicle) -> bool:
    """Un vehiculo en taller nunca es asignable."""
    return vehicle.status != "En taller"


def refresh_vehicle_status(db: Session, vehicle: Vehicle, exclude_id: str | None = None) -> None:
    """Recalcula el estado del vehiculo segun su uso en viajes Confirmada.

    En taller: se respeta. Si tiene viajes confirmados que lo usa queda
    Asignado; si no, Disponible. La nota de asignacion se arma con el proximo
    viaje confirmado.
    """
    if vehicle.status == "En taller":
        return
    stmt = (
        select(Request)
        .where(
            Request.vehicle_id == vehicle.id,
            Request.status == "Confirmada",
        )
        .order_by(Request.date, Request.service_from)
    )
    if exclude_id:
        stmt = stmt.where(Request.id != exclude_id)
    upcoming = db.scalars(stmt).all()
    if upcoming:
        first = upcoming[0]
        vehicle.status = "Asignado"
        vehicle.assigned_note = f"{first.id} · {first.date.isoformat()}"
    else:
        vehicle.status = "Disponible"
        vehicle.assigned_note = None


def user_exists(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def count_requests_for_driver(db: Session, driver_id: str) -> int:
    return int(
        db.scalar(select(func.count()).select_from(Request).where(Request.driver_id == driver_id))
        or 0
    )
