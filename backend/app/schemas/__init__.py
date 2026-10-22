"""Esquemas Pydantic de entrada y salida."""

from __future__ import annotations

from datetime import date as DateType
from datetime import time as TimeType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RequestStatus = Literal["Pendiente de revisión", "Pendiente de seña", "Confirmada", "Cancelada"]
UserRole = Literal["admin", "chofer", "cliente"]
UserStatus = Literal["Activo", "Inactivo"]
VehicleStatus = Literal["Disponible", "Asignado", "En taller"]
PaymentConcept = Literal["Seña", "Saldo"]
PaymentMethod = Literal["Transferencia", "Cuenta corriente", "Efectivo"]
ReceivedBy = Literal["Administración", "Chofer"]


# --------------------------------------------------------------------------- #
# Usuarios (administradores, choferes y clientes)
# --------------------------------------------------------------------------- #
class FactorIn(BaseModel):
    label: str = ""
    amount: float = 0


class FactorOut(FactorIn):
    pass


class UserIn(BaseModel):
    id: str | None = Field(default=None, min_length=1, max_length=16)
    role: UserRole = "cliente"
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    email: str | None = None
    initials: str | None = Field(default=None, max_length=4)
    status: UserStatus = "Activo"
    base_rate: float = 0
    rate_per_km: float = 0
    rate_per_hour: float = 0


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    phone: str | None = Field(default=None, min_length=1)
    email: str | None = None
    initials: str | None = Field(default=None, max_length=4)
    status: UserStatus | None = None


class UserRatesIn(BaseModel):
    """Usado por la pantalla 'Mi configuración' del chofer."""

    base_rate: float = 0
    rate_per_km: float = 0
    rate_per_hour: float = 0
    factors: list[FactorIn] = Field(default_factory=list)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: UserRole
    name: str
    phone: str
    email: str | None = None
    initials: str | None = None
    status: UserStatus
    base_rate: float
    rate_per_km: float
    rate_per_hour: float
    factors: list[FactorOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Vehiculos
# --------------------------------------------------------------------------- #
class VehicleIn(BaseModel):
    id: str = Field(min_length=1, max_length=16)
    type: str = Field(min_length=1)
    capacity_kg: int = Field(gt=0)
    status: VehicleStatus = "Disponible"
    assigned_note: str | None = None


class VehicleUpdate(BaseModel):
    type: str | None = None
    capacity_kg: int | None = Field(default=None, gt=0)
    status: VehicleStatus | None = None
    assigned_note: str | None = None


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    capacity_kg: int
    status: VehicleStatus
    assigned_note: str | None = None


# --------------------------------------------------------------------------- #
# Solicitudes
# --------------------------------------------------------------------------- #
class PlaceIn(BaseModel):
    address: str = Field(min_length=1)
    barrio: str = ""
    floor: str = ""
    elevator: bool = False


class CargoItemIn(BaseModel):
    name: str = Field(min_length=1)
    units: int = Field(default=1, ge=1)
    note: str | None = None


class CargoIn(BaseModel):
    items: list[CargoItemIn] = Field(default_factory=list)
    approx_units: int = Field(default=0, ge=0)
    fragile: bool = False
    notes: str = ""


class RequestIn(BaseModel):
    client_id: str | None = None
    client_name: str | None = None
    phone: str | None = None
    date: DateType
    arrival_from: TimeType
    arrival_to: TimeType
    service_from: TimeType
    service_to: TimeType
    origin: PlaceIn
    destination: PlaceIn
    cargo: CargoIn = Field(default_factory=CargoIn)
    price: float = Field(default=0, ge=0)
    deposit_required: float = Field(default=0, ge=0)
    estimated_km: int | None = Field(default=None, ge=0)
    estimated_hours: int | None = Field(default=None, ge=0)


class RequestUpdate(BaseModel):
    driver_id: str | None = None
    vehicle_id: str | None = None
    date: DateType | None = None
    service_from: TimeType | None = None
    service_to: TimeType | None = None
    price: float | None = Field(default=None, ge=0)
    deposit_required: float | None = Field(default=None, ge=0)
    estimated_km: int | None = Field(default=None, ge=0)
    estimated_hours: int | None = Field(default=None, ge=0)
    status: RequestStatus | None = None
    cargo_notes: str | None = None
    cargo_fragile: bool | None = None
    cargo_approx_units: int | None = Field(default=None, ge=0)


class RemitoIn(BaseModel):
    name: str = Field(min_length=1)
    data_url: str = Field(min_length=1)


class PaymentIn(BaseModel):
    concept: PaymentConcept
    method: PaymentMethod
    received_by: ReceivedBy
    amount: float = Field(gt=0)
    date: DateType
    notes: str | None = None
    remito_name: str | None = None
    remito_data_url: str | None = None


# -------------------------------- salidas ---------------------------------- #
class CargoItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    units: int
    note: str | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    concept: PaymentConcept
    method: PaymentMethod
    received_by: ReceivedBy
    amount: float
    date: DateType
    notes: str | None = None
    remito_name: str | None = None
    remito_data_url: str | None = None


class RequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    client_name: str
    phone: str
    status: RequestStatus
    date: DateType
    arrival_from: TimeType
    arrival_to: TimeType
    service_from: TimeType
    service_to: TimeType
    origin_address: str
    origin_barrio: str
    origin_floor: str
    origin_elevator: bool
    destination_address: str
    destination_barrio: str
    destination_floor: str
    destination_elevator: bool
    cargo_approx_units: int
    cargo_fragile: bool
    cargo_notes: str
    cargo_items: list[CargoItemOut] = Field(default_factory=list)
    driver_id: str | None = None
    vehicle_id: str | None = None
    price: float
    deposit_required: float
    deposit_received: float = 0
    estimated_km: int | None = None
    estimated_hours: int | None = None
    payments: list[PaymentOut] = Field(default_factory=list)


class PaymentSummaryRow(BaseModel):
    request_id: str
    client_name: str
    date: DateType
    price: float
    deposit: float
    collected: float
    balance: float
    state: Literal["Cobrado", "Parcial", "Sin pagos"]


class AvailabilityOut(BaseModel):
    driver_available: bool
    vehicle_available: bool
    conflicts: list[str] = Field(default_factory=list)


class SessionOut(BaseModel):
    """Sesion del usuario: es lo que devuelve GET /api/auth/me."""

    id: str
    name: str
    email: str | None = None
    role: UserRole
    initials: str | None = None
    status: UserStatus
