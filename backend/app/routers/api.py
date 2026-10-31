"""Routers para el esquema nuevo."""

from __future__ import annotations

from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models import ItemCarga, Pago, Solicitud, Usuario, Vehiculo
from app.schemas import (
    AvailabilityOut,
    ChoferIn,
    ChoferOut,
    ChoferUpdate,
    ClienteIn,
    ClienteOut,
    CotizacionOut,
    CotizacionPreviewIn,
    LugarIn,
    MeOut,
    PagoIn,
    PagoOut,
    PlaceOut,
    PlaceSuggestionOut,
    RutaIn,
    RutaOut,
    SolicitudIn,
    SolicitudOut,
    SolicitudUpdate,
    TarifasIn,
    UsuarioOut,
    VehiculoIn,
    VehiculoOut,
    VehiculoUpdate,
)
from app.services import business, pricing, serializers
from app.services.scraping import get_geo_service
from app.services.scraping.schemas import GeoStatus

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
# Geolocalizacion (Google Maps, siempre del lado servidor)
# --------------------------------------------------------------------------- #
def _geo_result_http(result):
    if result.status == GeoStatus.UNAVAILABLE:
        raise HTTPException(status_code=503, detail=result.message or "Geolocalización no disponible.")
    if result.status == GeoStatus.NOT_FOUND:
        raise HTTPException(status_code=404, detail=result.message or "Ubicación no encontrada.")
    return result.value


geo_router = APIRouter(
    prefix="/geo", tags=["geo"], dependencies=[Depends(get_current_user)]
)


@geo_router.get("/places", response_model=list[PlaceSuggestionOut])
def search_places(
    q: str = Query(min_length=3, max_length=160),
    limit: int = Query(default=5, ge=1, le=10),
) -> list[PlaceSuggestionOut]:
    suggestions = get_geo_service().search(q, limit)
    if suggestions.status == GeoStatus.UNAVAILABLE:
        raise HTTPException(status_code=503, detail=suggestions.message)
    if suggestions.status == GeoStatus.NOT_FOUND:
        return []
    return [
        PlaceSuggestionOut(
            place_id=s.place_id,
            primary=s.primary,
            secondary=s.secondary,
            lat=s.lat,
            lng=s.lng,
        )
        for s in suggestions.value
    ]


@geo_router.get("/places/{place_id}", response_model=PlaceOut)
def get_place(place_id: str) -> PlaceOut:
    detail = _geo_result_http(get_geo_service().resolve(place_id))
    return PlaceOut(
        place_id=detail.place_id,
        direccion=detail.direccion,
        lat=detail.lat,
        lng=detail.lng,
        localidad=detail.localidad,
        partido=detail.partido,
        provincia=detail.provincia,
    )


@geo_router.post("/route", response_model=RutaOut)
def route_estimate(payload: RutaIn) -> RutaOut:
    estimate = _geo_result_http(
        get_geo_service().route(
            (payload.origen.lat, payload.origen.lng),
            (payload.destino.lat, payload.destino.lng),
        )
    )
    ida = pricing.ceil_km(estimate.distance_km)
    return RutaOut(
        km_ida=float(ida),
        km_vuelta=float(ida),
        km_total=float(ida * 2),
        duracion_ida_min=estimate.duration_min,
        duracion_vuelta_min=estimate.duration_min,
    )


# --------------------------------------------------------------------------- #
# Cotizacion
# --------------------------------------------------------------------------- #
def _quote_out(quote: pricing.Quote) -> CotizacionOut:
    return CotizacionOut(
        km_ida=float(quote.km_ida),
        km_vuelta=float(quote.km_vuelta),
        km_total=float(quote.km_total),
        duracion_ida_min=quote.duracion_ida_min,
        duracion_vuelta_min=quote.duracion_vuelta_min,
        espera_min=quote.espera_min,
        horas_totales=float(quote.horas_totales),
        tarifa_base=float(quote.tarifa_base),
        tarifa_por_km=float(quote.tarifa_por_km),
        tarifa_por_hora=float(quote.tarifa_por_hora),
        costo_base=float(quote.costo_base),
        costo_km=float(quote.costo_km),
        costo_tiempo=float(quote.costo_tiempo),
        costo_chofer=float(quote.costo_chofer),
        margen=float(quote.margen),
        precio_sugerido=float(quote.precio_sugerido),
        sena_requerida=float(quote.sena_requerida),
    )


