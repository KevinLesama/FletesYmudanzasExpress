"""Fixtures de integracion contra PostgreSQL.

Nunca tocan la base de produccion. La suite solo corre cuando esta definida
``FEX_TEST_DATABASE_URL`` y, para evitar un accidente, se niega a recrear el
esquema si el nombre de la base no contiene la palabra ``test``.

El esquema no lo crea el ORM: se aplica ``backend/sql/schema.sql`` seguido de
``backend/sql/auth.sql``, que son la fuente de verdad (triggers, vistas y
constraints de exclusion incluidos). Cada prueba arranca con las tablas vacias
y las secuencias reiniciadas, asi los codigos FEX-#### son predecibles.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import pytest

ENV_VAR = "FEX_TEST_DATABASE_URL"

if not os.environ.get(ENV_VAR):
    pytest.skip(
        f"{ENV_VAR} no esta definida: se omiten las pruebas de PostgreSQL.",
        allow_module_level=True,
    )

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import Engine, make_url  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.core.security import get_current_user  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Usuario, Vehiculo  # noqa: E402

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"

TABLAS = "pagos, items_carga, solicitudes, vehiculos, usuarios"
SECUENCIA_CODIGOS = "solicitudes_codigo_seq"
CODIGO_INICIAL = 1001


def _url_de_prueba() -> str:
    """URL de la base de prueba, validando que sea descartable."""
    url = make_url(os.environ[ENV_VAR])
    nombre = (url.database or "").lower()
    if "test" not in nombre:
        raise RuntimeError(
            f"{ENV_VAR} apunta a la base '{url.database}'. Por seguridad, el "
            "nombre de la base de pruebas debe contener 'test'."
        )
    return url.render_as_string(hide_password=False)


def _crear_esquema(engine: Engine) -> None:
    """Recrea el esquema publico con los SQL del proyecto.

    Se usa el cursor del driver y no ``exec_driver_sql`` porque los archivos
    traen varios statements y signos ``%`` literales (comentarios y LIKE) que
    SQLAlchemy interpretaria como placeholders.
    """
    raw = engine.raw_connection()
    try:
        cursor = raw.cursor()
        cursor.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        for nombre in ("schema.sql", "auth.sql"):
            cursor.execute((SQL_DIR / nombre).read_text(encoding="utf-8"))
        raw.commit()
    finally:
        raw.close()


def _limpiar(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {TABLAS} RESTART IDENTITY CASCADE"))
        conn.execute(text(f"ALTER SEQUENCE {SECUENCIA_CODIGOS} RESTART WITH {CODIGO_INICIAL}"))
        conn.execute(
            text(
                "UPDATE configuracion_sistema "
                "SET margen_operativo_min = 30, margen_ganancia_pct = 50 WHERE id = 1"
            )
        )


@pytest.fixture(scope="session")
def pg_engine() -> Generator[Engine, None, None]:
    engine = create_engine(_url_de_prueba(), pool_pre_ping=True, future=True)
    _crear_esquema(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture()
def db_session(pg_engine: Engine) -> Generator[Session, None, None]:
    """Sesion limpia por prueba: mismas opciones que ``get_session_factory``."""
    _limpiar(pg_engine)
    factory = sessionmaker(bind=pg_engine, autoflush=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def seeded(db_session: Session) -> dict[str, int]:
    """Personas y rodado minimos: un admin, un cliente, un chofer y un vehiculo."""
    admin = Usuario(
        rol="administrador",
        nombre="Admin de prueba",
        telefono="11 5550-0001",
        email="admin@test.local",
    )
    cliente = Usuario(rol="cliente", nombre="Kevin", telefono="11 3291-5140")
    chofer = Usuario(
        rol="chofer",
        nombre="Jorge Almada",
        telefono="11 5550-6612",
        email="jorge@test.local",
        licencia="L-123",
        tarifa_base=58000,
        tarifa_por_km=800,
        tarifa_por_hora=10000,
    )
    db_session.add_all([admin, cliente, chofer])
    db_session.flush()

    vehiculo = Vehiculo(
        patente="MOV-05",
        tipo="Camion mudancero",
        capacidad_kg=3500,
        estado="disponible",
    )
    db_session.add(vehiculo)
    db_session.commit()

    return {
        "admin_id": admin.id,
        "client_id": cliente.id,
        "driver_id": chofer.id,
        "vehicle_id": vehiculo.id,
    }


@pytest.fixture()
def client(seeded: dict[str, int], db_session: Session) -> Generator[TestClient, None, None]:
    """Cliente HTTP autenticado como el admin de ``seeded``.

    La autenticacion real (JWT, roles, primer ingreso) se cubre en
    ``tests/pg/test_auth.py``; aca se reemplaza por una identidad fija que
    apunta a una fila real de ``usuarios`` (los pagos y auditorias guardan ese
    id).
    """

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "auth-admin-test",
        "email": "admin@test.local",
        "rol": "administrador",
        "usuario_id": seeded["admin_id"],
        "nombre": "Admin de prueba",
    }
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def solicitud_payload(seeded: dict[str, int]) -> dict[str, object]:
    """Solicitud valida en modo manual (sin geolocalizacion)."""
    return {
        "cliente_id": seeded["client_id"],
        "fecha": "2026-09-24",
        "hora_desde": "09:00",
        "hora_hasta": "11:00",
        "origen": {
            "direccion": "Armenia 1450",
            "barrio": "Palermo",
            "piso": "3",
            "ascensor": True,
        },
        "destino": {
            "direccion": "Ruiz Huidobro 2500",
            "barrio": "Saavedra",
            "piso": "1",
            "ascensor": False,
        },
        "items_carga": [{"descripcion": "Cajas", "cantidad": 5, "fragil": False}],
        "km_estimados": 12,
        "precio_final": 100000,
    }
