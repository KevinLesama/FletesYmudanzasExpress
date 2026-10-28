"""Routers para el esquema nuevo."""

from __future__ import annotations

from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.security import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models import ItemCarga, Pago, Solicitud, Usuario, Vehiculo
from app.schemas import (
    AvailabilityOut,
    ChoferIn,
    ChoferOut,
    ClienteIn,
    ClienteOut,
    MeOut,
    PagoIn,
    PagoOut,
    SolicitudIn,
    SolicitudOut,
    SolicitudUpdate,
    UsuarioOut,
    VehiculoIn,
    VehiculoOut,
    VehiculoUpdate,
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
    return MeOut(
        id=user["usuario_id"],
        email=user.get("email"),
        nombre=user["nombre"],
        rol=user["rol"],
    )


# --------------------------------------------------------------------------- #
# Clientes (usuarios con rol cliente)
# --------------------------------------------------------------------------- #
clients_router = APIRouter(
    prefix="/clients",
    tags=["clients"],
    dependencies=[Depends(get_current_user), Depends(require_role("administrador"))],
)


@clients_router.get("", response_model=list[ClienteOut])
def list_clients(db: Session = Depends(get_db)) -> list[ClienteOut]:
    clientes = db.scalars(
        select(Usuario).where(Usuario.rol == "cliente").order_by(Usuario.nombre)
    ).all()
    return [serializers.serialize_client(c) for c in clientes]


@clients_router.post("", response_model=ClienteOut, status_code=201)
def create_client(payload: ClienteIn, db: Session = Depends(get_db)) -> ClienteOut:
    existing = db.scalar(
        select(Usuario).where(Usuario.rol == "cliente", Usuario.nombre == payload.nombre, Usuario.telefono == payload.telefono)
    )
    if existing:
        return serializers.serialize_client(existing)
    cliente = Usuario(rol="cliente", nombre=payload.nombre, telefono=payload.telefono, email=payload.email)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return serializers.serialize_client(cliente)


# --------------------------------------------------------------------------- #
# Choferes
# --------------------------------------------------------------------------- #
drivers_router = APIRouter(
    prefix="/drivers", tags=["drivers"], dependencies=[Depends(get_current_user)]
)


@drivers_router.get("", response_model=list[ChoferOut])
def list_drivers(db: Session = Depends(get_db)) -> list[ChoferOut]:
    choferes = db.scalars(
        select(Usuario).where(Usuario.rol == "chofer").order_by(Usuario.nombre)
    ).all()
    return [serializers.serialize_driver(d) for d in choferes]


@drivers_router.post(
    "",
    response_model=ChoferOut,
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def create_driver(payload: ChoferIn, db: Session = Depends(get_db)) -> ChoferOut:
    chofer = Usuario(
        rol="chofer",
        nombre=payload.nombre,
        telefono=payload.telefono,
        email=payload.email,
        licencia=payload.licencia,
        tarifa_base=payload.tarifa_base,
        tarifa_por_km=payload.tarifa_por_km,
        tarifa_por_hora=payload.tarifa_por_hora,
        activo=payload.activo,
    )
    db.add(chofer)
    db.commit()
    db.refresh(chofer)
    return serializers.serialize_driver(chofer)


@drivers_router.get("/{driver_id}", response_model=ChoferOut)
def get_driver(driver_id: int, db: Session = Depends(get_db)) -> ChoferOut:
    driver = db.get(Usuario, driver_id)
    if driver is None or driver.rol != "chofer":
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    return serializers.serialize_driver(driver)


@drivers_router.patch(
    "/{driver_id}",
    response_model=ChoferOut,
    dependencies=[Depends(require_role("administrador"))],
)
def update_driver(driver_id: int, payload: ChoferIn, db: Session = Depends(get_db)) -> ChoferOut:
    driver = db.get(Usuario, driver_id)
    if driver is None or driver.rol != "chofer":
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    driver.nombre = payload.nombre
    driver.telefono = payload.telefono
    driver.email = payload.email
    driver.licencia = payload.licencia
    driver.tarifa_base = payload.tarifa_base
    driver.tarifa_por_km = payload.tarifa_por_km
    driver.tarifa_por_hora = payload.tarifa_por_hora
    driver.activo = payload.activo
    db.commit()
    db.refresh(driver)
    return serializers.serialize_driver(driver)


# --------------------------------------------------------------------------- #
# Vehiculos
# --------------------------------------------------------------------------- #
vehicles_router = APIRouter(
    prefix="/vehicles", tags=["vehicles"], dependencies=[Depends(get_current_user)]
)


@vehicles_router.get("", response_model=list[VehiculoOut])
def list_vehicles(db: Session = Depends(get_db)) -> list[VehiculoOut]:
    vehicles = db.scalars(select(Vehiculo).order_by(Vehiculo.id)).all()
    return [serializers.serialize_vehicle(v) for v in vehicles]


@vehicles_router.post(
    "",
    response_model=VehiculoOut,
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def create_vehicle(payload: VehiculoIn, db: Session = Depends(get_db)) -> VehiculoOut:
    vehicle = Vehiculo(
        patente=payload.patente,
        tipo=payload.tipo,
        capacidad_kg=payload.capacidad_kg,
        estado=payload.estado,
        notas=payload.notas,
        activo=payload.activo,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return serializers.serialize_vehicle(vehicle)


@vehicles_router.get("/{vehicle_id}", response_model=VehiculoOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)) -> VehiculoOut:
    vehicle = db.get(Vehiculo, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return serializers.serialize_vehicle(vehicle)


@vehicles_router.patch(
    "/{vehicle_id}",
    response_model=VehiculoOut,
    dependencies=[Depends(require_role("administrador"))],
)
def update_vehicle(vehicle_id: int, payload: VehiculoUpdate, db: Session = Depends(get_db)) -> VehiculoOut:
    vehicle = db.get(Vehiculo, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    data = payload.model_dump(exclude_unset=True)
    for field in data:
        setattr(vehicle, field, data[field])
    db.commit()
    db.refresh(vehicle)
    return serializers.serialize_vehicle(vehicle)


# --------------------------------------------------------------------------- #
# Solicitudes / viajes
# --------------------------------------------------------------------------- #
requests_router = APIRouter(
    prefix="/requests", tags=["requests"], dependencies=[Depends(get_current_user)]
)


def _get_request_or_404(db: Session, request_ref: str | int) -> Solicitud:
    """Acepta el codigo visible (FEX-1043) o el id numerico interno."""
    ref = str(request_ref).strip()
    condition = Solicitud.codigo == ref
    if ref.isdigit():
        condition = Solicitud.id == int(ref)
    request = db.scalar(
        select(Solicitud)
        .options(
            selectinload(Solicitud.cliente),
            selectinload(Solicitud.chofer),
            selectinload(Solicitud.vehiculo),
            selectinload(Solicitud.items_carga),
            selectinload(Solicitud.pagos),
        )
        .where(condition)
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    return request


def _resolve_request_id(db: Session, ref: str | int | None) -> int | None:
    """Resuelve una referencia opcional (codigo visible o id) al id interno."""
    if ref is None:
        return None
    value = str(ref).strip()
    if not value:
        return None
    if value.isdigit():
        return int(value)
    return db.scalar(select(Solicitud.id).where(Solicitud.codigo == value))


@requests_router.get("")
def list_requests(
    db: Session = Depends(get_db),
    estado: str | None = Query(default=None),
    fecha: date | None = Query(default=None),
    chofer_id: int | None = Query(default=None),
    vehiculo_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
) -> list:
    stmt = (
        select(Solicitud)
        .options(
            selectinload(Solicitud.cliente),
            selectinload(Solicitud.chofer),
            selectinload(Solicitud.vehiculo),
            selectinload(Solicitud.items_carga),
            selectinload(Solicitud.pagos),
        )
    )
    if estado:
        stmt = stmt.where(Solicitud.estado == estado)
    if fecha:
        stmt = stmt.where(Solicitud.fecha == fecha)
    if chofer_id:
        stmt = stmt.where(Solicitud.chofer_id == chofer_id)
    if vehiculo_id:
        stmt = stmt.where(Solicitud.vehiculo_id == vehiculo_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(Solicitud.codigo.ilike(like))
    stmt = stmt.order_by(Solicitud.fecha.desc(), Solicitud.id.desc())
    return [serializers.serialize_solicitud(r) for r in db.scalars(stmt).unique().all()]


@requests_router.post(
    "",
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def create_request(payload: SolicitudIn, db: Session = Depends(get_db)) -> dict:
    cliente = db.get(Usuario, payload.cliente_id)
    if cliente is None or cliente.rol != "cliente":
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    
    solicitud = Solicitud(
        codigo=f"FEX-{db.scalar(select(func.coalesce(func.max(Solicitud.id), 0))) + 1001:04d}" if False else None,  # se genera por default
        cliente_id=cliente.id,
        cliente_rol="cliente",
        estado="pendiente",
        fecha=payload.fecha,
        hora_desde=payload.hora_desde,
        hora_hasta=payload.hora_hasta,
        origen_direccion=payload.origen.direccion,
        origen_barrio=payload.origen.barrio,
        origen_piso=payload.origen.piso,
        origen_ascensor=payload.origen.ascensor,
        origen_notas=payload.origen.notas,
        destino_direccion=payload.destino.direccion,
        destino_barrio=payload.destino.barrio,
        destino_piso=payload.destino.piso,
        destino_ascensor=payload.destino.ascensor,
        destino_notas=payload.destino.notas,
        km_estimados=payload.km_estimados,
        horas_estimadas=payload.horas_estimadas,
        precio_calculado=payload.precio_calculado,
        precio_final=payload.precio_final,
        notas=payload.notas,
    )
    # El código se genera con DEFAULT en DB
    db.add(solicitud)
    db.flush()
    for pos, item in enumerate(payload.items_carga):
        db.add(
            ItemCarga(
                solicitud_id=solicitud.id,
                descripcion=item.descripcion,
                cantidad=item.cantidad,
                fragil=item.fragil,
                nota=item.nota,
                posicion=pos,
            )
        )
    db.commit()
    db.refresh(solicitud)
    return serializers.serialize_solicitud(solicitud)


@requests_router.get("/{request_ref}")
def get_request(request_ref: str, db: Session = Depends(get_db)) -> dict:
    return serializers.serialize_solicitud(_get_request_or_404(db, request_ref))


@requests_router.patch(
    "/{request_ref}",
    dependencies=[Depends(require_role("administrador"))],
)
def update_request(
    request_ref: str, payload: SolicitudUpdate, db: Session = Depends(get_db)
) -> dict:
    request = _get_request_or_404(db, request_ref)
    data = payload.model_dump(exclude_unset=True)

    new_estado = data.get("estado")
    new_chofer = data.get("chofer_id", request.chofer_id)
    new_vehiculo = data.get("vehiculo_id", request.vehiculo_id)
    new_fecha = data.get("fecha", request.fecha)
    new_desde = data.get("hora_desde", request.hora_desde)
    new_hasta = data.get("hora_hasta", request.hora_hasta)

    if new_estado == "confirmada":
        if not new_chofer or not new_vehiculo:
            raise HTTPException(
                status_code=409, detail="Para confirmar el viaje se requiere chofer y vehículo."
            )
        if business.driver_conflicts(db, new_chofer, new_fecha, new_desde, new_hasta, exclude_id=request.id):
            raise HTTPException(
                status_code=409, detail="El chofer ya tiene un viaje confirmado en ese horario."
            )
        vehicle = db.get(Vehiculo, new_vehiculo)
        if vehicle is None:
            raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
        if not business.vehicle_is_assignable(db, vehicle):
            raise HTTPException(
                status_code=409, detail="El vehículo no está disponible (en taller)."
            )
        if business.vehicle_conflicts(db, new_vehiculo, new_fecha, new_desde, new_hasta, exclude_id=request.id):
            raise HTTPException(
                status_code=409, detail="El vehículo ya tiene un viaje confirmado en ese horario."
            )

    for field, value in data.items():
        setattr(request, field, value)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicto de integridad.") from exc

    db.commit()
    db.refresh(request)
    return serializers.serialize_solicitud(request)


# --------------------------------------------------------------------------- #
# Pagos
# --------------------------------------------------------------------------- #
payments_router = APIRouter(
    prefix="/payments",
    tags=["payments"],
    dependencies=[Depends(get_current_user), Depends(require_role("administrador"))],
)


@payments_router.get("/requests/{request_ref}/payments", response_model=list[PagoOut])
def list_payments(request_ref: str, db: Session = Depends(get_db)) -> list[PagoOut]:
    request = _get_request_or_404(db, request_ref)
    return [PagoOut.model_validate(p) for p in request.pagos]


@payments_router.post(
    "/requests/{request_ref}/payments",
    status_code=201,
    dependencies=[Depends(require_role("administrador"))],
)
def add_payment(
    request_ref: str,
    payload: PagoIn,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    request = _get_request_or_404(db, request_ref)
    recibido_por_id = payload.recibido_por_id or user["usuario_id"]
    recibido_por = db.get(Usuario, recibido_por_id)
    if recibido_por is None:
        raise HTTPException(status_code=404, detail="Usuario receptor no encontrado.")
    payment = Pago(
        solicitud_id=request.id,
        concepto=payload.concepto,
        metodo=payload.metodo,
        monto=payload.monto,
        fecha=payload.fecha or date.today(),
        recibido_por_id=recibido_por_id,
        comprobante_ruta=payload.comprobante_ruta,
        comprobante_nombre=payload.comprobante_nombre,
        notas=payload.notas,
    )
    db.add(payment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicto al registrar pago.") from exc
    return serializers.serialize_solicitud(_get_request_or_404(db, request_ref))


@payments_router.get("/summary")
def payments_summary(
    db: Session = Depends(get_db),
    fecha: date | None = Query(default=None),
    search: str | None = Query(default=None),
) -> list[dict]:
    """Resumen de cobros por viaje con el formato que consume el panel."""
    stmt = (
        select(Solicitud)
        .options(
            selectinload(Solicitud.cliente),
            selectinload(Solicitud.pagos),
        )
        .order_by(Solicitud.fecha.desc(), Solicitud.id.desc())
    )
    if fecha:
        stmt = stmt.where(Solicitud.fecha == fecha)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(Solicitud.codigo.ilike(like))

    rows: list[dict] = []
    for solicitud in db.scalars(stmt).unique().all():
        precio = float(solicitud.precio_final)
        pagos = list(solicitud.pagos or [])
        cobrado = sum(float(p.monto) for p in pagos)
        sena = sum(
            float(p.monto)
            for p in pagos
            if getattr(p, "concepto", None) == "sena"
        )
        if cobrado <= 0:
            estado = "Sin pagos"
        elif cobrado < precio:
            estado = "Parcial"
        else:
            estado = "Cobrado"
        cliente = getattr(solicitud, "cliente", None)
        rows.append(
            {
                "request_id": solicitud.codigo,
                "client_name": getattr(cliente, "nombre", None) or "",
                "date": solicitud.fecha.isoformat(),
                "price": precio,
                "deposit": sena,
                "collected": cobrado,
                "balance": max(precio - cobrado, 0.0),
                "state": estado,
            }
        )
    return rows


# --------------------------------------------------------------------------- #
# Disponibilidad
# --------------------------------------------------------------------------- #
availability_router = APIRouter(tags=["availability"], dependencies=[Depends(get_current_user)])


@availability_router.get("/availability", response_model=AvailabilityOut)
def availability(
    db: Session = Depends(get_db),
    fecha: date = Query(...),
    chofer_id: int | None = Query(default=None),
    vehiculo_id: int | None = Query(default=None),
    hora_desde: time = Query(...),
    hora_hasta: time = Query(...),
    exclude: str | None = Query(default=None),
) -> AvailabilityOut:
    conflicts: list[str] = []
    driver_ok = True
    vehicle_ok = True
    exclude_id = _resolve_request_id(db, exclude)

    if chofer_id:
        drive_conf = business.driver_conflicts(
            db, chofer_id, fecha, hora_desde, hora_hasta, exclude_id=exclude_id
        )
        if drive_conf:
            driver_ok = False
            conflicts.extend(f"Chofer ocupado en {r.codigo}" for r in drive_conf)

    if vehiculo_id:
        vehicle = db.get(Vehiculo, vehiculo_id)
        if vehicle and not business.vehicle_is_assignable(db, vehicle):
            vehicle_ok = False
            conflicts.append(f"{vehiculo_id} no está operativo")
        else:
            veh_conf = business.vehicle_conflicts(
                db, vehiculo_id, fecha, hora_desde, hora_hasta, exclude_id=exclude_id
            )
            if veh_conf:
                vehicle_ok = False
                conflicts.extend(f"Vehículo ocupado en {r.codigo}" for r in veh_conf)

    return AvailabilityOut(
        driver_available=driver_ok, vehicle_available=vehicle_ok, conflicts=conflicts
    )