pricing_router = APIRouter(
    prefix="/pricing", tags=["pricing"], dependencies=[Depends(get_current_user)]
)


@pricing_router.post("/preview", response_model=CotizacionOut)
def pricing_preview(payload: CotizacionPreviewIn) -> CotizacionOut:
    """Vista previa con tarifas sin guardar (pantalla de configuracion)."""
    settings = get_settings()
    espera = (
        payload.espera_min
        if payload.espera_min is not None
        else settings.default_wait_minutes
    )
    quote = pricing.compute_quote(
        km_ida=payload.km_ida,
        duracion_ida_min=payload.duracion_ida_min,
        espera_min=espera,
        tarifa_base=payload.tarifa_base,
        tarifa_por_km=payload.tarifa_por_km,
        tarifa_por_hora=payload.tarifa_por_hora,
        margen=settings.pricing_margin,
    )
    return _quote_out(quote)


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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Ya existe un usuario con ese email."
        ) from exc
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
def update_driver(driver_id: int, payload: ChoferUpdate, db: Session = Depends(get_db)) -> ChoferOut:
    driver = db.get(Usuario, driver_id)
    if driver is None or driver.rol != "chofer":
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    # Actualizacion parcial: un PATCH del formulario de flota manda solo
    # nombre, telefono, email y estado; no debe borrar licencia ni tarifas.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(driver, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Ya existe un usuario con ese email."
        ) from exc
    db.refresh(driver)
    return serializers.serialize_driver(driver)


