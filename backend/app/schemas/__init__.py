"""Esquemas Pydantic de entrada y salida."""

from __future__ import annotations

from datetime import date as DateType
from datetime import time as TimeType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

SolicitudEstado = Literal["pendiente", "confirmada", "finalizada", "cancelada"]
UsuarioRol = Literal["administrador", "chofer", "cliente"]
VehiculoEstado = Literal["disponible", "en_taller", "fuera_de_servicio"]
PagoConcepto = Literal["sena", "saldo"]
PagoMetodo = Literal["efectivo", "transferencia"]

# Mismo criterio que ck_usuarios_email en backend/sql/schema.sql.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


# --------------------------------------------------------------------------- #
# Usuarios / Clientes / Choferes
# --------------------------------------------------------------------------- #
class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rol: UsuarioRol
    nombre: str
    telefono: str
    email: str | None = None
    licencia: str | None = None
    tarifa_base: float = 0
    tarifa_por_km: float = 0
    tarifa_por_hora: float = 0
    activo: bool = True


class ClienteIn(BaseModel):
    nombre: str = Field(min_length=1)
    telefono: str = Field(min_length=1)
    email: str | None = None


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    telefono: str
    email: str | None = None


class _ChoferBase(BaseModel):
    """Reglas de nombre y telefono compartidas por alta y edicion.

    Replican las restricciones de la tabla usuarios para que un dato invalido
    devuelva 422 en el campo en vez de un error de integridad generico.
    """

    @field_validator("nombre", check_fields=False)
    @classmethod
    def _nombre_no_vacio(cls, value: str | None) -> str | None:
        if value is None:
            return value
        limpio = value.strip()
        if not limpio:
            raise ValueError("El nombre no puede estar vacio.")
        return limpio

    @field_validator("telefono", check_fields=False)
    @classmethod
    def _telefono_con_digitos(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if sum(ch.isdigit() for ch in value) < 6:
            raise ValueError("El telefono debe tener al menos 6 digitos.")
        return value


class ChoferIn(_ChoferBase):
    nombre: str = Field(min_length=1)
    telefono: str = Field(min_length=1)
    # Obligatorio para el personal: lo exige ck_usuarios_email_personal.
    email: str = Field(pattern=EMAIL_PATTERN)
    licencia: str | None = None
    tarifa_base: float = 0
    tarifa_por_km: float = 0
    tarifa_por_hora: float = 0
    activo: bool = True


class ChoferUpdate(_ChoferBase):
    """Actualizacion parcial: solo se aplican los campos enviados."""

    nombre: str | None = Field(default=None, min_length=1)
    telefono: str | None = Field(default=None, min_length=1)
    email: str | None = Field(default=None, pattern=EMAIL_PATTERN)
    licencia: str | None = None
    tarifa_base: float | None = Field(default=None, ge=0)
    tarifa_por_km: float | None = Field(default=None, ge=0)
    tarifa_por_hora: float | None = Field(default=None, ge=0)
    activo: bool | None = None


class ChoferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    telefono: str
    email: str | None = None
    licencia: str | None = None
    tarifa_base: float = 0
    tarifa_por_km: float = 0
    tarifa_por_hora: float = 0
    activo: bool = True


# Alias para compatibilidad con routers existentes
ClientIn = ClienteIn
ClientOut = ClienteOut
DriverIn = ChoferIn
DriverOut = ChoferOut


# --------------------------------------------------------------------------- #
# Vehiculos
# --------------------------------------------------------------------------- #
class VehiculoIn(BaseModel):
    patente: str = Field(min_length=1)
    tipo: str = Field(min_length=1)
    capacidad_kg: int = Field(gt=0)
    estado: VehiculoEstado = "disponible"
    notas: str | None = None
    activo: bool = True


class VehiculoUpdate(BaseModel):
    patente: str | None = None
    tipo: str | None = None
    capacidad_kg: int | None = Field(default=None, gt=0)
    estado: VehiculoEstado | None = None
    notas: str | None = None
    activo: bool | None = None


class VehiculoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patente: str
    tipo: str
    capacidad_kg: int
    estado: VehiculoEstado
    notas: str | None = None
    activo: bool = True


VehicleIn = VehiculoIn
VehicleUpdate = VehiculoUpdate
VehicleOut = VehiculoOut


# --------------------------------------------------------------------------- #
# Solicitudes
# --------------------------------------------------------------------------- #
class LugarIn(BaseModel):
    direccion: str = Field(min_length=1)
    barrio: str | None = None
    piso: str | None = None
    ascensor: bool = False
    notas: str | None = None
    # Identidad del lugar elegido en el autocompletado. Solo con place_id el
    # backend resuelve y persiste coordenadas contra Google Maps.
    place_id: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class ItemCargaIn(BaseModel):
    descripcion: str = Field(min_length=1)
    cantidad: int = Field(default=1, ge=1)
    fragil: bool = False
    nota: str | None = None


class CargaIn(BaseModel):
    items: list[ItemCargaIn] = Field(default_factory=list)


class SolicitudIn(BaseModel):
    cliente_id: int
    fecha: DateType
    hora_desde: TimeType
    hora_hasta: TimeType
    origen: LugarIn
    destino: LugarIn
    items_carga: list[ItemCargaIn] = Field(default_factory=list)
    # Solo se usan cuando la solicitud se carga a mano, sin geolocalizacion.
    # Con coordenadas, la distancia la calcula el backend y estos valores se
    # ignoran: nunca se confia en kilometros que manda el navegador.
    km_estimados: float | None = Field(default=None, ge=0)
    horas_estimadas: float | None = Field(default=None, gt=0)
    espera_min: int | None = Field(default=None, ge=0, le=1440)
    precio_calculado: float | None = Field(default=None, ge=0)
    precio_final: float = Field(default=0, ge=0)
    notas: str | None = None


class SolicitudUpdate(BaseModel):
    chofer_id: int | None = None
    vehiculo_id: int | None = None
    fecha: DateType | None = None
    hora_desde: TimeType | None = None
    hora_hasta: TimeType | None = None
    estado: SolicitudEstado | None = None
    km_estimados: float | None = Field(default=None, ge=0)
    horas_estimadas: float | None = Field(default=None, gt=0)
    espera_min: int | None = Field(default=None, ge=0, le=1440)
    precio_calculado: float | None = Field(default=None, ge=0)
    precio_final: float | None = Field(default=None, ge=0)
    # Vuelve a aplicar la formula y pisa el precio acordado con el sugerido.
    recotizar: bool = False
    notas: str | None = None
    motivo_cancelacion: str | None = None


class ItemCargaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    descripcion: str
    cantidad: int
    fragil: bool
    nota: str | None = None
    posicion: int


class SolicitudOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    cliente_id: int
    cliente_rol: str
    estado: SolicitudEstado
    fecha: DateType
    hora_desde: TimeType
    hora_hasta: TimeType

    origen_direccion: str
    origen_barrio: str | None = None
    origen_piso: str | None = None
    origen_ascensor: bool
    origen_notas: str | None = None

    destino_direccion: str
    destino_barrio: str | None = None
    destino_piso: str | None = None
    destino_ascensor: bool
    destino_notas: str | None = None

    origen_place_id: str | None = None
    origen_lat: float | None = None
    origen_lng: float | None = None
    destino_place_id: str | None = None
    destino_lat: float | None = None
    destino_lng: float | None = None

    chofer_id: int | None = None
    chofer_rol: str | None = None
    vehiculo_id: int | None = None

    km_estimados: float | None = None
    km_vuelta: float | None = None
    km_total: float | None = None
    duracion_ida_min: int | None = None
    duracion_vuelta_min: int | None = None
    espera_min: int = 120
    horas_estimadas: float | None = None
    tarifa_base_aplicada: float | None = None
    tarifa_km_aplicada: float | None = None
    tarifa_hora_aplicada: float | None = None
    costo_chofer: float | None = None
    precio_calculado: float | None = None
    precio_final: float
    sena_requerida: float = 0
    precio_editado: bool | None = None
    precio_modificado_por: int | None = None
    precio_modificado_en: str | None = None

    remito_numero: str | None = None
    remito_ruta: str | None = None
    remito_nombre: str | None = None
    remito_subido_por_id: int | None = None
    receptor_nombre: str | None = None
    receptor_documento: str | None = None
    remito_cargado: bool | None = None

    finalizada_en: str | None = None
    motivo_cancelacion: str | None = None
    notas: str | None = None

    items_carga: list[ItemCargaOut] = Field(default_factory=list)
    pagos: list["PagoOut"] = Field(default_factory=list)

    creado_en: str | None = None
    actualizado_en: str | None = None


# Compatibilidad con nombres viejos usados por routers/serializers
PlaceIn = LugarIn
CargoItemIn = ItemCargaIn
CargoIn = CargaIn
RequestIn = SolicitudIn
RequestUpdate = SolicitudUpdate
RequestOut = SolicitudOut
CargoItemOut = ItemCargaOut


# --------------------------------------------------------------------------- #
# Geolocalizacion y cotizacion
# --------------------------------------------------------------------------- #
class PlaceSuggestionOut(BaseModel):
    place_id: str
    primary: str
    secondary: str | None = None
    lat: float | None = None
    lng: float | None = None


class PlaceOut(BaseModel):
    place_id: str
    direccion: str
    lat: float
    lng: float
    localidad: str | None = None
    partido: str | None = None
    provincia: str | None = None


class CoordenadaIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class RutaIn(BaseModel):
    origen: CoordenadaIn
    destino: CoordenadaIn


class RutaOut(BaseModel):
    km_ida: float
    km_vuelta: float
    km_total: float
    duracion_ida_min: int
    duracion_vuelta_min: int


class CotizacionOut(BaseModel):
    """Desglose completo: lo que ve el admin y lo que se guarda en el viaje."""

    km_ida: float
    km_vuelta: float
    km_total: float
    duracion_ida_min: int
    duracion_vuelta_min: int
    espera_min: int
    horas_totales: float
    tarifa_base: float
    tarifa_por_km: float
    tarifa_por_hora: float
    costo_base: float
    costo_km: float
    costo_tiempo: float
    costo_chofer: float
    margen: float
    precio_sugerido: float
    sena_requerida: float


class CotizacionPreviewIn(BaseModel):
    """Vista previa con tarifas sin guardar (pantalla de configuracion)."""

    km_ida: float = Field(gt=0)
    duracion_ida_min: int | None = Field(default=None, ge=0)
    espera_min: int | None = Field(default=None, ge=0, le=1440)
    tarifa_base: float = Field(default=0, ge=0)
    tarifa_por_km: float = Field(default=0, ge=0)
    tarifa_por_hora: float = Field(default=0, ge=0)


class TarifasIn(BaseModel):
    tarifa_base: float = Field(ge=0)
    tarifa_por_km: float = Field(ge=0)
    tarifa_por_hora: float = Field(ge=0)


# --------------------------------------------------------------------------- #
# Pagos
# --------------------------------------------------------------------------- #
class PagoIn(BaseModel):
    concepto: PagoConcepto
    metodo: PagoMetodo
    monto: float = Field(gt=0)
    fecha: DateType | None = None
    recibido_por_id: int | None = None
    comprobante_ruta: str | None = None
    comprobante_nombre: str | None = None
    notas: str | None = None


class PagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    solicitud_id: int
    concepto: PagoConcepto
    metodo: PagoMetodo
    monto: float
    fecha: DateType
    recibido_por_id: int
    comprobante_ruta: str | None = None
    comprobante_nombre: str | None = None
    notas: str | None = None


PaymentIn = PagoIn
PaymentOut = PagoOut


# --------------------------------------------------------------------------- #
# Varios
# --------------------------------------------------------------------------- #
class AvailabilityOut(BaseModel):
    driver_available: bool
    vehicle_available: bool
    conflicts: list[str] = Field(default_factory=list)


class MeOut(BaseModel):
    """Identidad del usuario autenticado, resuelta contra `usuarios`."""

    id: int
    email: str | None = None
    nombre: str
    rol: UsuarioRol


# Aliases legacy
Client = ClienteOut
Driver = ChoferOut
Vehicle = VehiculoOut
Request = SolicitudOut
Payment = PagoOut
Incident = object  # ya no existe
RequestCargoItem = ItemCargaOut
DriverFactor = object
DriverFactorsIn = object
FactorIn = object
FactorOut = object
ArrivedIn = object
FinishedIn = object
IncidentIn = object
IncidentOut = object
RemitoIn = object
PaymentSummaryRow = object
RequestStatus = SolicitudEstado
DriverStatus = str
VehicleStatus = VehiculoEstado
PaymentConcept = PagoConcepto
PaymentMethod = PagoMetodo
ReceivedBy = object
