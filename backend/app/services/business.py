"""Reglas de negocio del dominio."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import ConfiguracionSistema, Solicitud, Usuario, Vehiculo
from app.services import disponibilidad, pricing
from app.services.scraping import get_geo_service
from app.services.scraping.schemas import GeoStatus


def hora_llegada_estimada(inicio: time, carga_min: int, viaje_min: int) -> time:
    """Calcula la llegada al destino: inicio en origen + carga + ETA de ruta."""
    minutos = inicio.hour * 60 + inicio.minute + carga_min + viaje_min
    if carga_min < 0 or viaje_min < 0 or minutos >= 24 * 60:
        raise ValueError("La llegada estimada debe quedar dentro del mismo día.")
    return time(minutos // 60, minutos % 60)


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


def sena_recibida(solicitud: Solicitud) -> Decimal:
    """Total cobrado como seña en el viaje."""
    return sum(
        (
            Decimal(str(p.monto))
            for p in (getattr(solicitud, "pagos", None) or [])
            if getattr(p, "concepto", None) == "sena"
        ),
        Decimal("0"),
    )


def sena_completa(
    solicitud: Solicitud, *, precio_final: Decimal | float | None = None
) -> bool:
    """La seña está completa cuando lo cobrado cubre el 50 % del precio final."""
    precio = solicitud.precio_final if precio_final is None else precio_final
    requerida = pricing.sena(Decimal(str(precio or 0)))
    return requerida > 0 and sena_recibida(solicitud) >= requerida


def planificacion_completa(solicitud: Solicitud) -> bool:
    """Indica si los datos requeridos fueron definidos explícitamente."""
    desde = getattr(solicitud, "hora_desde", None)
    hasta = getattr(solicitud, "hora_hasta", None)
    return (
        bool(getattr(solicitud, "chofer_id", None))
        and bool(getattr(solicitud, "vehiculo_id", None))
        and getattr(solicitud, "carga_min", None) is not None
        and bool(getattr(solicitud, "carga_min_confirmado", False))
        and getattr(solicitud, "descarga_min", None) is not None
        and bool(getattr(solicitud, "descarga_min_confirmado", False))
        and desde is not None
        and hasta is not None
        and bool(getattr(solicitud, "hora_hasta_confirmado", False))
        and desde < hasta
    )


def derive_estado(solicitud: Solicitud) -> str:
    """Estado visible del viaje.

    El estado almacenado sigue siendo el que decide la base. Lo único que se
    deriva es "pendiente de seña": un viaje con chofer y rodado asignados al
    que todavía le falta la seña. Sin la asignación completa la seña no es el
    próximo paso, así que el viaje sigue siendo "pendiente".
    """
    if solicitud.estado != "pendiente":
        return solicitud.estado
    if not planificacion_completa(solicitud):
        return "pendiente"
    if not sena_completa(solicitud):
        return "pendiente_sena"
    # Seña completa pero el viaje sigue pendiente: la confirmación automática
    # no pudo aplicarse (por ejemplo, por un conflicto de agenda).
    return "pendiente"


def pending_confirmation(solicitud: Solicitud) -> bool:
    """El viaje tiene todo para confirmarse salvo que algo lo bloquee."""
    return (
        solicitud.estado == "pendiente"
        and planificacion_completa(solicitud)
        and sena_completa(solicitud)
    )


def _coordenadas(solicitud: Solicitud, prefijo: str) -> tuple[float, float] | None:
    lat = getattr(solicitud, f"{prefijo}_lat", None)
    lng = getattr(solicitud, f"{prefijo}_lng", None)
    return (float(lat), float(lng)) if lat is not None and lng is not None else None


def _reserva(
    solicitud: Solicitud,
    *,
    chofer_id: int | None,
    vehiculo_id: int | None,
    fecha: date,
    desde: time,
    hasta: time,
    descarga_min: int,
) -> disponibilidad.Reserva:
    return disponibilidad.Reserva(
        id=solicitud.id,
        referencia=solicitud.codigo,
        estado=solicitud.estado,
        franja=disponibilidad.Franja(
            fecha,
            desde,
            hasta,
        ),
        chofer_id=chofer_id,
        vehiculo_id=vehiculo_id,
        descarga_min=descarga_min,
        origen=_coordenadas(solicitud, "origen"),
        destino=_coordenadas(solicitud, "destino"),
    )


def evaluar_agenda(
    db: Session,
    solicitud: Solicitud,
    *,
    chofer_id: int | None,
    vehiculo_id: int | None,
    fecha: date,
    desde: time,
    hasta: time,
    descarga_min: int,
) -> disponibilidad.Evaluacion:
    """Evalúa solapamientos, descarga y traslado contra reservas firmes/blandas."""
    candidate = _reserva(
        solicitud,
        chofer_id=chofer_id,
        vehiculo_id=vehiculo_id,
        fecha=fecha,
        desde=desde,
        hasta=hasta,
        descarga_min=descarga_min,
    )
    condiciones = []
    if candidate.chofer_id is not None:
        condiciones.append(Solicitud.chofer_id == candidate.chofer_id)
    if candidate.vehiculo_id is not None:
        condiciones.append(Solicitud.vehiculo_id == candidate.vehiculo_id)

    reservas: list[disponibilidad.Reserva] = []
    if condiciones:
        rows = db.scalars(
            select(Solicitud).where(
                Solicitud.id != solicitud.id,
                Solicitud.estado.in_(disponibilidad.ESTADOS_RESERVA),
                Solicitud.fecha.between(
                    candidate.franja.fecha - timedelta(days=1),
                    candidate.franja.fecha + timedelta(days=1),
                ),
                or_(*condiciones),
            )
        ).all()
        reservas = [
            _reserva(
                row,
                chofer_id=row.chofer_id,
                vehiculo_id=row.vehiculo_id,
                fecha=row.fecha,
                desde=row.hora_desde,
                hasta=row.hora_hasta,
                descarga_min=row.descarga_min,
            )
            for row in rows
            if row.hora_hasta is not None
            and row.descarga_min is not None
            and (
                row.estado == "confirmada"
                or planificacion_completa(row)
            )
        ]

    config = db.get(ConfiguracionSistema, 1)
    margen_min = config.margen_operativo_min if config is not None else 30
    pares = disponibilidad.pares_traslado_requeridos(
        candidate,
        reservas,
        margen_min=margen_min,
    )
    pares_con_coordenadas = [
        par for par in pares if par[0].destino is not None and par[1].origen is not None
    ]
    rutas: dict[tuple[disponibilidad.Reserva, disponibilidad.Reserva], int | None] = {}
    if pares_con_coordenadas:
        servicio_geo = get_geo_service()
        with ThreadPoolExecutor(max_workers=min(4, len(pares_con_coordenadas))) as executor:
            resultados = executor.map(
                lambda par: servicio_geo.route(par[0].destino, par[1].origen),
                pares_con_coordenadas,
            )
            for par, route in zip(pares_con_coordenadas, resultados):
                rutas[par] = (
                    route.value.duration_min
                    if route.status == GeoStatus.OK and route.value is not None
                    else None
                )

    def medir_traslado(
        origen: disponibilidad.Reserva, destino: disponibilidad.Reserva
    ) -> int | None:
        return rutas.get((origen, destino))

    return disponibilidad.evaluar_disponibilidad(
        candidate,
        reservas,
        travel_minutes=medir_traslado,
        margen_min=margen_min,
    )


def availability_warnings(evaluation: disponibilidad.Evaluacion) -> list[str]:
    warnings = [
        f"El horario coincide con la solicitud {conflict.referencia} aún pendiente."
        for conflict in evaluation.advertencias
        if conflict.tipo == "reserva"
    ]
    if evaluation.requiere_advertencia_traslado:
        warnings.append(
            "No se pudo verificar el tiempo de traslado; la confirmación no lo considera como cero."
        )
    return list(dict.fromkeys(warnings))


def lock_agenda_resources(
    db: Session,
    chofer_id: int | None,
    vehiculo_id: int | None,
    *,
    previous_chofer_id: int | None = None,
    previous_vehiculo_id: int | None = None,
) -> None:
    """Serializa confirmaciones que comparten chofer o vehículo."""
    choferes = sorted({id_ for id_ in (chofer_id, previous_chofer_id) if id_ is not None})
    vehiculos = sorted({id_ for id_ in (vehiculo_id, previous_vehiculo_id) if id_ is not None})
    if choferes:
        db.execute(
            select(Usuario.id)
            .where(Usuario.id.in_(choferes))
            .order_by(Usuario.id)
            .with_for_update()
        ).all()
    if vehiculos:
        db.execute(
            select(Vehiculo.id)
            .where(Vehiculo.id.in_(vehiculos))
            .order_by(Vehiculo.id)
            .with_for_update()
        ).all()


def blocking_reason(
    db: Session, solicitud: Solicitud
) -> str | None:
    """Motivo por el que un viaje listo no puede confirmarse, o None si puede.

    Solo tiene sentido para viajes que cumplen `pending_confirmation`; el resto
    devuelve None porque todavía les falta algo, no porque estén bloqueados.
    """
    if not pending_confirmation(solicitud):
        return None

    error_chofer = driver_confirmation_error(db, solicitud.chofer_id)
    if error_chofer:
        return error_chofer

    vehiculo = db.get(Vehiculo, solicitud.vehiculo_id)
    if vehiculo is None:
        return "No se pudo confirmar automáticamente: el vehículo asignado ya no existe."
    if not vehicle_is_assignable(db, vehiculo):
        return "No se pudo confirmar automáticamente: el vehículo asignado no está operativo."

    evaluation = evaluar_agenda(
        db,
        solicitud,
        chofer_id=solicitud.chofer_id,
        vehiculo_id=solicitud.vehiculo_id,
        fecha=solicitud.fecha,
        desde=solicitud.hora_desde,
        hasta=solicitud.hora_hasta,
        descarga_min=solicitud.descarga_min,
    )
    if evaluation.bloquea:
        return format_blocking_conflict(evaluation.bloqueos[0])

    return None


def driver_confirmation_error(db: Session, driver_id: int | None) -> str | None:
    if driver_id is None:
        return "Asigná un chofer antes de confirmar el viaje."
    driver = db.execute(
        select(Usuario.rol, Usuario.activo)
        .where(Usuario.id == driver_id)
        .with_for_update()
    ).one_or_none()
    if driver is None or driver.rol != "chofer":
        return "El chofer asignado no existe."
    if not driver.activo:
        return "No se puede confirmar: el chofer asignado está inactivo."
    return None


def format_blocking_conflict(conflict: disponibilidad.Conflicto) -> str:
    resource = "chofer" if conflict.recurso == "chofer" else "vehículo"
    cause = "el horario se solapa o no deja margen suficiente"
    if conflict.tipo == "traslado":
        cause = f"faltan {conflict.minutos_faltantes} minutos para el traslado y margen"
    return (
        f"No se puede confirmar el viaje: {resource} {cause} "
        f"con el viaje {conflict.referencia}."
    )


def confirm_if_ready(db: Session, solicitud: Solicitud) -> str | None:
    """Confirma el viaje cuando la planificación y la seña están completas.

    Devuelve None cuando confirma o cuando todavía no corresponde, y el motivo
    cuando la confirmación automática no puede aplicarse. Nunca lanza por un
    conflicto: la operación que la dispara (registrar el pago, guardar el plan)
    ya está hecha y tiene que sobrevivir al bloqueo.
    """
    if not pending_confirmation(solicitud):
        return None

    lock_agenda_resources(db, solicitud.chofer_id, solicitud.vehiculo_id)
    motivo = blocking_reason(db, solicitud)
    if motivo is not None:
        return motivo
    solicitud.estado = "confirmada"
    return None
