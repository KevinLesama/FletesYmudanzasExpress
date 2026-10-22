"""Pruebas de autenticacion y autorizacion por rol.

No tocan red: la validacion del JWT se mockea. El resto de los tests de negocio
entran con una sesion falsa (ver conftest).
"""

from __future__ import annotations

import uuid
from datetime import date, time

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import security
from app.models import Request

AUTH_UUID = "11111111-1111-1111-1111-111111111111"


class _FakeSettings:
    auth_configured = True
    supabase_url = "https://test.supabase.co"
    supabase_anon_key = "anon-key"
    service_role_configured = False


@pytest.fixture()
def auth_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    """La API queda como si SUPABASE_URL / SUPABASE_ANON_KEY estuvieran seteadas."""
    monkeypatch.setattr(security, "get_settings", lambda: _FakeSettings())


def _make_request(request_id: str, driver_id: str | None, client_id: str) -> Request:
    return Request(
        id=request_id,
        client_id=client_id,
        client_name="Kevin",
        phone="11 3291-5140",
        status="Confirmada",
        date=date(2026, 9, 24),
        arrival_from=time(9, 0),
        arrival_to=time(9, 30),
        service_from=time(10, 0),
        service_to=time(12, 0),
        origin_address="Calle 1 123",
        origin_barrio="Palermo",
        origin_floor="3",
        origin_elevator=False,
        destination_address="Av. Siempreviva 742",
        destination_barrio="Recoleta",
        destination_floor="5",
        destination_elevator=True,
        cargo_approx_units=10,
        cargo_fragile=False,
        cargo_notes="",
        driver_id=driver_id,
        price=80000,
        deposit_required=20000,
    )


# --------------------------------------------------------------------------- #
# Token
# --------------------------------------------------------------------------- #
def test_sin_header_devuelve_401(raw_client: TestClient, auth_ready: None) -> None:
    response = raw_client.get("/api/users")
    assert response.status_code == 401
    assert "token" in response.json()["detail"].lower()


