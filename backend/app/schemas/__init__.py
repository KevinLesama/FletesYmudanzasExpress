"""Esquemas Pydantic de entrada y salida."""

from __future__ import annotations

from datetime import date as DateType
from datetime import time as TimeType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SolicitudEstado = Literal["pendiente", "confirmada", "finalizada", "cancelada"]
UsuarioRol = Literal["administrador", "chofer", "cliente"]
VehiculoEstado = Literal["disponible", "en_taller", "fuera_de_servicio"]
PagoConcepto = Literal["sena", "saldo"]
PagoMetodo = Literal["efectivo", "transferencia"]


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


class ChoferIn(BaseModel):
    nombre: str = Field(min_length=1)
    telefono: str = Field(min_length=1)
    email: str | None = None
    licencia: str | None = None
    tarifa_base: float = 0
    tarifa_por_km: float = 0
    tarifa_por_hora: float = 0
    activo: bool = True


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
    km_estimados: float | None = Field(default=None, ge=0)
    horas_estimadas: float | None = Field(default=None, gt=0)
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
    precio_calculado: float | None = Field(default=None, ge=0)
    precio_final: float | None = Field(default=None, ge=0)
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

    chofer_id: int | None = None
    chofer_rol: str | None = None
    vehiculo_id: int | None = None

    km_estimados: float | None = None
    horas_estimadas: float | None = None
    precio_calculado: float | None = None
    precio_final: float
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
