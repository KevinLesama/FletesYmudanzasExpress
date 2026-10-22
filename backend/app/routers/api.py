"""Routers: health, auth, users, vehicles, requests, payments."""

from __future__ import annotations

from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models import Payment, Request, RequestCargoItem, User, UserFactor, Vehicle
from app.schemas import (
    AvailabilityOut,
    PaymentIn,
    PaymentOut,
    PaymentSummaryRow,
    RemitoIn,
    RequestIn,
    RequestOut,
    RequestUpdate,
    SessionOut,
    UserIn,
    UserOut,
    UserRatesIn,
    UserUpdate,
    VehicleIn,
    VehicleOut,
)
from app.services import business, serializers

# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #
health_router = APIRouter()


@health_router.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# --------------------------------------------------------------------------- #
# Sesion
# --------------------------------------------------------------------------- #
auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.get("/me", response_model=SessionOut)
def whoami(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionOut:
    """Usuario de la app detrás del token: el frontend lo usa para saber qué
    mostrar (portal de chofer vs. pantallas de administración)."""
    user = db.get(User, current["user_id"])
    if user is None:  # pragma: no cover - el token ya se resolvio contra la DB
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return SessionOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,  # type: ignore[arg-type]
        initials=user.initials,
        status=user.status,
    )


# --------------------------------------------------------------------------- #
# Permisos
# --------------------------------------------------------------------------- #
def _is_admin(current: CurrentUser) -> bool:
    return current["role"] == "admin"


def _ensure_self_or_admin(current: CurrentUser, user_id: str) -> None:
    """El admin opera sobre cualquiera; el resto solo sobre su propio usuario."""
    if not _is_admin(current) and current["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="No tenes permisos para esta accion.")


def _ensure_request_access(current: CurrentUser, request: Request) -> None:
    """El admin ve todos los viajes; el chofer solo los que tiene asignados."""
    if _is_admin(current):
        return
    if request.driver_id and request.driver_id == current["user_id"]:
        return
    raise HTTPException(status_code=403, detail="No tenes permisos para este viaje.")


# --------------------------------------------------------------------------- #
# Usuarios (administradores, choferes y clientes)
# --------------------------------------------------------------------------- #
users_router = APIRouter(prefix="/users", tags=["users"])


def _initials_from_name(name: str) -> str:
    parts = [p for p in name.split() if p]
    return ("".join(p[0] for p in parts)[:2] or "XX").upper()


def _generate_code(db: Session, base: str, width: int = 0) -> str:
    """Genera un identificador libre.

    Con ``width`` se numeran con guion y ceros a la izquierda (ADM-01, ADM-02);
    sin ``width`` se agrega un sufijo numérico al prefijo (JA, JA2).
    """
    if width:
        counter = 1
        candidate = f"{base}-{counter:0{width}d}"
        while db.get(User, candidate) is not None:
            counter += 1
            candidate = f"{base}-{counter:0{width}d}"
        return candidate
    candidate = base
    counter = 2
    while db.get(User, candidate) is not None:
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


def _new_user_id(db: Session, role: str, initials: str) -> str:
    if role == "cliente":
        return business.next_client_id(db)
    if role == "admin":
        return _generate_code(db, "ADM", width=2)
    return _generate_code(db, initials)


@users_router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    role: str | None = Query(default=None),
    current: CurrentUser = Depends(require_role("admin")),
) -> list[UserOut]:
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    users = db.scalars(stmt.order_by(User.name)).all()
    return [serializers.serialize_user(u) for u in users]


@users_router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin")),
) -> UserOut:
    # Un cliente repetido (mismo nombre y teléfono) no se duplica: se devuelve
    # el existente para que la pantalla de "nueva solicitud" pueda elegirlo.
    if payload.role == "cliente":
        existing = db.scalar(
            select(User).where(
                User.role == "cliente",
                User.name == payload.name,
                User.phone == payload.phone,
            )
        )
        if existing:
            return serializers.serialize_user(existing)

    initials = (payload.initials or _initials_from_name(payload.name)).upper()[:4]
    user_id = payload.id or _new_user_id(db, payload.role, initials)
    if db.get(User, user_id) is not None:
        raise HTTPException(status_code=409, detail=f"Ya existe un usuario con id {user_id}.")

    user = User(
        id=user_id,
        role=payload.role,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        initials=initials if payload.role in ("chofer", "admin") else None,
        status=payload.status,
        base_rate=payload.base_rate,
        rate_per_km=payload.rate_per_km,
        rate_per_hour=payload.rate_per_hour,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Ya existe un usuario con ese teléfono o correo."
        ) from exc
    db.refresh(user)
    return serializers.serialize_user(user)


