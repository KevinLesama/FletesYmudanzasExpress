"""Pruebas basicas: health, validacion y CRUD de solicitudes."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_list_driver(client: TestClient) -> None:
    payload = {"name": "Marcelo Rodríguez", "phone": "11 5551-9001", "status": "Activo"}
    created = client.post("/api/drivers", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["id"] == "MR"
    assert body["initials"] == "MR"

    listed = client.get("/api/drivers").json()
    assert any(d["id"] == "MR" for d in listed)


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
