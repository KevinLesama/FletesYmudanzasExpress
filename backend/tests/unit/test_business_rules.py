"""Reglas de negocio puras: pagos, estado derivado y agenda.

Ninguna prueba de este archivo abre una conexion. Las que necesitan base de
datos viven en ``tests/pg/``.
"""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from threading import Barrier
from types import SimpleNamespace

import pytest

from app.services import business
from app.services.scraping.schemas import GeoStatus


def test_hora_llegada_estimada_suma_inicio_carga_y_eta() -> None:
    assert business.hora_llegada_estimada(time(9, 0), 60, 90) == time(11, 30)


@pytest.mark.parametrize(
    ("carga_min", "viaje_min"),
    [(-1, 30), (60, -1), (60, 900)],
)
def test_hora_llegada_estimada_rechaza_duraciones_invalidas_o_otro_dia(
    carga_min: int, viaje_min: int
) -> None:
    with pytest.raises(ValueError):
        business.hora_llegada_estimada(time(23, 0), carga_min, viaje_min)


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
    carga_min: int | None = 60,
    descarga_min: int | None = 60,
    carga_confirmada: bool = True,
    descarga_confirmada: bool = True,
    hora_hasta: time | None = time(12, 0),
    hora_hasta_confirmado: bool = True,
):
    return SimpleNamespace(
        id=1,
        codigo="FEX-1000",
        estado=estado,
        chofer_id=chofer,
        vehiculo_id=vehiculo,
        hora_desde=time(9, 0),
        hora_hasta=hora_hasta,
        hora_hasta_confirmado=hora_hasta_confirmado,
        carga_min=carga_min,
        carga_min_confirmado=carga_confirmada,
        descarga_min=descarga_min,
        descarga_min_confirmado=descarga_confirmada,
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


@pytest.mark.parametrize(
    "changes",
    [
        {"chofer": None, "vehiculo": None},
        {"chofer": None},
        {"vehiculo": None},
        {"carga_confirmada": False, "descarga_confirmada": False},
        {"carga_min": None},
        {"carga_confirmada": False},
        {"descarga_min": None},
        {"descarga_confirmada": False},
        {"hora_hasta": None},
        {"hora_hasta_confirmado": False},
    ],
)
def test_derive_estado_planificacion_incompleta_es_pendiente(changes: dict) -> None:
    assert business.derive_estado(_viaje(**changes)) == "pendiente"


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
    assert not business.pending_confirmation(_viaje(carga_confirmada=False, pagos=[("sena", Decimal("50000"))]))
    assert not business.pending_confirmation(_viaje(descarga_confirmada=False, pagos=[("sena", Decimal("50000"))]))
    assert not business.pending_confirmation(_viaje(hora_hasta_confirmado=False, pagos=[("sena", Decimal("50000"))]))
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


def test_confirm_if_ready_does_not_confirm_with_inactive_driver() -> None:
    class _InactiveDriverDb:
        def execute(self, _statement):
            return SimpleNamespace(
                all=lambda: [],
                one_or_none=lambda: SimpleNamespace(rol="chofer", activo=False),
            )

    solicitud = _viaje(pagos=[("sena", Decimal("50000"))])

    reason = business.confirm_if_ready(_InactiveDriverDb(), solicitud)

    assert reason == "No se puede confirmar: el chofer asignado está inactivo."
    assert solicitud.estado == "pendiente"


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

    def __init__(self, rows: list[object], config: object | None = None) -> None:
        self._rows = rows
        self._config = config

    def scalars(self, _stmt: object) -> _Scalars:
        return _Scalars(self._rows)

    def get(self, _model: object, _key: int) -> object | None:
        return self._config


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


def _solicitud_agenda(
    id_: int,
    codigo: str,
    estado: str,
    desde: tuple[int, int],
    hasta: tuple[int, int],
    *,
    chofer: int | None = 7,
    vehiculo: int | None = 9,
    descarga: int = 0,
    origen: tuple[float, float] = (-34.6, -58.4),
    destino: tuple[float, float] = (-34.7, -58.5),
):
    return SimpleNamespace(
        id=id_,
        codigo=codigo,
        estado=estado,
        fecha=date(2026, 11, 3),
        hora_desde=time(*desde),
        hora_hasta=time(*hasta),
        hora_hasta_confirmado=True,
        carga_min=60,
        carga_min_confirmado=True,
        descarga_min=descarga,
        descarga_min_confirmado=True,
        chofer_id=chofer,
        vehiculo_id=vehiculo,
        origen_lat=origen[0],
        origen_lng=origen[1],
        destino_lat=destino[0],
        destino_lng=destino[1],
    )


def _evaluar_agenda(db: object, solicitud: object):
    return business.evaluar_agenda(
        db,
        solicitud,
        chofer_id=solicitud.chofer_id,
        vehiculo_id=solicitud.vehiculo_id,
        fecha=solicitud.fecha,
        desde=solicitud.hora_desde,
        hasta=solicitud.hora_hasta,
        descarga_min=solicitud.descarga_min,
    )


def test_evaluar_agenda_advierte_sin_bloquear_reserva_pendiente() -> None:
    candidata = _solicitud_agenda(1, "FEX-NUEVO", "pendiente", (10, 0), (12, 0))
    pendiente = _solicitud_agenda(2, "FEX-PEND", "pendiente", (11, 0), (13, 0))

    evaluation = _evaluar_agenda(_FakeDb([pendiente]), candidata)

    assert not evaluation.bloquea
    assert len(evaluation.advertencias) == 2
    assert business.availability_warnings(evaluation) == [
        "El horario coincide con la solicitud FEX-PEND aún pendiente."
    ]


def test_evaluar_agenda_usa_margen_operativo_configurado() -> None:
    candidata = _solicitud_agenda(
        1, "FEX-NUEVO", "pendiente", (10, 0), (12, 0),
        chofer=8, descarga=0, vehiculo=9
    )
    anterior = _solicitud_agenda(
        2, "FEX-ANTES", "confirmada", (8, 0), (9, 15),
        chofer=7, descarga=0, vehiculo=9
    )
    config = SimpleNamespace(margen_operativo_min=60)

    evaluation = _evaluar_agenda(_FakeDb([anterior], config), candidata)

    assert [(conflict.recurso, conflict.tipo) for conflict in evaluation.bloqueos] == [
        ("vehiculo", "reserva")
    ]


def test_evaluar_agenda_bloquea_traslado_de_vehiculo_entre_choferes(monkeypatch) -> None:
    candidata = _solicitud_agenda(
        1, "FEX-NUEVO", "pendiente", (10, 0), (12, 0), chofer=8
    )
    anterior = _solicitud_agenda(
        2, "FEX-ANTES", "confirmada", (8, 0), (9, 0), chofer=7
    )

    class Geo:
        def route(self, origin, destination):
            assert origin == (-34.7, -58.5)
            assert destination == (-34.6, -58.4)
            return SimpleNamespace(
                status=GeoStatus.OK,
                value=SimpleNamespace(duration_min=45),
            )

    monkeypatch.setattr(business, "get_geo_service", lambda: Geo())
    evaluation = _evaluar_agenda(_FakeDb([anterior]), candidata)

    assert [(conflict.recurso, conflict.minutos_faltantes) for conflict in evaluation.bloqueos] == [
        ("vehiculo", 15)
    ]


def test_evaluar_agenda_no_inventa_traslado_cuando_ruta_no_disponible(monkeypatch) -> None:
    candidata = _solicitud_agenda(1, "FEX-NUEVO", "pendiente", (10, 0), (12, 0))
    anterior = _solicitud_agenda(
        2, "FEX-ANTES", "confirmada", (7, 0), (8, 0)
    )

    class Geo:
        def route(self, _origin, _destination):
            return SimpleNamespace(status=GeoStatus.UNAVAILABLE, value=None)

    monkeypatch.setattr(business, "get_geo_service", lambda: Geo())
    evaluation = _evaluar_agenda(_FakeDb([anterior]), candidata)

    assert not evaluation.bloquea
    assert not evaluation.traslado_verificado
    assert any("no se pudo verificar" in warning.lower() for warning in business.availability_warnings(evaluation))


def test_evaluar_agenda_consulta_en_paralelo_los_traslados_independientes(monkeypatch) -> None:
    candidata = _solicitud_agenda(
        1, "FEX-NUEVO", "pendiente", (10, 0), (12, 0)
    )
    chofer_anterior = _solicitud_agenda(
        2, "FEX-CHOFER", "confirmada", (8, 0), (9, 0),
        vehiculo=10, destino=(-34.71, -58.51),
    )
    vehiculo_anterior = _solicitud_agenda(
        3, "FEX-VEHICULO", "confirmada", (8, 0), (9, 0),
        chofer=8, destino=(-34.72, -58.52),
    )
    rutas_concurrentes = Barrier(2)

    class Geo:
        def route(self, _origin, _destination):
            rutas_concurrentes.wait(timeout=2)
            return SimpleNamespace(
                status=GeoStatus.OK,
                value=SimpleNamespace(duration_min=20),
            )

    monkeypatch.setattr(business, "get_geo_service", lambda: Geo())
    evaluation = _evaluar_agenda(
        _FakeDb([chofer_anterior, vehiculo_anterior]), candidata
    )

    assert evaluation.traslado_verificado
    assert not evaluation.bloquea
