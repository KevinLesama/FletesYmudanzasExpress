"""Fixtures de pruebas: base de datos SQLite en memoria.

No se toca ninguna base real (Supabase ni PostgreSQL local). Cada test corre
contra un esquema creado y destruido por prueba.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Client, Driver, DriverFactor, Vehicle, Request, RequestCargoItem, Payment, Incident  # noqa: F401


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


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    # Los tests de negocio no prueban autenticacion: entran como admin fake.
    # La autenticacion real se cubre en tests/test_auth.py.
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "test-admin",
        "email": "admin@test.local",
        "role": "admin",
    }
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded(db_session: Session) -> dict[str, object]:
    """Datos minimos: un cliente, un chofer y un vehiculo."""
    client = Client(name="Kevin", phone="11 3291-5140")
    driver = Driver(
        id="JA",
        initials="JA",
        name="Jorge Almada",
        phone="11 5550-6612",
        status="Activo",
        base_rate=58000,
        rate_per_km=800,
        rate_per_hour=10000,
    )
    driver.factors = [DriverFactor(label="Espera", amount=3000, position=0)]
    vehicle = Vehicle(id="MOV-05", type="Camión mudancero", capacity_kg=3500, status="Disponible")
    db_session.add_all([client, driver, vehicle])
    db_session.commit()
    db_session.refresh(client)
    return {"client_id": client.id, "driver_id": "JA", "vehicle_id": "MOV-05"}
