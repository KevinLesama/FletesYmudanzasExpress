"""Reglas de negocio puras: pagos, estado derivado y agenda.

Ninguna prueba de este archivo abre una conexion. Las que necesitan base de
datos viven en ``tests/pg/``.
"""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services import business


# --------------------------------------------------------------------------- #
# Tope de pagos: una seña no se cobra dos veces ni se cobra de mas.
# --------------------------------------------------------------------------- #
def _solicitud(precio: Decimal, pagos: list[tuple[str, Decimal]]):
    return SimpleNamespace(
        precio_final=precio,
        pagos=[SimpleNamespace(concepto=c, monto=m) for c, m in pagos],
    )


def test_validate_payment_amount_accumulates_sena() -> None:
    """Dos señas parciales no pueden superar la seña requerida (50 %)."""
    solicitud = _solicitud(Decimal("100000"), [("sena", Decimal("20000"))])

    business.validate_payment_amount(solicitud, "sena", Decimal("30000"))
    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "sena", Decimal("30001"))


def test_validate_payment_amount_rejects_full_sena_twice() -> None:
    solicitud = _solicitud(Decimal("100000"), [("sena", Decimal("50000"))])

    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "sena", Decimal("1"))


def test_validate_payment_amount_caps_balance_against_total() -> None:
    solicitud = _solicitud(
        Decimal("100000"),
        [("sena", Decimal("50000")), ("saldo", Decimal("20000"))],
    )

    business.validate_payment_amount(solicitud, "saldo", Decimal("30000"))
    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "saldo", Decimal("30001"))


def test_validate_payment_amount_requires_price_for_sena() -> None:
    solicitud = _solicitud(Decimal("0"), [])

    with pytest.raises(business.PaymentAmountError):
        business.validate_payment_amount(solicitud, "sena", Decimal("1"))


# --------------------------------------------------------------------------- #
# Estado derivado y confirmacion automatica.
# --------------------------------------------------------------------------- #
def _viaje(
    estado: str = "pendiente",
    chofer: int | None = 7,
    vehiculo: int | None = 9,
    pagos: list[tuple[str, Decimal]] | None = None,
):
    return SimpleNamespace(
        id=1,
        codigo="FEX-1000",
        estado=estado,
        chofer_id=chofer,
        vehiculo_id=vehiculo,
        precio_final=Decimal("100000"),
        pagos=[SimpleNamespace(concepto=c, monto=m) for c, m in (pagos or [])],
    )


def test_sena_completa_exige_la_mitad_del_precio() -> None:
    assert not business.sena_completa(_viaje(pagos=[("sena", Decimal("49999"))]))
    assert business.sena_completa(_viaje(pagos=[("sena", Decimal("50000"))]))
    assert business.sena_completa(
        _viaje(pagos=[("sena", Decimal("30000")), ("sena", Decimal("20000"))])
    )


def test_derive_estado_sin_asignacion_es_pendiente() -> None:
    """Sin chofer o sin rodado la seña no es el próximo paso."""
    assert business.derive_estado(_viaje(chofer=None, vehiculo=9)) == "pendiente"
    assert business.derive_estado(_viaje(chofer=7, vehiculo=None)) == "pendiente"


def test_derive_estado_con_asignacion_sin_sena_es_pendiente_sena() -> None:
    assert business.derive_estado(_viaje(pagos=[])) == "pendiente_sena"
    assert business.derive_estado(_viaje(pagos=[("sena", Decimal("10000"))])) == "pendiente_sena"


def test_derive_estado_con_sena_completa_no_inventa_la_confirmacion() -> None:
    """La etiqueta sigue el estado almacenado; confirmar es tarea de confirm_if_ready."""
    solicitud = _viaje(pagos=[("sena", Decimal("50000"))])

    assert business.derive_estado(solicitud) == "pendiente"

    solicitud.estado = "confirmada"
    assert business.derive_estado(solicitud) == "confirmada"


def test_derive_estado_respeta_estados_terminales() -> None:
    assert business.derive_estado(_viaje(estado="finalizada")) == "finalizada"
    assert business.derive_estado(_viaje(estado="cancelada")) == "cancelada"


def test_confirm_if_ready_no_actua_sin_asignacion_o_sin_sena() -> None:
    """Los casos incompletos salen antes de tocar la base (db None no se usa)."""
    sin_chofer = _viaje(chofer=None, pagos=[("sena", Decimal("50000"))])
    sin_sena = _viaje(pagos=[("sena", Decimal("10000"))])
    ya_confirmado = _viaje(estado="confirmada", pagos=[("sena", Decimal("50000"))])

    assert business.confirm_if_ready(None, sin_chofer) is None
    assert business.confirm_if_ready(None, sin_sena) is None
    assert business.confirm_if_ready(None, ya_confirmado) is None
    assert sin_chofer.estado == "pendiente"
    assert sin_sena.estado == "pendiente"


