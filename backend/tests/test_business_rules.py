"""Pruebas de reglas de negocio: confirmacion con sena, conflictos de chofer/vehiculo."""

from __future__ import annotations

from fastapi.testclient import TestClient

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


def test_payment_accepts_cuenta_corriente(client: TestClient, seeded: dict) -> None:
    request = _create(client, seeded)
    paid = client.post(
        f"/api/requests/{request['id']}/payments",
        json={
            "concept": "Saldo",
            "method": "Cuenta corriente",
            "received_by": "Administración",
            "amount": 10000,
            "date": "2026-09-22",
        },
    )
    assert paid.status_code == 201, paid.text
    assert paid.json()["payments"][0]["method"] == "Cuenta corriente"


def test_payment_rejects_unknown_method(client: TestClient, seeded: dict) -> None:
    request = _create(client, seeded)
    bad = client.post(
        f"/api/requests/{request['id']}/payments",
        json={
            "concept": "Saldo",
            "method": "Dólares",
            "received_by": "Administración",
            "amount": 10000,
            "date": "2026-09-22",
        },
    )
    assert bad.status_code == 422


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
