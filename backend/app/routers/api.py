"""Routers: health, clients, drivers, vehicles, requests, payments."""

from __future__ import annotations

from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models import Client, DriverFactor, Driver, Payment, Request, Vehicle
from app.models import Incident, RequestCargoItem
from app.schemas import (
    ArrivedIn,
    AvailabilityOut,
    ClientIn,
    ClientOut,
    DriverFactorsIn,
    DriverIn,
    DriverOut,
    FinishedIn,
    IncidentIn,
    IncidentOut,
    MeOut,
    PaymentIn,
    PaymentOut,
    PaymentSummaryRow,
    RemitoIn,
    RequestIn,
    RequestOut,
    RequestUpdate,
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
# Identidad
# --------------------------------------------------------------------------- #
me_router = APIRouter(prefix="/me", tags=["auth"])


@me_router.get("", response_model=MeOut)
def me(user: CurrentUser = Depends(get_current_user)) -> MeOut:
    """Usuario autenticado con su rol resuelto en la base.

    El frontend lo usa para los guards: el JWT ya no lleva el rol.
    """
    return MeOut(
        id=user["id"],
        email=user["email"],
        nombre=user["nombre"],
        rol=user["rol"],
    )


# --------------------------------------------------------------------------- #
# Clientes
# --------------------------------------------------------------------------- #
clients_router = APIRouter(
    prefix="/clients",
    tags=["clients"],
    dependencies=[Depends(get_current_user), Depends(require_role("administrador"))],
)


@clients_router.get("", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db)) -> list[ClientOut]:
    clients = db.scalars(select(Client).order_by(Client.name)).all()
    return [serializers.serialize_client(c) for c in clients]


@clients_router.post("", response_model=ClientOut, status_code=201)
def create_client(payload: ClientIn, db: Session = Depends(get_db)) -> ClientOut:
    existing = db.scalar(
        select(Client).where(Client.name == payload.name, Client.phone == payload.phone)
    )
    if existing:
        return serializers.serialize_client(existing)
    client = Client(name=payload.name, phone=payload.phone)
    db.add(client)
    db.commit()
    db.refresh(client)
    return serializers.serialize_client(client)


# --------------------------------------------------------------------------- #
# Choferes
# --------------------------------------------------------------------------- #
drivers_router = APIRouter(
    prefix="/drivers", tags=["drivers"], dependencies=[Depends(get_current_user)]
)


def _initials_from_name(name: str) -> str:
    parts = [p for p in name.split() if p]
    return ("".join(p[0] for p in parts)[:2] or "XX").upper()


def _generate_driver_id(db: Session, initials: str) -> str:
    candidate = initials
    counter = 2
    while db.get(Driver, candidate) is not None:
        candidate = f"{initials}{counter}"
        counter += 1
    return candidate


@drivers_router.get("", response_model=list[DriverOut])
def list_drivers(db: Session = Depends(get_db)) -> list[DriverOut]:
    drivers = db.scalars(select(Driver).order_by(Driver.name)).all()
    return [serializers.serialize_driver(d) for d in drivers]


