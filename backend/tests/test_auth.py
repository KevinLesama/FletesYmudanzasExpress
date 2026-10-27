"""Pruebas de autenticacion y autorizacion por rol.

No tocan red: la validacion del JWT se mockea. El rol se resuelve contra la
tabla `usuarios`, que aca se crea a mano porque el ORM todavia mapea el
esquema viejo (la migracion del ORM es un PR aparte).
"""

from __future__ import annotations

from collections.abc import Generator

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import security
from app.core.security import get_current_user
from app.db.session import get_db
from app.main import app

USUARIOS_DDL = """
CREATE TABLE IF NOT EXISTS usuarios (
    id             integer PRIMARY KEY AUTOINCREMENT,
    auth_user_id   text,
    email          text,
    nombre         text NOT NULL,
    rol            text NOT NULL,
    activo         boolean NOT NULL DEFAULT 1
)
"""

# Misma definicion que `backend/sql/auth.sql`: el login resuelve contra la
# vista, no contra la tabla, para que los clientes queden afuera por diseno.
V_PERSONAL_DDL = """
CREATE VIEW IF NOT EXISTS v_personal AS
SELECT id, auth_user_id, rol, nombre, email, activo
  FROM usuarios
 WHERE rol IN ('administrador', 'chofer')
"""


class _FakeSettings:
    auth_configured = True
    supabase_url = "https://test.supabase.co"
    supabase_anon_key = "anon-key"
    service_role_configured = False


def _crear_usuario(
    db: Session,
    *,
    email: str = "admin@test.local",
    rol: str = "administrador",
    activo: bool = True,
    auth_user_id: str | None = None,
) -> int:
    db.execute(text(USUARIOS_DDL))
    db.execute(text(V_PERSONAL_DDL))
    db.execute(
        text(
            "INSERT INTO usuarios (auth_user_id, email, nombre, rol, activo) "
            "VALUES (:auth_id, :email, :nombre, :rol, :activo)"
        ),
        {
            "auth_id": auth_user_id,
            "email": email,
            "nombre": "Persona de prueba",
            "rol": rol,
            "activo": activo,
        },
    )
    db.commit()
    return int(db.execute(text("SELECT max(id) FROM usuarios")).scalar_one())


@pytest.fixture()
def auth_client(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setattr(security, "get_settings", lambda: _FakeSettings())
    # El ORM mapea el esquema viejo; `usuarios` y `v_personal` se crean a mano
    # para estas pruebas, igual que en `backend/sql/auth.sql`.
    db_session.execute(text(USUARIOS_DDL))
    db_session.execute(text(V_PERSONAL_DDL))
    db_session.commit()

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def _token_como(
    monkeypatch: pytest.MonkeyPatch, *, sub: str = "uuid-1", email: str = "admin@test.local"
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
    _token_como(monkeypatch, sub="uuid-fantasma", email="nadie@test.local")
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
    _token_como(monkeypatch, sub="uuid-chofer", email="chofer@test.local")
    response = auth_client.post(
        "/api/drivers",
        json={"name": "Chofer Nuevo", "phone": "11 0000-0000"},
        headers={"Authorization": "Bearer ok"},
    )
    assert response.status_code == 403, response.text


def test_administrador_puede_crear_chofer(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _crear_usuario(db_session)
    _token_como(monkeypatch)
    response = auth_client.post(
        "/api/drivers",
        json={"name": "Chofer Nuevo", "phone": "11 0000-0000"},
        headers={"Authorization": "Bearer ok"},
    )
    assert response.status_code == 201, response.text


def test_primer_ingreso_vincula_auth_user_id_por_email(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    usuario_id = _crear_usuario(db_session, auth_user_id=None)
    _token_como(monkeypatch, sub="uuid-nuevo")

    response = auth_client.get("/api/me", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 200
    body = response.json()
    assert body["rol"] == "administrador"
    assert body["id"] == "uuid-nuevo"

    vinculado = db_session.execute(
        text("SELECT auth_user_id FROM usuarios WHERE id = :id"), {"id": usuario_id}
    ).scalar_one()
    assert vinculado == "uuid-nuevo"


def test_me_devuelve_rol_y_nombre(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _crear_usuario(db_session, rol="chofer", email="chofer@test.local", auth_user_id="uuid-ch")
    _token_como(monkeypatch, sub="uuid-ch", email="chofer@test.local")
    response = auth_client.get("/api/me", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 200
    assert response.json() == {
        "id": "uuid-ch",
        "email": "chofer@test.local",
        "nombre": "Persona de prueba",
        "rol": "chofer",
    }


def test_rol_desconocido_no_es_personal(
    auth_client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un cliente con cuenta de Auth no puede entrar como personal."""
    _crear_usuario(db_session, email="cliente@test.local", rol="cliente")
    _token_como(monkeypatch, sub="uuid-cli", email="cliente@test.local")
    response = auth_client.get("/api/me", headers={"Authorization": "Bearer ok"})
    assert response.status_code == 403, response.text