def test_token_invalido_devuelve_401(
    raw_client: TestClient, auth_ready: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(_token: str) -> dict[str, object]:
        raise jwt.InvalidTokenError("firma invalida")

    monkeypatch.setattr(security, "verify_access_token", broken)
    response = raw_client.get("/api/users", headers={"Authorization": "Bearer roto"})
    assert response.status_code == 401


def test_usuario_no_vinculado_devuelve_403(
    raw_client: TestClient, auth_ready: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        security,
        "verify_access_token",
        lambda _token: {"sub": AUTH_UUID, "email": "nadie@test.local"},
    )
    response = raw_client.get("/api/users", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 403
    assert "vinculada" in response.json()["detail"].lower()


def test_primer_ingreso_vincula_la_cuenta_por_email(
    raw_client: TestClient,
    seeded: dict[str, object],
    db_session: Session,
    auth_ready: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """El chofer se crea en la app con un email; al loguearse, la cuenta de
    Supabase con ese mismo email queda vinculada (auth_user_id)."""
    monkeypatch.setattr(
        security,
        "verify_access_token",
        lambda _token: {"sub": AUTH_UUID, "email": "chofer@test.local"},
    )
    response = raw_client.get("/api/auth/me", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seeded["driver_id"]
    assert body["role"] == "chofer"

    from app.models import User

    user = db_session.get(User, seeded["driver_id"])
    assert user is not None
    assert user.auth_user_id == uuid.UUID(AUTH_UUID)


def test_usuario_inactivo_no_puede_entrar(
    raw_client: TestClient,
    seeded: dict[str, object],
    db_session: Session,
    auth_ready: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models import User

    user = db_session.get(User, seeded["driver_id"])
    assert user is not None
    user.status = "Inactivo"
    db_session.commit()

    monkeypatch.setattr(
        security,
        "verify_access_token",
        lambda _token: {"sub": AUTH_UUID, "email": "chofer@test.local"},
    )
    response = raw_client.get("/api/auth/me", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 403


def test_auth_me_devuelve_el_usuario_de_la_app(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    response = chofer_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["id"] == seeded["driver_id"]
    assert response.json()["role"] == "chofer"


# --------------------------------------------------------------------------- #
# Roles
# --------------------------------------------------------------------------- #
def test_rol_chofer_no_puede_crear_usuario(chofer_client: TestClient) -> None:
    response = chofer_client.post(
        "/api/users", json={"role": "chofer", "name": "Chofer Nuevo", "phone": "11 0000-0000"}
    )
    assert response.status_code == 403


def test_rol_chofer_no_puede_listar_usuarios(chofer_client: TestClient) -> None:
    assert chofer_client.get("/api/users").status_code == 403


def test_rol_admin_puede_crear_chofer(client: TestClient) -> None:
    response = client.post(
        "/api/users", json={"role": "chofer", "name": "Chofer Nuevo", "phone": "11 0000-0000"}
    )
    assert response.status_code == 201


def test_chofer_solo_ve_sus_viajes(
    chofer_client: TestClient, seeded: dict[str, object], db_session: Session
) -> None:
    db_session.add_all(
        [
            _make_request("FEX-1", seeded["driver_id"], seeded["client_id"]),
            _make_request("FEX-2", seeded["other_driver_id"], seeded["client_id"]),
        ]
    )
    db_session.commit()

    response = chofer_client.get("/api/requests")
    assert response.status_code == 200
    ids = [r["id"] for r in response.json()]
    assert ids == ["FEX-1"]


def test_chofer_no_puede_ver_un_viaje_ajeno(
    chofer_client: TestClient, seeded: dict[str, object], db_session: Session
) -> None:
    db_session.add(_make_request("FEX-2", seeded["other_driver_id"], seeded["client_id"]))
    db_session.commit()

    response = chofer_client.get("/api/requests/FEX-2")
    assert response.status_code == 403


def test_admin_ve_todos_los_viajes(
    client: TestClient, seeded: dict[str, object], db_session: Session
) -> None:
    db_session.add_all(
        [
            _make_request("FEX-1", seeded["driver_id"], seeded["client_id"]),
            _make_request("FEX-2", seeded["other_driver_id"], seeded["client_id"]),
        ]
    )
    db_session.commit()

    response = client.get("/api/requests")
    assert response.status_code == 200
    assert len(response.json()) == 2


# --------------------------------------------------------------------------- #
# Chofer sobre su propio usuario
# --------------------------------------------------------------------------- #
def test_chofer_puede_editar_sus_tarifas(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    response = chofer_client.put(
        f"/api/users/{seeded['driver_id']}/rates",
        json={"base_rate": 60000, "rate_per_km": 900, "rate_per_hour": 11000, "factors": []},
    )
    assert response.status_code == 200
    assert response.json()["base_rate"] == 60000


def test_chofer_no_puede_editar_tarifas_de_otro(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    response = chofer_client.put(
        f"/api/users/{seeded['other_driver_id']}/rates",
        json={"base_rate": 1, "rate_per_km": 1, "rate_per_hour": 1, "factors": []},
    )
    assert response.status_code == 403


def test_chofer_no_puede_darse_de_baja_a_si_mismo(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    response = chofer_client.patch(
        f"/api/users/{seeded['driver_id']}", json={"status": "Inactivo"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Activo"


def test_admin_puede_dar_de_baja_a_un_chofer(
    client: TestClient, seeded: dict[str, object]
) -> None:
    response = client.patch(f"/api/users/{seeded['driver_id']}", json={"status": "Inactivo"})
    assert response.status_code == 200
    assert response.json()["status"] == "Inactivo"


def test_admin_nuevo_recibe_id_numerado(
    client: TestClient, seeded: dict[str, object]
) -> None:
    """Los admins siguen la convención ADM-01, ADM-02, ..."""
    response = client.post(
        "/api/users", json={"role": "admin", "name": "Otro Admin", "phone": "11 0000-0001"}
    )
    assert response.status_code == 201
    assert response.json()["id"] == "ADM-02"


# --------------------------------------------------------------------------- #
# Chofer: perfil propio y lectura de la flota
# --------------------------------------------------------------------------- #
def test_chofer_puede_ver_su_propio_perfil(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    response = chofer_client.get(f"/api/users/{seeded['driver_id']}")
    assert response.status_code == 200
    assert response.json()["id"] == seeded["driver_id"]
    assert response.json()["base_rate"] == 58000


def test_chofer_no_puede_ver_el_perfil_de_otro(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    response = chofer_client.get(f"/api/users/{seeded['other_driver_id']}")
    assert response.status_code == 403


def test_chofer_puede_ver_los_vehiculos(
    chofer_client: TestClient, seeded: dict[str, object]
) -> None:
    """El portal del chofer muestra el vehiculo asignado: puede leer la flota."""
    response = chofer_client.get("/api/vehicles")
    assert response.status_code == 200
    assert [v["id"] for v in response.json()] == [seeded["vehicle_id"]]


def test_chofer_no_puede_crear_vehiculos(chofer_client: TestClient) -> None:
    response = chofer_client.post(
        "/api/vehicles", json={"id": "MOV-09", "type": "Furgon", "capacity_kg": 1200}
    )
    assert response.status_code == 403
