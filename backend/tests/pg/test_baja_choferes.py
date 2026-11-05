"""Baja logica de choferes.

`usuarios` no admite DELETE (trigger `tr_usuarios_sin_borrar`) y
`solicitudes.chofer_id` es ON DELETE RESTRICT: la unica baja posible es
`usuarios.activo = false`. Esta suite cubre el guard que impide dejar viajes
confirmados por delante sin responsable.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient


def _fecha(dias: int) -> str:
    return (date.today() + timedelta(days=dias)).isoformat()


def _baja(client: TestClient, driver_id: int) -> object:
    return client.patch(f"/api/drivers/{driver_id}", json={"activo": False})


def _confirmar_viaje(
    client: TestClient, payload: dict, seeded: dict, fecha: str
) -> dict:
    creado = client.post("/api/requests", json={**payload, "fecha": fecha})
    assert creado.status_code == 201, creado.text
    viaje = creado.json()

    planificado = client.patch(
        f"/api/requests/{viaje['id']}",
        json={
            "chofer_id": seeded["driver_id"],
            "vehiculo_id": seeded["vehicle_id"],
            "hora_desde": "09:00",
            "hora_hasta": "11:00",
            "carga_min": 60,
            "descarga_min": 60,
        },
    )
    assert planificado.status_code == 200, planificado.text

    cobro = client.post(
        f"/api/payments/requests/{viaje['id']}/payments",
        json={
            "concepto": "sena",
            "metodo": "transferencia",
            "monto": planificado.json()["sena_requerida"],
            "fecha": fecha,
        },
    )
    assert cobro.status_code == 201, cobro.text
    confirmado = cobro.json()
    assert confirmado["estado"] == "confirmada", confirmado
    return confirmado


def test_baja_de_chofer_sin_viajes_lo_deja_inactivo(
    client: TestClient, seeded: dict
) -> None:
    response = _baja(client, seeded["driver_id"])

    assert response.status_code == 200, response.text
    assert response.json()["activo"] is False


def test_baja_de_chofer_con_viaje_confirmado_futuro_se_bloquea(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    _confirmar_viaje(client, solicitud_payload, seeded, _fecha(3))

    response = _baja(client, seeded["driver_id"])

    assert response.status_code == 409, response.text
    assert "viaje(s) confirmado(s)" in response.json()["detail"]
    # El guard corre antes de aplicar el payload: el chofer sigue operativo.
    sigue = client.get(f"/api/drivers/{seeded['driver_id']}").json()
    assert sigue["activo"] is True


def test_baja_de_chofer_con_viaje_confirmado_pasado_se_permite(
    client: TestClient, seeded: dict, solicitud_payload: dict
) -> None:
    _confirmar_viaje(client, solicitud_payload, seeded, _fecha(-3))

    response = _baja(client, seeded["driver_id"])

    assert response.status_code == 200, response.text
    assert response.json()["activo"] is False


def test_reactivar_chofer_dado_de_baja(client: TestClient, seeded: dict) -> None:
    assert _baja(client, seeded["driver_id"]).status_code == 200

    alta = client.patch(
        f"/api/drivers/{seeded['driver_id']}", json={"activo": True}
    )

    assert alta.status_code == 200, alta.text
    assert alta.json()["activo"] is True