@drivers_router.put("/{driver_id}/rates", response_model=ChoferOut)
def update_driver_rates(
    driver_id: int,
    payload: TarifasIn,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ChoferOut:
    """Tarifas del chofer: las define la administración o el propio chofer.

    Se separa del PATCH general para que el formulario de flota (que solo manda
    datos personales) no pueda tocar la plata por accidente.
    """
    if user["rol"] != "administrador" and user["usuario_id"] != driver_id:
        raise HTTPException(
            status_code=403,
            detail="Solo la administración o el propio chofer pueden cambiar sus tarifas.",
        )
    driver = db.get(Usuario, driver_id)
    if driver is None or driver.rol != "chofer":
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    driver.tarifa_base = payload.tarifa_base
    driver.tarifa_por_km = payload.tarifa_por_km
    driver.tarifa_por_hora = payload.tarifa_por_hora
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
        # expire_on_commit=False: sin populate_existing la sesion devuelve la
        # coleccion cacheada y un pago recien insertado no aparece en la
        # respuesta del POST.
        .execution_options(populate_existing=True)
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


def _get_driver_or_404(db: Session, driver_id: int) -> Usuario:
    driver = db.get(Usuario, driver_id)
    if driver is None or driver.rol != "chofer":
        raise HTTPException(status_code=404, detail="Chofer no encontrado.")
    return driver


def _resolver_lugar(lugar: LugarIn) -> tuple[str, str | None, str | None, float | None, float | None]:
    """Direccion, barrio, place_id y coordenadas de un extremo del viaje.

    Con `place_id` se consulta Google Maps: la direccion y las coordenadas que
    se guardan son las del servidor, no las que mando el navegador.
    """
    if not lugar.place_id:
        # Las coordenadas sin identidad de Google no son confiables. Se
        # conserva el modo manual como solicitud sin geolocalizacion.
        return lugar.direccion, lugar.barrio, None, None, None

    result = get_geo_service().resolve(lugar.place_id)
    if result.status != GeoStatus.OK:
        # La geolocalización es opcional: se guarda la dirección manual sin
        # coordenadas ni place_id para evitar inventar datos.
        return lugar.direccion, lugar.barrio, None, None, None
    detalle = result.value
    barrio = lugar.barrio or detalle.locality or detalle.partido
    lat = detalle.lat
    lng = detalle.lng
    if detalle.provider == "osm" and lugar.lat is not None and lugar.lng is not None:
        lat = lugar.lat
        lng = lugar.lng
    direccion = (
        lugar.direccion
        if detalle.provider == "osm"
        else detalle.address or lugar.direccion
    )
    return (
        direccion,
        barrio,
        detalle.place_id,
        lat,
        lng,
    )


def _cotizacion_para(
    request: Solicitud, driver: Usuario, espera_min: int | None = None
) -> pricing.Quote:
    if request.km_estimados is None:
        raise HTTPException(
            status_code=409,
            detail="La solicitud no tiene distancia calculada. Cargá origen y destino con geolocalización.",
        )
    settings = get_settings()
    return pricing.compute_quote(
        km_ida=request.km_estimados,
        duracion_ida_min=request.duracion_ida_min,
        duracion_vuelta_min=request.duracion_vuelta_min,
        espera_min=request.espera_min if espera_min is None else espera_min,
        tarifa_base=driver.tarifa_base,
        tarifa_por_km=driver.tarifa_por_km,
        tarifa_por_hora=driver.tarifa_por_hora,
        margen=settings.pricing_margin,
    )


def _guardar_cotizacion(request: Solicitud, quote: pricing.Quote) -> None:
    """Persiste el recorrido, el snapshot de tarifas y el costo del chofer."""
    request.km_estimados = float(quote.km_ida)
    request.km_vuelta = float(quote.km_vuelta)
    request.km_total = float(quote.km_total)
    request.duracion_ida_min = quote.duracion_ida_min
    request.duracion_vuelta_min = quote.duracion_vuelta_min
    request.espera_min = quote.espera_min
    horas = quote.horas_totales
    request.horas_estimadas = float(horas) if horas > 0 else None
    request.tarifa_base_aplicada = float(quote.tarifa_base)
    request.tarifa_km_aplicada = float(quote.tarifa_por_km)
    request.tarifa_hora_aplicada = float(quote.tarifa_por_hora)
    request.costo_chofer = float(quote.costo_chofer)
    request.precio_calculado = float(quote.precio_sugerido)


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

    settings = get_settings()
    espera_min = (
        payload.espera_min
        if payload.espera_min is not None
        else settings.default_wait_minutes
    )

    origen = _resolver_lugar(payload.origen)
    destino = _resolver_lugar(payload.destino)
    origen_dir, origen_barrio, origen_place_id, origen_lat, origen_lng = origen
    destino_dir, destino_barrio, destino_place_id, destino_lat, destino_lng = destino

    # La distancia la calcula el backend cuando hay coordenadas reales. Si no
    # las hay, se aceptan los valores manuales (modo sin geolocalizacion) y no
    # se inventa nada.
    km_estimados = payload.km_estimados
    km_vuelta = None
    km_total = None
    duracion_ida_min = None
    duracion_vuelta_min = None
    horas_estimadas = payload.horas_estimadas

    if all(v is not None for v in (origen_lat, origen_lng, destino_lat, destino_lng)):
        result = get_geo_service().route(
            (origen_lat, origen_lng), (destino_lat, destino_lng)
        )
        if result.status != GeoStatus.OK:
            estimacion = None
        else:
            estimacion = result.value
        if estimacion is None:
            origen_lat = origen_lng = destino_lat = destino_lng = None
        else:
            ida = pricing.ceil_km(estimacion.distance_km)
            km_estimados = float(ida)
            km_vuelta = float(ida)
            km_total = float(ida * 2)
            duracion_ida_min = estimacion.duration_min
            duracion_vuelta_min = estimacion.duration_min
            horas = pricing.total_hours(duracion_ida_min, duracion_vuelta_min, espera_min)
            horas_estimadas = float(horas) if horas > 0 else None

    solicitud = Solicitud(
        cliente_id=cliente.id,
        cliente_rol="cliente",
        estado="pendiente",
        fecha=payload.fecha,
        hora_desde=payload.hora_desde,
        hora_hasta=payload.hora_hasta,
        origen_direccion=origen_dir,
        origen_barrio=origen_barrio,
        origen_piso=payload.origen.piso,
        origen_ascensor=payload.origen.ascensor,
        origen_notas=payload.origen.notas,
        origen_place_id=origen_place_id,
        origen_lat=origen_lat,
        origen_lng=origen_lng,
        destino_direccion=destino_dir,
        destino_barrio=destino_barrio,
        destino_piso=payload.destino.piso,
        destino_ascensor=payload.destino.ascensor,
        destino_notas=payload.destino.notas,
        destino_place_id=destino_place_id,
        destino_lat=destino_lat,
        destino_lng=destino_lng,
        km_estimados=km_estimados,
        km_vuelta=km_vuelta,
        km_total=km_total,
        duracion_ida_min=duracion_ida_min,
        duracion_vuelta_min=duracion_vuelta_min,
        espera_min=espera_min,
        horas_estimadas=horas_estimadas,
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


@requests_router.get("/{request_ref}/quote", response_model=CotizacionOut)
def quote_request(
    request_ref: str,
    driver_id: int = Query(...),
    espera_min: int | None = Query(default=None, ge=0, le=1440),
    db: Session = Depends(get_db),
) -> CotizacionOut:
    """Cotizacion del viaje con las tarifas vigentes del chofer."""
    request = _get_request_or_404(db, request_ref)
    driver = _get_driver_or_404(db, driver_id)
    return _quote_out(_cotizacion_para(request, driver, espera_min))


@requests_router.get("/{request_ref}")
def get_request(request_ref: str, db: Session = Depends(get_db)) -> dict:
    return serializers.serialize_solicitud(_get_request_or_404(db, request_ref))


@requests_router.patch(
    "/{request_ref}",
    dependencies=[Depends(require_role("administrador"))],
)
def update_request(
    request_ref: str,
    payload: SolicitudUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    request = _get_request_or_404(db, request_ref)
    data = payload.model_dump(exclude_unset=True)
    recotizar = bool(data.pop("recotizar", False))
    precio_enviado = "precio_final" in data

    new_estado = data.get("estado")
    new_chofer = data.get("chofer_id", request.chofer_id)
    new_vehiculo = data.get("vehiculo_id", request.vehiculo_id)
    new_fecha = data.get("fecha", request.fecha)
    new_desde = data.get("hora_desde", request.hora_desde)
    new_hasta = data.get("hora_hasta", request.hora_hasta)
    driver_changed = "chofer_id" in data and data["chofer_id"] != request.chofer_id
    wait_changed = "espera_min" in data and data["espera_min"] != request.espera_min

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
                status_code=409, detail="El vehículo no está operativo."
            )
        if business.vehicle_conflicts(db, new_vehiculo, new_fecha, new_desde, new_hasta, exclude_id=request.id):
            raise HTTPException(
                status_code=409, detail="El vehículo ya tiene un viaje confirmado en ese horario."
            )

    for field, value in data.items():
        setattr(request, field, value)

    # La cotizacion se guarda al planificar o al cambiar el chofer/espera. Una
    # vez confirmado, el viaje conserva el snapshot historico de tarifas.
    driver = db.get(Usuario, request.chofer_id) if request.chofer_id else None
    preserve_snapshot = (
        request.estado in ("confirmada", "finalizada")
        and not recotizar
        and not driver_changed
        and not wait_changed
        and request.tarifa_base_aplicada is not None
    )
    if (
        driver is not None
        and driver.rol == "chofer"
        and request.km_estimados is not None
        and not preserve_snapshot
    ):
        quote = _cotizacion_para(request, driver)
        _guardar_cotizacion(request, quote)
        sugerido = float(quote.precio_sugerido)
        if recotizar or (not precio_enviado and request.precio_modificado_por is None):
            request.precio_final = sugerido
            request.precio_modificado_por = None
            request.precio_modificado_en = None
        elif precio_enviado and float(request.precio_final) != sugerido:
            request.precio_modificado_por = user["usuario_id"]
            request.precio_modificado_en = datetime.now(timezone.utc)
        elif precio_enviado:
            request.precio_modificado_por = None
            request.precio_modificado_en = None

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
