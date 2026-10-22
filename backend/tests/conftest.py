"""Fixtures de pruebas: base de datos SQLite en memoria.

No se toca ninguna base real (Supabase ni PostgreSQL local). Cada test corre
contra un esquema creado y destruido por prueba.

Los endpoints exigen sesion, asi que los fixtures inyectan un `CurrentUser`
falso: `client` entra como administracion y `chofer_client` como chofer.
Para probar la validacion del token real esta `raw_client`, que no overridea
la dependencia de seguridad.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import CurrentUser, get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Payment, Request, RequestCargoItem, User, UserFactor, Vehicle  # noqa: F401

ADMIN_ID = "ADM-01"
DRIVER_ID = "JA"
OTHER_DRIVER_ID = "MR"
CLIENT_ID = "CLI-001"
VEHICLE_ID = "MOV-05"


def fake_user(user_id: str, role: str, name: str = "Usuario", email: str = "") -> CurrentUser:
    return CurrentUser(
        auth_id="00000000-0000-0000-0000-000000000000",
        email=email,
        user_id=user_id,
        role=role,
        name=name,
    )


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _db_override(db_session: Session):
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    return override_get_db


@pytest.fixture()
def raw_client(db_session: Session) -> Generator[TestClient, None, None]:
    """Cliente sin sesion: se usa para probar 401/403 de autenticacion."""
    app.dependency_overrides[get_db] = _db_override(db_session)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Cliente con sesion de administracion."""
    app.dependency_overrides[get_db] = _db_override(db_session)
    app.dependency_overrides[get_current_user] = lambda: fake_user(
        ADMIN_ID, "admin", "María Rodríguez", "admin@test.local"
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def chofer_client(db_session: Session) -> Generator[TestClient, None, None]:
    """Cliente con sesion de chofer (id JA)."""
    app.dependency_overrides[get_db] = _db_override(db_session)
    app.dependency_overrides[get_current_user] = lambda: fake_user(
        DRIVER_ID, "chofer", "Jorge Almada", "chofer@test.local"
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded(db_session: Session) -> dict[str, object]:
    """Datos minimos: un admin, un cliente, dos choferes y un vehiculo."""
    admin = User(
        id=ADMIN_ID,
        role="admin",
        name="María Rodríguez",
        phone="11 4000-0001",
        email="admin@test.local",
        initials="MR",
        status="Activo",
    )
    client_user = User(id=CLIENT_ID, role="cliente", name="Kevin", phone="11 3291-5140")
    driver = User(
        id=DRIVER_ID,
        role="chofer",
        initials="JA",
        name="Jorge Almada",
        phone="11 5550-6612",
        email="chofer@test.local",
        status="Activo",
        base_rate=58000,
        rate_per_km=800,
        rate_per_hour=10000,
    )
    driver.factors = [UserFactor(label="Espera", amount=3000, position=0)]
    other_driver = User(
        id=OTHER_DRIVER_ID,
        role="chofer",
        initials="MR",
        name="Marta Ríos",
        phone="11 5550-6613",
        email="marta@test.local",
        status="Activo",
    )
    vehicle = Vehicle(id=VEHICLE_ID, type="Camión mudancero", capacity_kg=3500, status="Disponible")
    db_session.add_all([admin, client_user, driver, other_driver, vehicle])
    db_session.commit()
    db_session.refresh(client_user)
    return {
        "admin_id": ADMIN_ID,
        "client_id": CLIENT_ID,
        "driver_id": DRIVER_ID,
        "other_driver_id": OTHER_DRIVER_ID,
        "vehicle_id": VEHICLE_ID,
    }
