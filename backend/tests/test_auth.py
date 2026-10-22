"""Pruebas de autenticacion y autorizacion por rol.

No tocan red: la validacion del JWT se mockea. El resto de los tests de negocio
entran como admin fake desde `conftest.client`.
"""

from __future__ import annotations

from collections.abc import Generator

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import security
from app.core.security import get_current_user
from app.db.session import get_db
from app.main import app


class _FakeSettings:
    auth_configured = True
    supabase_url = "https://test.supabase.co"
    supabase_anon_key = "anon-key"
    service_role_configured = False


@pytest.fixture()
def auth_client(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setattr(security, "get_settings", lambda: _FakeSettings())

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_sin_header_devuelve_401(auth_client: TestClient) -> None:
    response = auth_client.get("/api/drivers")
    assert response.status_code == 401
    assert "token" in response.json()["detail"].lower()


def test_token_invalido_devuelve_401(
    auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(_token: str) -> dict[str, object]:
        raise jwt.InvalidTokenError("firma invalida")

    monkeypatch.setattr(security, "verify_access_token", broken)
    response = auth_client.get("/api/drivers", headers={"Authorization": "Bearer roto"})
    assert response.status_code == 401


def test_rol_driver_no_puede_crear_chofer(auth_client: TestClient) -> None:
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u-driver",
        "email": "chofer@test.local",
        "role": "driver",
    }
    response = auth_client.post(
        "/api/drivers", json={"name": "Chofer Nuevo", "phone": "11 0000-0000"}
    )
    assert response.status_code == 403


def test_rol_admin_puede_crear_chofer(auth_client: TestClient) -> None:
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u-admin",
        "email": "admin@test.local",
        "role": "admin",
    }
    response = auth_client.post(
        "/api/drivers", json={"name": "Chofer Nuevo", "phone": "11 0000-0000"}
    )
    assert response.status_code == 201


def test_rol_desconocido_cae_en_driver() -> None:
    assert security._role_of({}) == "driver"
    assert security._role_of({"app_metadata": {"role": "root"}}) == "driver"
    assert security._role_of({"app_metadata": {"role": "coordinator"}}) == "coordinator"


def test_fallback_user_endpoint_usa_id_y_app_metadata(
    auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """El fallback /auth/v1/user devuelve `id` (no `sub`) y app_metadata."""
    monkeypatch.setattr(
        security,
        "verify_access_token",
        lambda _token: {"id": "uuid-1", "email": "a@b.c", "app_metadata": {"role": "admin"}},
    )
    response = auth_client.get("/api/drivers", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 200
