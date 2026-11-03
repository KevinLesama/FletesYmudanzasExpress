"""Pruebas de reglas de negocio: confirmacion con sena, conflictos de chofer/vehiculo."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.services import business

BASE_REQUEST = {
    "date": "2026-09-24",
    "arrival_from": "09:00",
    "arrival_to": "11:00",
    "service_from": "11:00",
    "service_to": "13:00",
    "origin": {"address": "Armenia 1450", "barrio": "Palermo", "floor": "Piso 3", "elevator": True},
    "destination": {"address": "Ruiz Huidobro 2500", "barrio": "Saavedra", "floor": "Piso 1", "elevator": False},
    "cargo": {"items": [{"name": "Cajas", "units": 5}], "approx_units": 5, "fragile": False, "notes": ""},
    "price": 100000,
    "deposit_required": 50000,
}


def _create(client: TestClient, seeded: dict, **overrides: object) -> dict:
    payload = {**BASE_REQUEST, "client_id": seeded["client_id"], **overrides}
    response = client.post("/api/requests", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_confirm_without_deposit_is_blocked(client: TestClient, seeded: dict) -> None:
    request = _create(client, seeded)
    response = client.patch(
        f"/api/requests/{request['id']}",
        json={"driver_id": seeded["driver_id"], "vehicle_id": seeded["vehicle_id"], "status": "Confirmada"},
    )
    assert response.status_code == 409
    assert "seña" in response.json()["detail"].lower()


def test_confirm_after_deposit_succeeds(client: TestClient, seeded: dict) -> None:
    request = _create(client, seeded)
    paid = client.post(
        f"/api/requests/{request['id']}/payments",
        json={
            "concept": "Seña",
            "method": "Transferencia",
            "received_by": "Administración",
            "amount": 50000,
            "date": "2026-09-22",
            "notes": "Seña 50%",
        },
    )
    assert paid.status_code == 201, paid.text
    assert paid.json()["deposit_received"] == 50000

    confirmed = client.patch(
        f"/api/requests/{request['id']}",
        json={"driver_id": seeded["driver_id"], "vehicle_id": seeded["vehicle_id"], "status": "Confirmada"},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "Confirmada"


def test_driver_conflict_blocks_confirmation(client: TestClient, seeded: dict) -> None:
    first = _create(client, seeded)
    client.post(
        f"/api/requests/{first['id']}/payments",
        json={"concept": "Seña", "method": "Efectivo", "received_by": "Administración", "amount": 50000, "date": "2026-09-22"},
    )
    confirm_first = client.patch(
        f"/api/requests/{first['id']}",
        json={"driver_id": seeded["driver_id"], "vehicle_id": seeded["vehicle_id"], "status": "Confirmada"},
    )
    assert confirm_first.status_code == 200

    second = _create(client, seeded, service_from="12:00", service_to="14:00")
    client.post(
        f"/api/requests/{second['id']}/payments",
        json={"concept": "Seña", "method": "Efectivo", "received_by": "Administración", "amount": 50000, "date": "2026-09-22"},
    )
    conflict = client.patch(
        f"/api/requests/{second['id']}",
        json={"driver_id": seeded["driver_id"], "vehicle_id": seeded["vehicle_id"], "status": "Confirmada"},
    )
    assert conflict.status_code == 409
    assert "chofer" in conflict.json()["detail"].lower()


def test_availability_endpoint(client: TestClient, seeded: dict) -> None:
    response = client.get(
        "/api/availability",
        params={
            "date": "2026-09-24",
            "driver_id": seeded["driver_id"],
            "vehicle_id": seeded["vehicle_id"],
            "start": "11:00",
            "end": "13:00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["driver_available"] is True
    assert body["vehicle_available"] is True


def test_client_login_returns_existing_client_without_creating_one(client: TestClient, seeded: dict) -> None:
    response = client.post("/api/clients/login", json={"name": "Kevin", "phone": "11 3291-5140"})
    assert response.status_code == 200
    assert response.json()["id"] == seeded["client_id"]

    invalid = client.post("/api/clients/login", json={"name": "Kevin", "phone": "11 0000-0000"})
    assert invalid.status_code == 401


def test_cancel_releases_vehicle(client: TestClient, seeded: dict) -> None:
    request = _create(client, seeded)
    client.post(
        f"/api/requests/{request['id']}/payments",
        json={"concept": "Seña", "method": "Efectivo", "received_by": "Administración", "amount": 50000, "date": "2026-09-22"},
    )
    client.patch(
        f"/api/requests/{request['id']}",
        json={"driver_id": seeded["driver_id"], "vehicle_id": seeded["vehicle_id"], "status": "Confirmada"},
    )
    assert client.get(f"/api/vehicles/{seeded['vehicle_id']}").json()["status"] == "Asignado"

    cancelled = client.patch(f"/api/requests/{request['id']}", json={"status": "Cancelada"})
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "Cancelada"
    assert client.get(f"/api/vehicles/{seeded['vehicle_id']}").json()["status"] == "Disponible"


# --------------------------------------------------------------------------- #
# Tope de pagos: regla pura, sin base de datos ni API.
# --------------------------------------------------------------------------- #
def _solicitud(precio: Decimal, pagos: list[tuple[str, Decimal]]):
    return SimpleNamespace(
        precio_final=precio,
        pagos=[SimpleNamespace(concepto=c, monto=m) for c, m in pagos],
    )


def test_validate_payment_amount_accumulates_sena() -> None:
    """Dos señas parciales no pueden superar la seña requerida (50 %)."""
    solicitud = _solicitud(Decimal("100000"), [("sena", Decimal("20000"))])

    business.validate_payment_amount(solicitud, "sena", Decimal("30000"))
    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "sena", Decimal("30001"))


def test_validate_payment_amount_rejects_full_sena_twice() -> None:
    solicitud = _solicitud(Decimal("100000"), [("sena", Decimal("50000"))])

    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "sena", Decimal("1"))


def test_validate_payment_amount_caps_balance_against_total() -> None:
    solicitud = _solicitud(
        Decimal("100000"),
        [("sena", Decimal("50000")), ("saldo", Decimal("20000"))],
    )

    business.validate_payment_amount(solicitud, "saldo", Decimal("30000"))
    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "saldo", Decimal("30001"))


def test_validate_payment_amount_requires_price_for_sena() -> None:
    solicitud = _solicitud(Decimal("0"), [])

    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "sena", Decimal("1"))


# --------------------------------------------------------------------------- #
# Estado derivado y confirmacion automatica: reglas puras, sin base de datos.
# --------------------------------------------------------------------------- #
def _viaje(
    estado: str = "pendiente",
    chofer: int | None = 7,
    vehiculo: int | None = 9,
    pagos: list[tuple[str, Decimal]] | None = None,
):
    return SimpleNamespace(
        id=1,
        codigo="FEX-1000",
        estado=estado,
        chofer_id=chofer,
        vehiculo_id=vehiculo,
        precio_final=Decimal("100000"),
        pagos=[SimpleNamespace(concepto=c, monto=m) for c, m in (pagos or [])],
    )


def test_sena_completa_exige_la_mitad_del_precio() -> None:
    assert not business.sena_completa(_viaje(pagos=[("sena", Decimal("49999"))]))
    assert business.sena_completa(_viaje(pagos=[("sena", Decimal("50000"))]))
    assert business.sena_completa(
        _viaje(pagos=[("sena", Decimal("30000")), ("sena", Decimal("20000"))])
    )


def test_derive_estado_sin_asignacion_es_pendiente() -> None:
    """Sin chofer o sin rodado la seña no es el próximo paso."""
    assert business.derive_estado(_viaje(chofer=None, vehiculo=9)) == "pendiente"
    assert business.derive_estado(_viaje(chofer=7, vehiculo=None)) == "pendiente"


def test_derive_estado_con_asignacion_sin_sena_es_pendiente_sena() -> None:
    assert business.derive_estado(_viaje(pagos=[])) == "pendiente_sena"
    assert business.derive_estado(_viaje(pagos=[("sena", Decimal("10000"))])) == "pendiente_sena"


def test_derive_estado_con_sena_completa_no_inventa_la_confirmacion() -> None:
    """La etiqueta sigue el estado almacenado; confirmar es tarea de confirm_if_ready."""
    solicitud = _viaje(pagos=[("sena", Decimal("50000"))])

    assert business.derive_estado(solicitud) == "pendiente"

    solicitud.estado = "confirmada"
    assert business.derive_estado(solicitud) == "confirmada"


def test_derive_estado_respeta_estados_terminales() -> None:
    assert business.derive_estado(_viaje(estado="finalizada")) == "finalizada"
    assert business.derive_estado(_viaje(estado="cancelada")) == "cancelada"


def test_confirm_if_ready_no_actua_sin_asignacion_o_sin_sena() -> None:
    """Los casos incompletos salen antes de tocar la base (db None no se usa)."""
    sin_chofer = _viaje(chofer=None, pagos=[("sena", Decimal("50000"))])
    sin_sena = _viaje(pagos=[("sena", Decimal("10000"))])
    ya_confirmado = _viaje(estado="confirmada", pagos=[("sena", Decimal("50000"))])

    assert business.confirm_if_ready(None, sin_chofer) is None
    assert business.confirm_if_ready(None, sin_sena) is None
    assert business.confirm_if_ready(None, ya_confirmado) is None
    assert sin_chofer.estado == "pendiente"
    assert sin_sena.estado == "pendiente"


def test_pending_confirmation_exige_estado_asignacion_y_sena() -> None:
    assert business.pending_confirmation(_viaje(pagos=[("sena", Decimal("50000"))]))
    assert not business.pending_confirmation(
        _viaje(chofer=None, pagos=[("sena", Decimal("50000"))])
    )
    assert not business.pending_confirmation(
        _viaje(vehiculo=None, pagos=[("sena", Decimal("50000"))])
    )
    assert not business.pending_confirmation(_viaje(pagos=[("sena", Decimal("49999"))]))
    assert not business.pending_confirmation(
        _viaje(estado="confirmada", pagos=[("sena", Decimal("50000"))])
    )


def test_blocking_reason_ignora_viajes_incompletos() -> None:
    """Sin asignación o sin seña no hay bloqueo que reportar (no toca la base)."""
    assert (
        business.blocking_reason(None, _viaje(chofer=None, pagos=[("sena", Decimal("50000"))]))
        is None
    )
    assert business.blocking_reason(None, _viaje(pagos=[])) is None
