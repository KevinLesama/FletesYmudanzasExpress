"""Serializacion de entidades ORM a los esquemas de salida.

Se centraliza aca para no repetir el armado de objetos anidados en cada router
y para calcular campos derivados (por ejemplo, la sena recibida, que ahora se
deriva de la tabla de pagos en lugar de guardarse duplicada).
"""

from __future__ import annotations

from app.models import Request
from app.schemas import (
    CargoItemOut,
    ClientOut,
    DriverOut,
    FactorOut,
    IncidentOut,
    PaymentOut,
    RequestOut,
    VehicleOut,
)
from app.models import Client, Driver, Vehicle


def deposit_received(request: Request) -> float:
    return float(sum(p.amount for p in request.payments if p.concept == "Seña"))


def serialize_client(client: Client) -> ClientOut:
    return ClientOut.model_validate(client)


def serialize_driver(driver: Driver) -> DriverOut:
    return DriverOut(
        id=driver.id,
        initials=driver.initials,
        name=driver.name,
        phone=driver.phone,
        status=driver.status,  # type: ignore[arg-type]
        base_rate=float(driver.base_rate),
        rate_per_km=float(driver.rate_per_km),
        rate_per_hour=float(driver.rate_per_hour),
        factors=[FactorOut(label=f.label, amount=float(f.amount)) for f in driver.factors],
    )


def serialize_vehicle(vehicle: Vehicle) -> VehicleOut:
    return VehicleOut.model_validate(vehicle)


def serialize_request(request: Request) -> RequestOut:
    return RequestOut(
        id=request.id,
        client_id=request.client_id,
        client_name=request.client_name,
        phone=request.phone,
        status=request.status,  # type: ignore[arg-type]
        date=request.date,
        arrival_from=request.arrival_from,
        arrival_to=request.arrival_to,
        service_from=request.service_from,
        service_to=request.service_to,
        origin_address=request.origin_address,
        origin_barrio=request.origin_barrio,
        origin_floor=request.origin_floor,
        origin_elevator=request.origin_elevator,
        destination_address=request.destination_address,
        destination_barrio=request.destination_barrio,
        destination_floor=request.destination_floor,
        destination_elevator=request.destination_elevator,
        cargo_approx_units=request.cargo_approx_units,
        cargo_fragile=request.cargo_fragile,
        cargo_notes=request.cargo_notes,
        cargo_items=[
            CargoItemOut(name=i.name, units=i.units, note=i.note) for i in request.cargo_items
        ],
        driver_id=request.driver_id,
        vehicle_id=request.vehicle_id,
        price=float(request.price),
        deposit_required=float(request.deposit_required),
        deposit_received=deposit_received(request),
        confirmed=request.confirmed,
        estimated_km=request.estimated_km,
        estimated_hours=request.estimated_hours,
        arrived_at=request.arrived_at,
        finished_at=request.finished_at,
        remito_name=request.remito_name,
        remito_data_url=request.remito_data_url,
        incidents=[
            IncidentOut(id=i.id, type=i.type, description=i.description, time=i.time)
            for i in request.incidents
        ],
        payments=[
            PaymentOut(
                id=p.id,
                concept=p.concept,  # type: ignore[arg-type]
                method=p.method,  # type: ignore[arg-type]
                received_by=p.received_by,  # type: ignore[arg-type]
                amount=float(p.amount),
                date=p.date,
                notes=p.notes,
            )
            for p in request.payments
        ],
    )
