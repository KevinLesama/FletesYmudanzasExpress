"""CRUD basico contra PostgreSQL: choferes, vehiculos y solicitudes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.routers import api as api_module

pytestmark = pytest.mark.pg

# `usuarios.auth_user_id` es uuid: el valor simulado tambien tiene que serlo.
AUTH_INVITADO = "77777777-7777-4777-8777-777777777777"


@pytest.fixture()
def sin_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    """El alta de choferes invita por Supabase Auth: aca no se toca la red."""

    monkeypatch.setattr(api_module, "invite_user", lambda _email, _settings: AUTH_INVITADO)
    monkeypatch.setattr(api_module, "delete_user", lambda _auth_id, _settings: None)


def test_create_and_list_driver(client: TestClient, sin_supabase: None) -> None:
    payload = {
        "nombre": "Marcelo Rodriguez",
        "telefono": "11 5551-9001",
        "email": "Marcelo@Test.com",
        "licencia": "L-9001",
        "tarifa_base": 50000,
    }

    created = client.post("/api/drivers", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["nombre"] == "Marcelo Rodriguez"
    # El backend normaliza el email y lo usa para invitar en Supabase Auth.
    assert body["email"] == "marcelo@test.com"
    assert body["tarifa_base"] == 50000
    assert isinstance(body["id"], int)

    listed = client.get("/api/drivers").json()
    assert any(d["id"] == body["id"] for d in listed)


def test_create_driver_rejects_duplicate_email(
    client: TestClient, seeded: dict[str, int], sin_supabase: None
) -> None:
    payload = {
        "nombre": "Otro Chofer",
        "telefono": "11 5551-9002",
        "email": "JORGE@test.local",
    }

    response = client.post("/api/drivers", json=payload)

    assert response.status_code == 409, response.text
    assert "email" in response.json()["detail"].lower()


def test_create_driver_requires_email(client: TestClient, sin_supabase: None) -> None:
    """ck_usuarios_email_personal: el personal no puede quedar sin email."""
    response = client.post(
        "/api/drivers",
        json={"nombre": "Sin Email", "telefono": "11 5551-9003"},
    )

    assert response.status_code == 422, response.text


def test_create_vehicle_validates_capacity(client: TestClient) -> None:
    bad = client.post(
        "/api/vehicles",
        json={"patente": "MOV-09", "tipo": "Furgon", "capacidad_kg": 0},
    )
    assert bad.status_code == 422, bad.text

    created = client.post(
        "/api/vehicles",
        json={"patente": "MOV-09", "tipo": "Furgon", "capacidad_kg": 1200},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["estado"] == "disponible"

    fetched = client.get(f"/api/vehicles/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["patente"] == "MOV-09"


def test_create_and_get_request(client: TestClient, solicitud_payload: dict) -> None:
    created = client.post("/api/requests", json=solicitud_payload)

    assert created.status_code == 201, created.text
    body = created.json()
    assert body["codigo"] == "FEX-1001"
    assert body["estado"] == "pendiente"
    assert body["estado_visible"] == "pendiente"
    assert body["origen_direccion"] == "Armenia 1450"
    assert body["items_carga"][0]["descripcion"] == "Cajas"
    assert body["sena_requerida"] == 50000
    assert body["bloqueo_confirmacion"] is None

    fetched = client.get(f"/api/requests/{body['codigo']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


def test_list_requests_filters_by_date(
    client: TestClient, solicitud_payload: dict
) -> None:
    client.post("/api/requests", json=solicitud_payload)
    client.post(
        "/api/requests",
        json={**solicitud_payload, "fecha": "2026-09-25", "hora_desde": "14:00", "hora_hasta": "16:00"},
    )

    mismo_dia = client.get("/api/requests", params={"fecha": "2026-09-25"}).json()
    todos = client.get("/api/requests").json()

    assert [r["fecha"] for r in mismo_dia] == ["2026-09-25"]
    assert len(todos) == 2


def test_public_request_requires_contact(
    client: TestClient, solicitud_payload: dict
) -> None:
    payload = {key: value for key, value in solicitud_payload.items() if key != "cliente_id"}

    missing = client.post("/api/public/requests", json=payload)
    assert missing.status_code == 422, missing.text

    created = client.post(
        "/api/public/requests",
        json={**payload, "contacto_nombre": "Ana", "contacto_telefono": "11 4444-5555"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["cliente_id"] is None
