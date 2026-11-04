"""Autenticacion y autorizacion por rol contra PostgreSQL.

La validacion del JWT se reemplaza por claims fijos: no se toca Supabase Auth.
El rol y el perfil se resuelven contra `v_personal`, la vista real creada por
``backend/sql/auth.sql``.
"""

from __future__ import annotations

from collections.abc import Generator

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import security
from app.db.session import get_db
from app.main import app
from app.routers import api as api_module

# `usuarios.auth_user_id` es uuid: cualquier valor de prueba tiene que serlo.
AUTH_ADMIN = "11111111-1111-4111-8111-111111111111"
AUTH_CHOFER = "22222222-2222-4222-8222-222222222222"
AUTH_NUEVO = "33333333-3333-4333-8333-333333333333"
AUTH_PRIMER_INGRESO = "44444444-4444-4444-8444-444444444444"
AUTH_CLIENTE = "55555555-5555-4555-8555-555555555555"
AUTH_SIN_PERFIL = "66666666-6666-4666-8666-666666666666"


class _FakeSettings:
    auth_configured = True
    supabase_url = "https://test.supabase.co"
    supabase_anon_key = "anon-key"
    supabase_service_role_key = ""


@pytest.fixture()
def auth_client(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    monkeypatch.setattr(security, "get_settings", lambda: _FakeSettings())

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def _crear_usuario(
    db_session: Session,
    *,
    email: str = "admin@test.local",
    rol: str = "administrador",
    nombre: str = "Persona de prueba",
    activo: bool = True,
    auth_user_id: str | None = None,
) -> int:
    usuario_id = db_session.execute(
        text(
            "INSERT INTO usuarios (rol, nombre, telefono, email, activo, auth_user_id) "
            "VALUES (:rol, :nombre, :telefono, :email, :activo, :auth_user_id) "
            "RETURNING id"
        ),
        {
            "rol": rol,
            "nombre": nombre,
            "telefono": "11 5550-0002",
            "email": email,
            "activo": activo,
            "auth_user_id": auth_user_id,
        },
    ).scalar_one()
    db_session.commit()
    return int(usuario_id)


def _token_como(
    monkeypatch: pytest.MonkeyPatch,
    *,
    sub: str = AUTH_ADMIN,
    email: str = "admin@test.local",
) -> None:
    monkeypatch.setattr(
        security,
        "verify_access_token",
        lambda _token: {"sub": sub, "email": email},
    )


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


def test_usuario_sin_perfil_devuelve_403(
    auth_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _token_como(monkeypatch, sub=AUTH_SIN_PERFIL, email="nadie@test.local")

    response = auth_client.get("/api/drivers", headers={"Authorization": "Bearer ok"})

    assert response.status_code == 403, response.text
    assert "personal" in response.json()["detail"].lower()


def test_usuario_inactivo_devuelve_403(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _crear_usuario(db_session, activo=False)
    _token_como(monkeypatch)

    response = auth_client.get("/api/drivers", headers={"Authorization": "Bearer ok"})

    assert response.status_code == 403, response.text
    assert "deshabilitado" in response.json()["detail"].lower()


def test_chofer_no_puede_crear_chofer(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _crear_usuario(db_session, email="chofer@test.local", rol="chofer")
    _token_como(monkeypatch, sub=AUTH_CHOFER, email="chofer@test.local")

    response = auth_client.post(
        "/api/drivers",
        json={
            "nombre": "Chofer Nuevo",
            "telefono": "11 0000-0000",
            "email": "nuevo@test.local",
        },
        headers={"Authorization": "Bearer ok"},
    )

    assert response.status_code == 403, response.text


def test_administrador_puede_crear_chofer(
    auth_client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _crear_usuario(db_session)
    _token_como(monkeypatch)
    monkeypatch.setattr(
        api_module, "invite_user", lambda _email, _settings: AUTH_NUEVO
    )

    response = auth_client.post(
        "/api/drivers",
        json={
            "nombre": "Chofer Nuevo",
            "telefono": "11 0000-0000",
            "email": "nuevo@test.local",
        },
        headers={"Authorization": "Bearer ok"},
    )

    assert response.status_code == 201, response.text
    # El alta deja vinculada la cuenta de Supabase Auth.
    auth_user_id = db_session.execute(
        text("SELECT auth_user_id FROM usuarios WHERE email = :email"),
        {"email": "nuevo@test.local"},
    ).scalar_one()
    assert str(auth_user_id) == AUTH_NUEVO


def test_primer_ingreso_vincula_auth_user_id_por_email(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    usuario_id = _crear_usuario(db_session, auth_user_id=None)
    _token_como(monkeypatch, sub=AUTH_PRIMER_INGRESO)

    response = auth_client.get("/api/me", headers={"Authorization": "Bearer ok"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == usuario_id
    assert body["rol"] == "administrador"

    vinculado = db_session.execute(
        text("SELECT auth_user_id FROM usuarios WHERE id = :id"), {"id": usuario_id}
    ).scalar_one()
    assert str(vinculado) == AUTH_PRIMER_INGRESO


def test_me_devuelve_rol_y_nombre(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    usuario_id = _crear_usuario(
        db_session, rol="chofer", email="chofer@test.local", auth_user_id=AUTH_CHOFER
    )
    _token_como(monkeypatch, sub=AUTH_CHOFER, email="chofer@test.local")

    response = auth_client.get("/api/me", headers={"Authorization": "Bearer ok"})

    assert response.status_code == 200, response.text
    assert response.json() == {
        "id": usuario_id,
        "email": "chofer@test.local",
        "nombre": "Persona de prueba",
        "rol": "chofer",
    }


def test_cliente_con_cuenta_no_es_personal(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un cliente con email no entra como personal: `v_personal` lo excluye."""
    _crear_usuario(db_session, email="cliente@test.local", rol="cliente")
    _token_como(monkeypatch, sub=AUTH_CLIENTE, email="cliente@test.local")

    response = auth_client.get("/api/me", headers={"Authorization": "Bearer ok"})

    assert response.status_code == 403, response.text