@drivers_router.post(
    "",
    response_model=DriverOut,
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def create_driver(payload: DriverIn, db: Session = Depends(get_db)) -> DriverOut:
    initials = (payload.initials or _initials_from_name(payload.name)).upper()[:4]
    driver_id = payload.id or _generate_driver_id(db, initials)
    if db.get(Driver, driver_id) is not None:
        raise HTTPException(status_code=409, detail=f"Ya existe un chofer con id {driver_id}.")
    driver = Driver(
        id=driver_id,
        initials=initials,
        name=payload.name,
        phone=payload.phone,
        status=payload.status,
        base_rate=payload.base_rate,
        rate_per_km=payload.rate_per_km,
        rate_per_hour=payload.rate_per_hour,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return serializers.serialize_driver(driver)


@drivers_router.get("/{driver_id}", response_model=DriverOut)
def get_driver(driver_id: str, db: Session = Depends(get_db)) -> DriverOut:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    return serializers.serialize_driver(driver)


@drivers_router.patch(
    "/{driver_id}",
    response_model=DriverOut,
    dependencies=[Depends(require_role("administrador"))],
)
def update_driver(driver_id: str, payload: DriverIn, db: Session = Depends(get_db)) -> DriverOut:
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    driver.name = payload.name
    driver.phone = payload.phone
    driver.status = payload.status
    if payload.initials:
        driver.initials = payload.initials.upper()[:4]
    db.commit()
    db.refresh(driver)
    return serializers.serialize_driver(driver)


@drivers_router.put(
    "/{driver_id}/rates",
    response_model=DriverOut,
    dependencies=[Depends(require_role("administrador"))],
)
def update_driver_rates(
    driver_id: str, payload: DriverFactorsIn, db: Session = Depends(get_db)
) -> DriverOut:
    """Tarifas y factores (pantalla 'Mi configuracion' del chofer)."""
    driver = db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    driver.base_rate = payload.base_rate
    driver.rate_per_km = payload.rate_per_km
    driver.rate_per_hour = payload.rate_per_hour
    driver.factors = [
        DriverFactor(label=f.label, amount=f.amount, position=i)
        for i, f in enumerate(payload.factors)
    ]
    db.commit()
    db.refresh(driver)
    return serializers.serialize_driver(driver)


# --------------------------------------------------------------------------- #
# Vehiculos
# --------------------------------------------------------------------------- #
vehicles_router = APIRouter(
    prefix="/vehicles", tags=["vehicles"], dependencies=[Depends(get_current_user)]
)


@vehicles_router.get("", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db)) -> list[VehicleOut]:
    vehicles = db.scalars(select(Vehicle).order_by(Vehicle.id)).all()
    return [serializers.serialize_vehicle(v) for v in vehicles]


@vehicles_router.post(
    "",
    response_model=VehicleOut,
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def create_vehicle(payload: VehicleIn, db: Session = Depends(get_db)) -> VehicleOut:
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
def get_vehicle(vehicle_id: str, db: Session = Depends(get_db)) -> VehicleOut:
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return serializers.serialize_vehicle(vehicle)


@vehicles_router.patch(
    "/{vehicle_id}",
    response_model=VehicleOut,
    dependencies=[Depends(require_role("administrador"))],
)
def update_vehicle(vehicle_id: str, payload: VehicleIn, db: Session = Depends(get_db)) -> VehicleOut:
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
requests_router = APIRouter(
    prefix="/requests", tags=["requests"], dependencies=[Depends(get_current_user)]
)


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
) -> list[RequestOut]:
    stmt = select(Request)
    if status:
        stmt = stmt.where(Request.status == status)
    if day:
        stmt = stmt.where(Request.date == day)
    if driver_id:
        stmt = stmt.where(Request.driver_id == driver_id)
    if vehicle_id:
        stmt = stmt.where(Request.vehicle_id == vehicle_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(Request.client_name.ilike(like) | Request.id.ilike(like))
    stmt = stmt.order_by(Request.date.desc(), Request.id.desc())
    return [serializers.serialize_request(r) for r in db.scalars(stmt).all()]


@requests_router.post(
    "",
    response_model=RequestOut,
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def create_request(payload: RequestIn, db: Session = Depends(get_db)) -> RequestOut:
    if not payload.client_id and not (payload.client_name and payload.phone):
        raise HTTPException(
            status_code=422,
            detail="Debés indicar un cliente existente (client_id) o nombre y teléfono nuevos.",
        )

    if payload.client_id:
        client = db.get(Client, payload.client_id)
        if client is None:
            raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    else:
        client = db.scalar(
            select(Client).where(Client.name == payload.client_name, Client.phone == payload.phone)
        )
        if client is None:
            client = Client(name=payload.client_name, phone=payload.phone)
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
def get_request(request_id: str, db: Session = Depends(get_db)) -> RequestOut:
    return serializers.serialize_request(_get_request_or_404(db, request_id))


@requests_router.patch(
    "/{request_id}",
    response_model=RequestOut,
    dependencies=[Depends(require_role("administrador"))],
)
def update_request(
    request_id: str, payload: RequestUpdate, db: Session = Depends(get_db)
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    data = payload.model_dump(exclude_unset=True)

    new_status = data.get("status")
    new_driver = data.get("driver_id", request.driver_id)
    new_vehicle = data.get("vehicle_id", request.vehicle_id)
    new_start = data.get("service_from", request.service_from)
    new_end = data.get("service_to", request.service_to)
    new_day = data.get("date", request.date)

    confirming = new_status == "Confirmada" or data.get("confirmed") is True
    if confirming:
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
        if received < float(request.deposit_required):
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
        "confirmed",
        "cargo_notes",
        "cargo_fragile",
        "cargo_approx_units",
    ):
        if field in data:
            setattr(request, field, data[field])

    if data.get("status") == "Cancelada":
        request.confirmed = False
        request.status = "Cancelada"

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


@requests_router.post("/{request_id}/arrived", response_model=RequestOut)
def mark_arrived(
    request_id: str, payload: ArrivedIn, db: Session = Depends(get_db)
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    request.arrived_at = payload.arrived_at
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


@requests_router.post("/{request_id}/finished", response_model=RequestOut)
def mark_finished(
    request_id: str, payload: FinishedIn, db: Session = Depends(get_db)
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    request.finished_at = payload.finished_at
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


@requests_router.post("/{request_id}/incidents", response_model=IncidentOut, status_code=201)
def add_incident(
    request_id: str, payload: IncidentIn, db: Session = Depends(get_db)
) -> IncidentOut:
    request = _get_request_or_404(db, request_id)
    incident = Incident(
        id=business.next_incident_id(db),
        request_id=request.id,
        type=payload.type,
        description=payload.description,
        time=payload.time,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return IncidentOut.model_validate(incident)


@requests_router.put("/{request_id}/remito", response_model=RequestOut)
def set_remito(request_id: str, payload: RemitoIn, db: Session = Depends(get_db)) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    request.remito_name = payload.name
    request.remito_data_url = payload.data_url
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


@requests_router.delete("/{request_id}/remito", response_model=RequestOut)
def delete_remito(request_id: str, db: Session = Depends(get_db)) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    request.remito_name = None
    request.remito_data_url = None
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


@requests_router.get("/{request_id}/payments", response_model=list[PaymentOut])
def list_payments(request_id: str, db: Session = Depends(get_db)) -> list[PaymentOut]:
    request = _get_request_or_404(db, request_id)
    return serializers.serialize_request(request).payments


@requests_router.post(
    "/{request_id}/payments",
    response_model=RequestOut,
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def add_payment(
    request_id: str, payload: PaymentIn, db: Session = Depends(get_db)
) -> RequestOut:
    request = _get_request_or_404(db, request_id)
    payment = Payment(
        request_id=request.id,
        concept=payload.concept,
        method=payload.method,
        received_by=payload.received_by,
        amount=payload.amount,
        date=payload.date,
        notes=payload.notes,
    )
    db.add(payment)
    db.commit()
    db.refresh(request)
    return serializers.serialize_request(request)


# --------------------------------------------------------------------------- #
# Pagos (resumen por viaje)
# --------------------------------------------------------------------------- #
payments_router = APIRouter(
    prefix="/payments",
    tags=["payments"],
    dependencies=[Depends(get_current_user), Depends(require_role("administrador"))],
)


@payments_router.get("/summary", response_model=list[PaymentSummaryRow])
def payments_summary(
    db: Session = Depends(get_db),
    day: date | None = Query(default=None, alias="date"),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
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


# --------------------------------------------------------------------------- #
# Disponibilidad
# --------------------------------------------------------------------------- #
availability_router = APIRouter(tags=["availability"], dependencies=[Depends(get_current_user)])


@availability_router.get("/availability", response_model=AvailabilityOut)
def availability(
    db: Session = Depends(get_db),
    day: date = Query(alias="date"),
    driver_id: str | None = Query(default=None),
    vehicle_id: str | None = Query(default=None),
    start: time = Query(...),
    end: time = Query(...),
    exclude: str | None = Query(default=None),
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
