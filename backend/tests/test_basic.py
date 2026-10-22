"""Pruebas basicas: health, validacion y CRUD de solicitudes."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_list_chofer(client: TestClient) -> None:
    payload = {
        "role": "chofer",
        "name": "Marcelo Rodríguez",
        "phone": "11 5551-9001",
        "status": "Activo",
    }
    created = client.post("/api/users", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["id"] == "MR"
    assert body["initials"] == "MR"
    assert body["role"] == "chofer"

    listed = client.get("/api/users", params={"role": "chofer"}).json()
    assert any(u["id"] == "MR" for u in listed)


def test_create_client_is_not_duplicated(client: TestClient) -> None:
    payload = {"role": "cliente", "name": "Kevin", "phone": "11 3291-5140"}
    first = client.post("/api/users", json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["id"] == "CLI-001"

    again = client.post("/api/users", json=payload)
    assert again.status_code == 201
    assert again.json()["id"] == "CLI-001"

    listed = client.get("/api/users", params={"role": "cliente"}).json()
    assert len(listed) == 1


def test_create_vehicle_validation(client: TestClient) -> None:
    bad = client.post("/api/vehicles", json={"id": "MOV-09", "type": "Furgón", "capacity_kg": 0})
    assert bad.status_code == 422

    ok = client.post(
        "/api/vehicles",
        json={"id": "MOV-09", "type": "Furgón grande", "capacity_kg": 1500, "status": "Disponible"},
    )
    assert ok.status_code == 201
    assert ok.json()["id"] == "MOV-09"


def test_create_request_assigns_id(client: TestClient, seeded: dict) -> None:
    payload = {
        "client_id": seeded["client_id"],
        "date": "2026-09-24",
        "arrival_from": "09:00",
        "arrival_to": "11:00",
        "service_from": "11:00",
        "service_to": "13:00",
        "origin": {"address": "Armenia 1450", "barrio": "Palermo", "floor": "Piso 3", "elevator": True},
        "destination": {"address": "Ruiz Huidobro 2500", "barrio": "Saavedra", "floor": "Piso 1", "elevator": False},
        "cargo": {
            "items": [{"name": "Heladera", "units": 1}, {"name": "Cajas", "units": 10}],
            "approx_units": 12,
            "fragile": True,
            "notes": "Coordinar estacionamiento.",
        },
    }
    response = client.post("/api/requests", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] == "FEX-0001"
    assert body["client_name"] == "Kevin"
    assert body["client_id"] == "CLI-001"
    assert body["status"] == "Pendiente de revisión"
    assert len(body["cargo_items"]) == 2
    assert body["deposit_received"] == 0


def test_create_request_requires_client_info(client: TestClient) -> None:
    payload = {
        "date": "2026-09-24",
        "arrival_from": "09:00",
        "arrival_to": "11:00",
        "service_from": "11:00",
        "service_to": "13:00",
        "origin": {"address": "A", "barrio": "", "floor": "", "elevator": False},
        "destination": {"address": "B", "barrio": "", "floor": "", "elevator": False},
    }
    response = client.post("/api/requests", json=payload)
    assert response.status_code == 422


def test_not_found_request(client: TestClient) -> None:
    assert client.get("/api/requests/FEX-9999").status_code == 404


def test_payment_remito_roundtrip(client: TestClient, seeded: dict) -> None:
    payload = {
        "client_id": seeded["client_id"],
        "date": "2026-09-24",
        "arrival_from": "09:00",
        "arrival_to": "11:00",
        "service_from": "11:00",
        "service_to": "13:00",
        "origin": {"address": "A", "barrio": "", "floor": "", "elevator": False},
        "destination": {"address": "B", "barrio": "", "floor": "", "elevator": False},
    }
    created = client.post("/api/requests", json=payload).json()
    paid = client.post(
        f"/api/requests/{created['id']}/payments",
        json={
            "concept": "Seña",
            "method": "Efectivo",
            "received_by": "Chofer",
            "amount": 50000,
            "date": "2026-09-22",
        },
    )
    assert paid.status_code == 201, paid.text
    payment = paid.json()["payments"][0]
    assert payment["remito_data_url"] is None

    with_remito = client.put(
        f"/api/payments/{payment['id']}/remito",
        json={"name": "remito.jpg", "data_url": "data:image/jpeg;base64,AAA"},
    )
    assert with_remito.status_code == 200, with_remito.text
    assert with_remito.json()["remito_name"] == "remito.jpg"

    without = client.delete(f"/api/payments/{payment['id']}/remito")
    assert without.status_code == 200
    assert without.json()["remito_data_url"] is None