@users_router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> UserOut:
    _ensure_self_or_admin(current, user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return serializers.serialize_user(user)


@users_router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> UserOut:
    _ensure_self_or_admin(current, user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    data = payload.model_dump(exclude_unset=True)
    if not _is_admin(current):
        # Un chofer no se da de baja ni cambia su estado; solo sus datos.
        data.pop("status", None)
    for field in ("name", "phone", "email", "initials", "status"):
        if field in data and data[field] is not None:
            setattr(user, field, data[field])
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Ya existe un usuario con ese teléfono o correo."
        ) from exc
    db.refresh(user)
    return serializers.serialize_user(user)


@users_router.put("/{user_id}/rates", response_model=UserOut)
def update_user_rates(
    user_id: str,
    payload: UserRatesIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> UserOut:
    """Tarifas y factores (pantalla 'Mi configuración' del chofer)."""
    _ensure_self_or_admin(current, user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user.base_rate = payload.base_rate
    user.rate_per_km = payload.rate_per_km
    user.rate_per_hour = payload.rate_per_hour
    user.factors = [
        UserFactor(label=f.label, amount=f.amount, position=i)
        for i, f in enumerate(payload.factors)
    ]
    db.commit()
    db.refresh(user)
    return serializers.serialize_user(user)


# --------------------------------------------------------------------------- #
# Vehiculos
# --------------------------------------------------------------------------- #
vehicles_router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@vehicles_router.get("", response_model=list[VehicleOut])
def list_vehicles(
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> list[VehicleOut]:
    vehicles = db.scalars(select(Vehicle).order_by(Vehicle.id)).all()
    return [serializers.serialize_vehicle(v) for v in vehicles]


@vehicles_router.post("", response_model=VehicleOut, status_code=201)
def create_vehicle(
    payload: VehicleIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin")),
) -> VehicleOut:
    if db.get(Vehicle, payload.id) is not None:
        raise HTTPException(status_code=409, detail=f"Ya existe un vehículo {payload.id}.")
    vehicle = Vehicle(
        id=payload.id,
        type=payload.type,
        capacity_kg=payload.capacity_kg,
        status=payload.status,
        assigned_note=payload.assigned_note,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return serializers.serialize_vehicle(vehicle)


@vehicles_router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> VehicleOut:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return serializers.serialize_vehicle(vehicle)


@vehicles_router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: str,
    payload: VehicleIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin")),
) -> VehicleOut:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    vehicle.type = payload.type
    vehicle.capacity_kg = payload.capacity_kg
    vehicle.status = payload.status
    vehicle.assigned_note = payload.assigned_note
    db.commit()
    db.refresh(vehicle)
    return serializers.serialize_vehicle(vehicle)


# --------------------------------------------------------------------------- #
# Solicitudes / viajes
# --------------------------------------------------------------------------- #
requests_router = APIRouter(prefix="/requests", tags=["requests"])


def _get_request_or_404(db: Session, request_id: str) -> Request:
    request = db.get(Request, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    return request


@requests_router.get("", response_model=list[RequestOut])
def list_requests(
    db: Session = Depends(get_db),
    status: str | None = Query(default=None),
    day: date | None = Query(default=None, alias="date"),
    driver_id: str | None = Query(default=None),
    vehicle_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current: CurrentUser = Depends(require_role("admin", "chofer")),
) -> list[RequestOut]:
    stmt = select(Request)
    if status:
        stmt = stmt.where(Request.status == status)
    if day:
        stmt = stmt.where(Request.date == day)
    if vehicle_id:
        stmt = stmt.where(Request.vehicle_id == vehicle_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(Request.client_name.ilike(like) | Request.id.ilike(like))
    if not _is_admin(current):
        # El chofer solo ve los viajes que tiene asignados.
        stmt = stmt.where(Request.driver_id == current["user_id"])
    elif driver_id:
        stmt = stmt.where(Request.driver_id == driver_id)
    stmt = stmt.order_by(Request.date.desc(), Request.id.desc())
    return [serializers.serialize_request(r) for r in db.scalars(stmt).all()]


@requests_router.post("", response_model=RequestOut, status_code=201)
def create_request(
    payload: RequestIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin")),
) -> RequestOut:
    if not payload.client_id and not (payload.client_name and payload.phone):
        raise HTTPException(
            status_code=422,
            detail="Debés indicar un cliente existente (client_id) o nombre y teléfono nuevos.",
        )

    if payload.client_id:
        client = db.get(User, payload.client_id)
        if client is None or client.role != "cliente":
            raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    else:
        client = db.scalar(
            select(User).where(
                User.role == "cliente",
                User.name == payload.client_name,
                User.phone == payload.phone,
            )
        )
        if client is None:
            client = User(
                id=business.next_client_id(db),
                role="cliente",
                name=payload.client_name or "",
                phone=payload.phone or "",
            )
            db.add(client)
            db.flush()

    request = Request(
        id=business.next_request_id(db),
        client_id=client.id,
        client_name=client.name,
        phone=client.phone,
        status="Pendiente de revisión",
        date=payload.date,
        arrival_from=payload.arrival_from,
        arrival_to=payload.arrival_to,
        service_from=payload.service_from,
        service_to=payload.service_to,
        origin_address=payload.origin.address,
        origin_barrio=payload.origin.barrio,
        origin_floor=payload.origin.floor,
        origin_elevator=payload.origin.elevator,
        destination_address=payload.destination.address,
        destination_barrio=payload.destination.barrio,
        destination_floor=payload.destination.floor,
        destination_elevator=payload.destination.elevator,
        cargo_approx_units=payload.cargo.approx_units,
        cargo_fragile=payload.cargo.fragile,
        cargo_notes=payload.cargo.notes,
        price=payload.price,
        deposit_required=payload.deposit_required,
        estimated_km=payload.estimated_km,
        estimated_hours=payload.estimated_hours,
    )
    request.cargo_items = [
        RequestCargoItem(name=i.name, units=i.units, note=i.note, position=pos)
        for pos, i in enumerate(payload.cargo.items)
    ]
    db.add(request)
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


@requests_router.get("/{request_id}", response_model=RequestOut)
def get_request(
    request_id: str,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin", "chofer")),
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    _ensure_request_access(current, request)
    return serializers.serialize_request(request)


@requests_router.patch("/{request_id}", response_model=RequestOut)
def update_request(
    request_id: str,
    payload: RequestUpdate,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin")),
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    data = payload.model_dump(exclude_unset=True)

    new_status = data.get("status")
    new_driver = data.get("driver_id", request.driver_id)
    new_vehicle = data.get("vehicle_id", request.vehicle_id)
    new_start = data.get("service_from", request.service_from)
    new_end = data.get("service_to", request.service_to)
    new_day = data.get("date", request.date)

    if new_status == "Confirmada":
        if not new_driver or not new_vehicle:
            raise HTTPException(
                status_code=409, detail="Para confirmar el viaje se requiere chofer y vehículo."
            )
        if business.driver_conflicts(
            db, new_driver, new_day, new_start, new_end, exclude_id=request.id
        ):
            raise HTTPException(
                status_code=409, detail="El chofer ya tiene un viaje confirmado en ese horario."
            )
        vehicle = db.get(Vehicle, new_vehicle)
        if vehicle is None:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
        if not business.vehicle_is_assignable(db, vehicle):
            raise HTTPException(
                status_code=409, detail="El vehículo no está disponible (en taller)."
            )
        if business.vehicle_conflicts(
            db, new_vehicle, new_day, new_start, new_end, exclude_id=request.id
        ):
            raise HTTPException(
                status_code=409, detail="El vehículo ya tiene un viaje confirmado en ese horario."
            )
        received = serializers.deposit_received(request)
        required = float(data.get("deposit_required", request.deposit_required))
        if received < required:
            raise HTTPException(
                status_code=409,
                detail="La seña registrada es insuficiente para confirmar el viaje.",
            )

    for field in (
        "driver_id",
        "vehicle_id",
        "date",
        "service_from",
        "service_to",
        "price",
        "deposit_required",
        "estimated_km",
        "estimated_hours",
        "status",
        "cargo_notes",
        "cargo_fragile",
        "cargo_approx_units",
    ):
        if field in data:
            setattr(request, field, data[field])

    try:
        db.flush()
    except IntegrityError as exc:  # pragma: no cover - salvaguarda
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicto de integridad.") from exc

    for vid in {request.vehicle_id}:
        if vid:
            vehicle = db.get(Vehicle, vid)
            if vehicle:
                business.refresh_vehicle_status(db, vehicle)

    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


@requests_router.get("/{request_id}/payments", response_model=list[PaymentOut])
def list_payments(
    request_id: str,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin", "chofer")),
) -> list[PaymentOut]:
    request = _get_request_or_404(db, request_id)
    _ensure_request_access(current, request)
    return serializers.serialize_request(request).payments


@requests_router.post("/{request_id}/payments", response_model=RequestOut, status_code=201)
def add_payment(
    request_id: str,
    payload: PaymentIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin", "chofer")),
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    _ensure_request_access(current, request)
    payment = Payment(
        request_id=request.id,
        concept=payload.concept,
        method=payload.method,
        received_by=payload.received_by,
        amount=payload.amount,
        date=payload.date,
        notes=payload.notes,
        remito_name=payload.remito_name,
        remito_data_url=payload.remito_data_url,
    )
    db.add(payment)
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


# --------------------------------------------------------------------------- #
# Pagos (resumen por viaje y remitos)
# --------------------------------------------------------------------------- #
payments_router = APIRouter(prefix="/payments", tags=["payments"])


@payments_router.get("/summary", response_model=list[PaymentSummaryRow])
def payments_summary(
    db: Session = Depends(get_db),
    day: date | None = Query(default=None, alias="date"),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current: CurrentUser = Depends(require_role("admin")),
) -> list[PaymentSummaryRow]:
    stmt = select(Request).order_by(Request.date.desc(), Request.id.desc())
    if day:
        stmt = stmt.where(Request.date == day)
    rows: list[PaymentSummaryRow] = []
    for request in db.scalars(stmt).all():
        price = float(request.price)
        deposit = serializers.deposit_received(request)
        collected = float(sum(p.amount for p in request.payments))
        balance = max(price - collected, 0)
        state = "Cobrado" if balance == 0 and price > 0 else ("Sin pagos" if collected == 0 else "Parcial")
        if status and state != status:
            continue
        if search:
            q = search.strip().lower()
            if q and q not in request.client_name.lower() and q not in request.id.lower():
                continue
        rows.append(
            PaymentSummaryRow(
                request_id=request.id,
                client_name=request.client_name,
                date=request.date,
                price=price,
                deposit=deposit,
                collected=collected,
                balance=balance,
                state=state,  # type: ignore[arg-type]
            )
        )
    return rows


@payments_router.put("/{payment_id}/remito", response_model=PaymentOut)
def set_payment_remito(
    payment_id: int,
    payload: RemitoIn,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin", "chofer")),
) -> PaymentOut:
    """Foto del remito: el chofer la sube cuando cobra en efectivo."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado.")
    _ensure_request_access(current, payment.request)
    payment.remito_name = payload.name
    payment.remito_data_url = payload.data_url
    db.commit()
    db.refresh(payment)
    return PaymentOut.model_validate(payment)


@payments_router.delete("/{payment_id}/remito", response_model=PaymentOut)
def delete_payment_remito(
    payment_id: int,
    db: Session = Depends(get_db),
    current: CurrentUser = Depends(require_role("admin", "chofer")),
) -> PaymentOut:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado.")
    _ensure_request_access(current, payment.request)
    payment.remito_name = None
    payment.remito_data_url = None
    db.commit()
    db.refresh(payment)
    return PaymentOut.model_validate(payment)


# --------------------------------------------------------------------------- #
# Disponibilidad
# --------------------------------------------------------------------------- #
availability_router = APIRouter(tags=["availability"])


@availability_router.get("/availability", response_model=AvailabilityOut)
def availability(
    db: Session = Depends(get_db),
    day: date = Query(alias="date"),
    driver_id: str | None = Query(default=None),
    vehicle_id: str | None = Query(default=None),
    start: time = Query(...),
    end: time = Query(...),
    exclude: str | None = Query(default=None),
    current: CurrentUser = Depends(require_role("admin")),
) -> AvailabilityOut:
    conflicts: list[str] = []
    driver_ok = True
    vehicle_ok = True

    if driver_id:
        drive_conf = business.driver_conflicts(db, driver_id, day, start, end, exclude_id=exclude)
        if drive_conf:
            driver_ok = False
            conflicts.extend(f"Chofer ocupado en {r.id}" for r in drive_conf)

    if vehicle_id:
        vehicle = db.get(Vehicle, vehicle_id)
        if vehicle and not business.vehicle_is_assignable(db, vehicle):
            vehicle_ok = False
            conflicts.append(f"{vehicle_id} en taller")
        else:
            veh_conf = business.vehicle_conflicts(db, vehicle_id, day, start, end, exclude_id=exclude)
            if veh_conf:
                vehicle_ok = False
                conflicts.extend(f"Vehículo ocupado en {r.id}" for r in veh_conf)

    return AvailabilityOut(
        driver_available=driver_ok, vehicle_available=vehicle_ok, conflicts=conflicts
    )
