"""Reglas de agenda, seña y confirmación ejercitadas contra PostgreSQL."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.routers import api as api_router
from app.models import Solicitud, Usuario
from app.services.scraping.schemas import GeoResult, GeoStatus, Route


def test_ajustes_operativos_son_admin_y_persisten(
    client: TestClient,
) -> None:
    initial = client.get("/api/settings/system")
    assert initial.status_code == 200, initial.text
    assert initial.json() == {
        "margen_operativo_min": 30,
        "margen_ganancia_pct": 50,
    }

    updated = client.put(
        "/api/settings/system",
        json={"margen_operativo_min": 45, "margen_ganancia_pct": 65},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json() == {
        "margen_operativo_min": 45,
        "margen_ganancia_pct": 65,
    }

    invalid = client.put(
        "/api/settings/system",
        json={"margen_operativo_min": 15, "margen_ganancia_pct": 65},
    )
    assert invalid.status_code == 422


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


def _planificar(
    client: TestClient,
    request_id: int,
    seeded: dict,
    *,
    hora_desde: str = "09:00",
    hora_hasta: str = "11:00",
    carga_min: int = 60,
    descarga_min: int = 60,
) -> dict:
    return _asignar(
        client,
        request_id,
        seeded,
        hora_desde=hora_desde,
        hora_hasta=hora_hasta,
        carga_min=carga_min,
        descarga_min=descarga_min,
    )


def _confirmar_con_sena(
    client: TestClient, request_id: int, seeded: dict, **plan: object
) -> dict:
    asignado = _planificar(client, request_id, seeded, **plan)
    cobrado = _cobrar(client, request_id, asignado["sena_requerida"])
    assert cobrado["auto_confirm_error"] is None
    return cobrado


def test_asignar_recursos_cotiza_el_viaje(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)

    body = _asignar(client, viaje["id"], seeded)

    assert body["chofer_id"] == seeded["driver_id"]
    assert body["vehiculo_id"] == seeded["vehicle_id"]
    assert body["estado"] == "pendiente"
    assert body["carga_min"] is None
    assert body["descarga_min"] is None
    assert body["hora_hasta"] is None
    # Con chofer asignado se recalcula la cotizacion: el precio acordado pasa a
    # ser el sugerido para esas tarifas.
    assert body["precio_final"] == body["precio_calculado"]
    assert body["sena_requerida"] == round(body["precio_final"] / 2, 2)


def test_confirmar_a_mano_sin_sena_se_rechaza(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    """Una planificación completa no se confirma manualmente sin cobrar la seña."""
    viaje = _crear(client, solicitud_payload)

    _planificar(client, viaje["id"], seeded)
    response = client.patch(
        f"/api/requests/{viaje['id']}", json={"estado": "confirmada"}
    )

    assert response.status_code == 409, response.text
    assert "seña" in response.json()["detail"].lower()


def test_sena_completa_confirma_automaticamente(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    asignado = _planificar(client, viaje["id"], seeded)

    cobrado = _cobrar(client, viaje["id"], asignado["sena_requerida"])

    assert cobrado["auto_confirm_error"] is None
    assert cobrado["estado"] == "confirmada"
    assert cobrado["deposit_received"] == asignado["sena_requerida"]


def test_conflicto_de_chofer_bloquea_la_confirmacion(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    primero = _crear(client, solicitud_payload)
    # Una reserva pendiente solo advierte; una confirmada bloquea.
    _confirmar_con_sena(client, primero["id"], seeded)

    segundo = _crear(
        client, solicitud_payload, hora_desde="10:00", hora_hasta="12:00"
    )
    asignado = _planificar(
        client, segundo["id"], seeded, hora_desde="10:00", hora_hasta="12:00"
    )
    _cobrar(client, segundo["id"], asignado["sena_requerida"])
    choque = client.patch(f"/api/requests/{segundo['id']}", json={"estado": "confirmada"})

    assert choque.status_code == 409, choque.text
    assert "chofer" in choque.json()["detail"].lower()

    sigue_pendiente = client.get(f"/api/requests/{segundo['id']}").json()
    assert sigue_pendiente["estado"] == "pendiente"
    assert sigue_pendiente["bloqueo_confirmacion"] is None


def test_conflicto_de_vehiculo_bloquea_la_confirmacion(
    client: TestClient, seeded: dict, solicitud_payload: dict, db_session: Session
) -> None:
    primero = _crear(client, solicitud_payload)
    _confirmar_con_sena(client, primero["id"], seeded)

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
    asignado = _planificar(
        client,
        segundo["id"],
        {"driver_id": otro_chofer.id, "vehicle_id": seeded["vehicle_id"]},
        hora_desde="10:00",
        hora_hasta="12:00",
    )
    _cobrar(client, segundo["id"], asignado["sena_requerida"])
    choque = client.patch(f"/api/requests/{segundo['id']}", json={"estado": "confirmada"})

    assert choque.status_code == 409, choque.text
    assert "vehículo" in choque.json()["detail"].lower()


def test_descarga_y_margen_operativo_bloquean_la_confirmacion(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    primero = _crear(client, solicitud_payload, descarga_min=90)
    _confirmar_con_sena(client, primero["id"], seeded, descarga_min=90)

    segundo = _crear(
        client,
        solicitud_payload,
        hora_desde="12:45",
        hora_hasta="14:45",
    )
    asignado = _planificar(
        client, segundo["id"], seeded, hora_desde="12:45", hora_hasta="14:45"
    )
    _cobrar(client, segundo["id"], asignado["sena_requerida"])
    choque = client.patch(f"/api/requests/{segundo['id']}", json={"estado": "confirmada"})

    assert choque.status_code == 409, choque.text
    assert "chofer" in choque.json()["detail"].lower()


def test_descarga_admite_minutos_personalizados(
    client: TestClient, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload, descarga_min=47)

    assert viaje["descarga_min"] == 47


def test_hora_llegada_manual_no_se_reemplaza_al_editar_carga(
    client: TestClient, db_session: Session, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    solicitud = db_session.get(Solicitud, viaje["id"])
    assert solicitud is not None
    solicitud.duracion_ida_min = 45
    db_session.commit()

    response = client.patch(
        f"/api/requests/{viaje['id']}",
        json={
            "hora_desde": "09:30",
            "hora_hasta": "12:30",
            "carga_min": 90,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["hora_hasta"] == "12:30:00"



def test_availability_informa_conflictos(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    asignado = _confirmar_con_sena(client, viaje["id"], seeded)

    ocupado = client.get(
        "/api/availability",
        params={
            "fecha": solicitud_payload["fecha"],
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "10:00",
            "hora_hasta": "12:00",
            "carga_min": 60,
            "descarga_min": 60,
        },
    )
    assert ocupado.status_code == 200, ocupado.text
    cuerpo = ocupado.json()
    assert cuerpo["driver_available"] is False
    assert cuerpo["vehicle_available"] is False
    assert any(asignado["codigo"] in aviso for aviso in cuerpo["conflicts"])

    candidato = _crear(
        client, solicitud_payload, hora_desde="10:00", hora_hasta="12:00"
    )
    solo_chofer = client.get(
        "/api/availability",
        params={
            "fecha": solicitud_payload["fecha"],
            "chofer_id": seeded["driver_id"],
            "hora_desde": "10:00",
            "hora_hasta": "12:00",
            "descarga_min": 60,
            "exclude": candidato["codigo"],
        },
    )
    assert solo_chofer.status_code == 200, solo_chofer.text
    assert solo_chofer.json()["driver_available"] is False

    libre = client.get(
        "/api/availability",
        params={
            "fecha": solicitud_payload["fecha"],
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "13:00",
            "hora_hasta": "15:00",
            "descarga_min": 60,
        },
    ).json()
    assert libre["driver_available"] is True
    assert libre["vehicle_available"] is True
    assert libre["conflicts"] == []


def test_route_estimate_backfills_missing_route_duration(
    client: TestClient,
    db_session: Session,
    seeded: dict,
    solicitud_payload: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    viaje = _crear(client, solicitud_payload)
    solicitud = db_session.get(Solicitud, viaje["id"])
    assert solicitud is not None
    solicitud.origen_lat = -34.6037
    solicitud.origen_lng = -58.3816
    solicitud.destino_lat = -34.6083
    solicitud.destino_lng = -58.3702
    db_session.commit()

    class _Geo:
        def route(self, _origin, _destination, departure_time=None) -> GeoResult:
            return GeoResult(
                GeoStatus.OK,
                Route(distance_km=12, duration_min=42, provider="test"),
            )

    monkeypatch.setattr(api_router, "get_geo_service", lambda: _Geo())

    response = client.post(f"/api/requests/{viaje['id']}/route-estimate")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["duracion_ida_min"] == 42
    assert body["duracion_vuelta_min"] == 42
    assert body["km_estimados"] == 12
    assert body["km_vuelta"] == 12
    assert body["km_total"] == 24
    assert body["horas_estimadas"] == 1.4


def test_route_estimate_requires_saved_coordinates(
    client: TestClient, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)

    response = client.post(f"/api/requests/{viaje['id']}/route-estimate")

    assert response.status_code == 409
    assert "coordenadas" in response.json()["detail"].lower()


def test_availability_options_checks_conflicts_without_load_minutes(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    confirmado = _crear(client, solicitud_payload)
    _confirmar_con_sena(client, confirmado["id"], seeded)
    candidato = _crear(client, solicitud_payload)

    response = client.get(
        "/api/availability/options",
        params={
            "fecha": solicitud_payload["fecha"],
            "hora_desde": "10:00",
            "hora_hasta": "12:00",
            "carga_min": 60,
            "descarga_min": 60,
            "exclude": candidato["codigo"],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schedule_verified"] is True
    assert body["drivers"] == [
        {"resource_id": seeded["driver_id"], "blocked": True, "verified": True, "warnings": []}
    ]
    assert body["vehicles"] == [
        {"resource_id": seeded["vehicle_id"], "blocked": True, "verified": True, "warnings": []}
    ]


def test_availability_options_partial_schedule_does_not_claim_current_conflicts(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    confirmado = _crear(client, solicitud_payload)
    _confirmar_con_sena(client, confirmado["id"], seeded)
    candidato = _crear(client, solicitud_payload)

    response = client.get(
        "/api/availability/options",
        params={
            "fecha": solicitud_payload["fecha"],
            "hora_desde": "10:00",
            "exclude": candidato["codigo"],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schedule_verified"] is False
    assert body["drivers"][0]["blocked"] is False
    assert body["vehicles"][0]["blocked"] is False
    assert body["drivers"][0]["warnings"] == []
    assert body["vehicles"][0]["warnings"] == []


def test_availability_options_partial_schedule_does_not_warn_for_later_reservation(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    confirmado = _crear(client, solicitud_payload)
    _confirmar_con_sena(client, confirmado["id"], seeded)
    candidato = _crear(client, solicitud_payload)

    response = client.get(
        "/api/availability/options",
        params={
            "fecha": solicitud_payload["fecha"],
            "hora_desde": "08:00",
            "exclude": candidato["codigo"],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schedule_verified"] is False
    assert body["drivers"][0]["blocked"] is False
    assert body["vehicles"][0]["blocked"] is False
    assert body["drivers"][0]["warnings"] == []
    assert body["vehicles"][0]["warnings"] == []


def test_planificacion_pendiente_rechaza_solapamiento_confirmado(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    confirmado = _crear(client, solicitud_payload)
    _confirmar_con_sena(client, confirmado["id"], seeded)
    candidato = _crear(client, solicitud_payload)

    response = client.patch(
        f"/api/requests/{candidato['id']}",
        json={
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "10:00",
            "hora_hasta": "12:00",
            "descarga_min": 60,
        },
    )

    assert response.status_code == 409
    assert "solapa" in response.json()["detail"].lower()


def test_planificacion_pendiente_advierte_otro_pendiente(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    primero = _crear(client, solicitud_payload)
    _planificar(client, primero["id"], seeded)
    segundo = _crear(client, solicitud_payload)

    response = client.patch(
        f"/api/requests/{segundo['id']}",
        json={
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "10:00",
            "hora_hasta": "12:00",
            "carga_min": 60,
            "descarga_min": 60,
        },
    )

    assert response.status_code == 200, response.text
    warnings = response.json()["availability_warnings"]
    assert any(primero["codigo"] in warning for warning in warnings)


def test_cancelar_libera_el_horario(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    viaje = _crear(client, solicitud_payload)
    _confirmar_con_sena(client, viaje["id"], seeded)

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
    asignado = _planificar(client, viaje["id"], seeded)

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
