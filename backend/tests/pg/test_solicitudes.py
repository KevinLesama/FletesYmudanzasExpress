"""Reglas de agenda, seña y confirmacion ejercitadas contra PostgreSQL.

Estas pruebas describen el comportamiento ACTUAL del backend. La semantica de
reservas (blanda vs. firme) y el motor de disponibilidad se cambian en etapas
posteriores; aca solo se fija lo que hoy hace el sistema para detectar
regresiones.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Usuario


def _crear(client: TestClient, payload: dict, **overrides: object) -> dict:
    response = client.post("/api/requests", json={**payload, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def _asignar(client: TestClient, request_id: int, seeded: dict, **overrides: object) -> dict:
    payload = {
        "chofer_id": seeded["driver_id"],
        "vehiculo_id": seeded["vehicle_id"],
        **overrides,
    }
    response = client.patch(f"/api/requests/{request_id}", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def _cobrar(
    client: TestClient, request_id: int, monto: float, concepto: str = "sena"
) -> dict:
    response = client.post(
        f"/api/payments/requests/{request_id}/payments",
        json={
            "concepto": concepto,
            "metodo": "transferencia",
            "monto": monto,
            "fecha": "2026-09-22",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_asignar_recursos_cotiza_el_viaje(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)

    body = _asignar(client, viaje["id"], seeded)

    assert body["chofer_id"] == seeded["driver_id"]
    assert body["vehiculo_id"] == seeded["vehicle_id"]
    assert body["estado"] == "pendiente"
    # Con chofer asignado se recalcula la cotizacion: el precio acordado pasa a
    # ser el sugerido para esas tarifas.
    assert body["precio_final"] == body["precio_calculado"]
    assert body["sena_requerida"] == round(body["precio_final"] / 2, 2)


def test_confirmar_a_mano_sin_sena_esta_permitido(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    """Comportamiento actual: el backend no exige seña en la confirmacion manual.

    Se deja documentado tal como esta. Cambiarlo (o no) es una decision de
    negocio de la etapa de disponibilidad, no de esta red de seguridad.
    """
    viaje = _crear(client, solicitud_payload)

    body = _asignar(client, viaje["id"], seeded, estado="confirmada")

    assert body["estado"] == "confirmada"
    assert body["deposit_received"] == 0


def test_sena_completa_confirma_automaticamente(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    asignado = _asignar(client, viaje["id"], seeded)

    cobrado = _cobrar(client, viaje["id"], asignado["sena_requerida"])

    assert cobrado["auto_confirm_error"] is None
    assert cobrado["estado"] == "confirmada"
    assert cobrado["deposit_received"] == asignado["sena_requerida"]


def test_conflicto_de_chofer_bloquea_la_confirmacion(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    primero = _crear(client, solicitud_payload)
    # Solo un viaje CONFIRMADO bloquea la agenda. Un pendiente todavia no
    # reserva (la capa de advertencia blanda llega con el motor de
    # disponibilidad): por eso el primero se confirma antes de probar el choque.
    _asignar(client, primero["id"], seeded, estado="confirmada")

    segundo = _crear(
        client, solicitud_payload, hora_desde="10:00", hora_hasta="12:00"
    )
    choque = client.patch(
        f"/api/requests/{segundo['id']}",
        json={
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "estado": "confirmada",
        },
    )

    assert choque.status_code == 409, choque.text
    assert "chofer" in choque.json()["detail"].lower()

    sigue_pendiente = client.get(f"/api/requests/{segundo['id']}").json()
    assert sigue_pendiente["estado"] == "pendiente"
    assert sigue_pendiente["bloqueo_confirmacion"] is None


def test_conflicto_de_vehiculo_bloquea_la_confirmacion(
    client: TestClient, seeded: dict, solicitud_payload: dict, db_session: Session
) -> None:
    primero = _crear(client, solicitud_payload)
    # Solo un viaje confirmado bloquea el rodado (ver test del chofer).
    _asignar(client, primero["id"], seeded, estado="confirmada")

    otro_chofer = Usuario(
        rol="chofer",
        nombre="Otro Chofer",
        telefono="11 5550-7777",
        email="otro@test.local",
    )
    db_session.add(otro_chofer)
    db_session.commit()

    segundo = _crear(
        client, solicitud_payload, hora_desde="10:00", hora_hasta="12:00"
    )
    choque = client.patch(
        f"/api/requests/{segundo['id']}",
        json={
            "chofer_id": otro_chofer.id,
            "vehiculo_id": seeded["vehicle_id"],
            "estado": "confirmada",
        },
    )

    assert choque.status_code == 409, choque.text
    assert "vehículo" in choque.json()["detail"].lower()


def test_availability_informa_conflictos(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    # La consulta de disponibilidad solo reporta reservas firmes: el viaje ya
    # tiene que estar confirmado para que el horario cuente como ocupado.
    asignado = _asignar(client, viaje["id"], seeded, estado="confirmada")

    ocupado = client.get(
        "/api/availability",
        params={
            "fecha": solicitud_payload["fecha"],
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "10:00",
            "hora_hasta": "12:00",
        },
    )
    assert ocupado.status_code == 200, ocupado.text
    cuerpo = ocupado.json()
    assert cuerpo["driver_available"] is False
    assert cuerpo["vehicle_available"] is False
    assert any(asignado["codigo"] in aviso for aviso in cuerpo["conflicts"])

    libre = client.get(
        "/api/availability",
        params={
            "fecha": solicitud_payload["fecha"],
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "13:00",
            "hora_hasta": "15:00",
        },
    ).json()
    assert libre["driver_available"] is True
    assert libre["vehicle_available"] is True
    assert libre["conflicts"] == []


def test_cancelar_libera_el_horario(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    # Confirmado de verdad: si no, el horario no estaba bloqueado y la prueba
    # de liberacion no probaria nada.
    _asignar(client, viaje["id"], seeded, estado="confirmada")

    cancelado = client.patch(
        f"/api/requests/{viaje['id']}",
        json={"estado": "cancelada", "motivo_cancelacion": "Se arrepintio el cliente."},
    )
    assert cancelado.status_code == 200, cancelado.text
    assert cancelado.json()["estado"] == "cancelada"

    # El horario liberado se puede volver a asignar al mismo chofer y rodado.
    reemplazo = _crear(client, solicitud_payload)
    _asignar(client, reemplazo["id"], seeded)


def test_cobrar_mas_que_la_sena_se_rechaza(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    asignado = _asignar(client, viaje["id"], seeded)

    response = client.post(
        f"/api/payments/requests/{viaje['id']}/payments",
        json={
            "concepto": "sena",
            "metodo": "efectivo",
            "monto": asignado["sena_requerida"] + 1,
        },
    )

    assert response.status_code == 409, response.text
    assert "seña" in response.json()["detail"].lower()


def test_crear_solicitud_con_cliente_inexistente(client: TestClient, solicitud_payload: dict) -> None:
    response = client.post(
        "/api/requests", json={**solicitud_payload, "cliente_id": 999999}
    )

    assert response.status_code == 404, response.text


def test_login_de_cliente_exige_una_cuenta_existente(
    client: TestClient, seeded: dict
) -> None:
    encontrado = client.post(
        "/api/clients/login", json={"name": "Kevin", "phone": "11 3291-5140"}
    )
    assert encontrado.status_code == 200, encontrado.text
    assert encontrado.json()["id"] == seeded["client_id"]

    desconocido = client.post(
        "/api/clients/login", json={"name": "Kevin", "phone": "11 0000-0000"}
    )
    assert desconocido.status_code == 401