def test_pending_confirmation_exige_estado_asignacion_y_sena() -> None:
    assert business.pending_confirmation(_viaje(pagos=[("sena", Decimal("50000"))]))
    assert not business.pending_confirmation(
        _viaje(chofer=None, pagos=[("sena", Decimal("50000"))])
    )
    assert not business.pending_confirmation(
        _viaje(vehiculo=None, pagos=[("sena", Decimal("50000"))])
    )
    assert not business.pending_confirmation(_viaje(pagos=[("sena", Decimal("49999"))]))
    assert not business.pending_confirmation(
        _viaje(estado="confirmada", pagos=[("sena", Decimal("50000"))])
    )


def test_blocking_reason_ignora_viajes_incompletos() -> None:
    """Sin asignación o sin seña no hay bloqueo que reportar (no toca la base)."""
    assert (
        business.blocking_reason(None, _viaje(chofer=None, pagos=[("sena", Decimal("50000"))]))
        is None
    )
    assert business.blocking_reason(None, _viaje(pagos=[])) is None


# --------------------------------------------------------------------------- #
# Agenda: que viajes bloquean el horario del chofer y del rodado.
#
# Regla vigente en esta base (`main` + confirmacion automatica): SOLO los viajes
# `confirmada` bloquean. Un `pendiente` todavia no reserva a nivel de bloqueo;
# la capa de advertencia blanda llega con el motor de disponibilidad.
#
# Estas pruebas fijan esa regla para detectar regresiones: si alguien vuelve a
# hacer que `pendiente` bloquee, fallan.
# --------------------------------------------------------------------------- #
class _Scalars:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def all(self) -> list[object]:
        return self._rows


class _FakeDb:
    """Devuelve filas fijas: alcanza para probar el filtro en memoria."""

    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def scalars(self, _stmt: object) -> _Scalars:
        return _Scalars(self._rows)


class _CapturaDb:
    """No devuelve filas: captura la consulta emitida para inspeccionarla.

    El filtro por estado lo resuelve la base, no Python. Un fake que devuelve
    filas no puede probarlo: hay que mirar el SQL que se genera.
    """

    def __init__(self) -> None:
        self.sql = ""

    def scalars(self, stmt: object) -> _Scalars:
        self.sql = stmt.compile(compile_kwargs={"literal_binds": True}).string
        return _Scalars([])


def _agenda(codigo: str, desde: tuple[int, int], hasta: tuple[int, int]):
    return SimpleNamespace(
        id=2,
        codigo=codigo,
        hora_desde=time(*desde),
        hora_hasta=time(*hasta),
    )


def test_solo_confirmada_bloquea_la_agenda() -> None:
    """El filtro por estado lo aplica la base: se verifica en el SQL emitido."""
    captura = _CapturaDb()
    business.driver_conflicts(captura, 7, date(2026, 11, 3), time(10, 0), time(12, 0))

    assert "solicitudes.estado = 'confirmada'" in captura.sql

    captura = _CapturaDb()
    business.vehicle_conflicts(captura, 9, date(2026, 11, 3), time(10, 0), time(12, 0))

    assert "solicitudes.estado = 'confirmada'" in captura.sql


def test_conflictos_filtran_por_recurso_y_dia() -> None:
    captura = _CapturaDb()
    business.driver_conflicts(
        captura, 7, date(2026, 11, 3), time(10, 0), time(12, 0), exclude_id=42
    )

    assert "solicitudes.chofer_id = 7" in captura.sql
    assert "solicitudes.fecha = '2026-11-03'" in captura.sql
    # El viaje que se esta editando no se reporta a si mismo.
    assert "solicitudes.id != 42" in captura.sql

    captura = _CapturaDb()
    business.vehicle_conflicts(captura, 9, date(2026, 11, 3), time(10, 0), time(12, 0))

    assert "solicitudes.vehiculo_id = 9" in captura.sql


def test_conflictos_descartan_franjas_que_no_se_pisan() -> None:
    """El solapamiento se resuelve en memoria sobre las filas que trae la base."""
    viajes = [
        _agenda("FEX-A", (9, 0), (10, 0)),   # termina justo antes: no
        _agenda("FEX-B", (10, 0), (12, 0)),  # se pisa
        _agenda("FEX-C", (11, 0), (13, 0)),  # se pisa
        _agenda("FEX-D", (13, 0), (15, 0)),  # empieza justo despues: no
    ]

    choques = business.driver_conflicts(
        _FakeDb(viajes), 7, date(2026, 11, 3), time(10, 30), time(12, 30)
    )

    assert [c.codigo for c in choques] == ["FEX-B", "FEX-C"]


def test_conflictos_no_marcan_horarios_contiguos() -> None:
    """Salir a las 12:00 y entrar a las 12:00 no es superposicion."""
    viajes = [_agenda("FEX-A", (10, 0), (12, 0))]

    assert not business.driver_conflicts(
        _FakeDb(viajes), 7, date(2026, 11, 3), time(12, 0), time(14, 0)
    )
    assert not business.vehicle_conflicts(
        _FakeDb(viajes), 9, date(2026, 11, 3), time(12, 0), time(14, 0)
    )
