"""Reglas de negocio del dominio."""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Solicitud, Usuario, Vehiculo
from app.services import pricing


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


class PaymentAmountError(ValueError):
    """El importe del pago no respeta el tope del concepto."""


def validate_payment_amount(solicitud: Solicitud, concepto: str, monto: float | Decimal) -> None:
    """Valida que el pago no supere lo que falta cobrar del viaje.

    La seña se mide contra la seña requerida (50 % del precio acordado); el
    saldo, contra el total del viaje menos todo lo ya cobrado. Sin este limite
    se puede cobrar la seña dos veces o mas que el precio acordado.
    """
    pagos = list(getattr(solicitud, "pagos", None) or [])
    precio_acordado = Decimal(str(solicitud.precio_final or 0))
    importe = Decimal(str(monto))

    if concepto == "sena":
        sena_requerida = pricing.sena(precio_acordado)
        if sena_requerida <= 0:
            raise PaymentAmountError("El viaje todavía no tiene un precio acordado.")
        sena_recibida = sum(
            (Decimal(str(p.monto)) for p in pagos if p.concepto == "sena"),
            Decimal("0"),
        )
        faltante = max(sena_requerida - sena_recibida, Decimal("0"))
        if importe > faltante:
            raise PaymentAmountError(
                f"El importe supera lo que falta de la seña ({faltante})."
            )
        return

    total_recibido = sum((Decimal(str(p.monto)) for p in pagos), Decimal("0"))
    faltante = max(precio_acordado - total_recibido, Decimal("0"))
    if importe > faltante:
        raise PaymentAmountError(
            f"El importe supera el saldo pendiente ({faltante})."
        )
