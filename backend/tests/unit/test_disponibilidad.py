"""Pruebas del motor de disponibilidad.

Sin base de datos, sin red y sin reloj: todos los valores entran por parámetro,
así que cada escenario es determinista y se lee de un vistazo.

El motor describe las reglas NUEVAS (blanda/firme). No confundir con
``src/pages/planificacionAgenda.test.ts``, que caracteriza el comportamiento
actual del frontend.
"""

from __future__ import annotations

from datetime import date, time

import pytest

from app.services import disponibilidad as disp

DIA = date(2026, 11, 3)


def franja(desde: tuple[int, int], hasta: tuple[int, int], dia: date = DIA) -> disp.Franja:
    return disp.Franja(dia, time(*desde), time(*hasta))


def candidato(
    desde: tuple[int, int] = (10, 0),
    hasta: tuple[int, int] = (12, 0),
    *,
    referencia: str = "FEX-NUEVO",
    chofer: int | None = 7,
    vehiculo: int | None = 9,
    descarga_min: int = 0,
) -> disp.Reserva:
    """El viaje que se está intentando confirmar."""
    return disp.Reserva(
        referencia=referencia,
        estado="pendiente",
        franja=franja(desde, hasta),
        chofer_id=chofer,
        vehiculo_id=vehiculo,
        descarga_min=descarga_min,
    )


def reserva(
    referencia: str,
    desde: tuple[int, int],
    hasta: tuple[int, int],
    *,
    estado: str = "confirmada",
    chofer: int | None = 7,
    vehiculo: int | None = 9,
    dia: date = DIA,
    id_: int | None = None,
    descarga_min: int = 0,
) -> disp.Reserva:
    return disp.Reserva(
        referencia=referencia,
        estado=estado,
        franja=franja(desde, hasta, dia),
        id=id_,
        chofer_id=chofer,
        vehiculo_id=vehiculo,
        descarga_min=descarga_min,
    )


def tipos(evaluacion: disp.Evaluacion, tipo: str) -> list[disp.Conflicto]:
    return [c for c in evaluacion.conflictos if c.tipo == tipo]


# --------------------------------------------------------------------------- #
# 1-2. Reservas firmes bloquean; las blandas solo advierten.
# --------------------------------------------------------------------------- #
def test_solapamiento_firme_bloquea() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-VIEJO", (10, 30), (11, 30))],
    )

    assert evaluacion.bloquea
    assert not evaluacion.permite_confirmar
    assert {c.recurso for c in evaluacion.bloqueos} == {"chofer", "vehiculo"}
    assert {c.referencia for c in evaluacion.bloqueos} == {"FEX-VIEJO"}
    assert evaluacion.advertencias == ()


def test_solapamiento_blando_advierte_sin_bloquear() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-DUDOSO", (10, 30), (11, 30), estado="pendiente")],
    )

    assert not evaluacion.bloquea
    assert evaluacion.permite_confirmar
    assert {c.severidad for c in evaluacion.conflictos} == {"advierte"}
    assert {c.recurso for c in evaluacion.advertencias} == {"chofer", "vehiculo"}


def test_asignacion_pendiente_solapada_advierte_por_recurso_y_estado() -> None:
    warnings = disp.advertencias_asignaciones_provisionales(
        fecha=DIA,
        desde=time(10, 0),
        hasta=time(12, 0),
        descarga_min=30,
        carga_confirmada=True,
        descarga_confirmada=True,
        asignaciones=[
            disp.AsignacionProvisional(
                referencia="FEX-1042",
                estado_visible="Pendiente de seña",
                fecha=DIA,
                desde=time(9, 0),
                hasta=time(11, 0),
                descarga_min=30,
                hora_hasta_confirmada=True,
                carga_confirmada=True,
                descarga_confirmada=True,
                chofer_id=7,
                vehiculo_id=9,
            )
        ],
    )

    assert set(warnings) == {("chofer", 7), ("vehiculo", 9)}
    assert all("FEX-1042" in warnings[key][0] for key in warnings)
    assert all("Pendiente de seña" in warnings[key][0] for key in warnings)
    assert all("incompleto" not in warnings[key][0] for key in warnings)


def test_asignacion_pendiente_sin_solapamiento_no_advierte() -> None:
    warnings = disp.advertencias_asignaciones_provisionales(
        fecha=DIA,
        desde=time(9, 0),
        hasta=time(10, 0),
        descarga_min=0,
        carga_confirmada=True,
        descarga_confirmada=True,
        asignaciones=[
            disp.AsignacionProvisional(
                referencia="FEX-1043",
                estado_visible="Pendiente de revisión",
                fecha=DIA,
                desde=time(12, 0),
                hasta=time(13, 0),
                descarga_min=0,
                hora_hasta_confirmada=True,
                carga_confirmada=True,
                descarga_confirmada=True,
                chofer_id=7,
            )
        ],
    )

    assert warnings == {}


def test_horario_pendiente_incompleto_advierte_sin_inventar_duracion() -> None:
    warnings = disp.advertencias_asignaciones_provisionales(
        fecha=DIA,
        desde=time(10, 0),
        hasta=time(12, 0),
        descarga_min=30,
        carga_confirmada=True,
        descarga_confirmada=True,
        asignaciones=[
            disp.AsignacionProvisional(
                referencia="FEX-1044",
                estado_visible="Pendiente de revisión",
                fecha=DIA,
                desde=time(9, 0),
                hasta=None,
                descarga_min=None,
                hora_hasta_confirmada=False,
                carga_confirmada=False,
                descarga_confirmada=False,
                chofer_id=7,
            ),
            disp.AsignacionProvisional(
                referencia="FEX-1045",
                estado_visible="Pendiente de seña",
                fecha=DIA,
                desde=time(10, 30),
                hasta=time(11, 30),
                descarga_min=30,
                hora_hasta_confirmada=True,
                carga_confirmada=True,
                descarga_confirmada=True,
                chofer_id=7,
            ),
        ],
    )

    assert len(warnings[("chofer", 7)]) == 2
    assert "FEX-1044" in warnings[("chofer", 7)][0]
    assert "horario de esa solicitud está incompleto" in warnings[("chofer", 7)][0]
    assert "FEX-1045" in warnings[("chofer", 7)][1]


def test_solicitud_pendiente_en_otro_dia_no_advierte() -> None:
    warnings = disp.advertencias_asignaciones_provisionales(
        fecha=DIA,
        desde=time(10, 0),
        hasta=time(12, 0),
        descarga_min=30,
        carga_confirmada=True,
        descarga_confirmada=True,
        asignaciones=[
            disp.AsignacionProvisional(
                referencia="FEX-MANANA",
                estado_visible="Pendiente de seña",
                fecha=date(2026, 11, 4),
                desde=time(10, 0),
                hasta=time(12, 0),
                descarga_min=30,
                hora_hasta_confirmada=True,
                carga_confirmada=True,
                descarga_confirmada=True,
                chofer_id=7,
            )
        ],
    )

    assert warnings == {}


def test_blanda_y_firme_a_la_vez_reporta_cada_una_con_su_severidad() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [
            reserva("FEX-FIRME", (10, 15), (10, 45), chofer=7, vehiculo=99),
            reserva("FEX-BLANDA", (11, 0), (11, 30), estado="pendiente", chofer=8, vehiculo=9),
        ],
    )

    assert [(c.referencia, c.severidad) for c in evaluacion.conflictos] == [
        ("FEX-FIRME", "bloquea"),
        ("FEX-BLANDA", "advierte"),
    ]


# --------------------------------------------------------------------------- #
# 3-4. El solapamiento es de intervalo semiabierto y del mismo día.
# --------------------------------------------------------------------------- #
def test_franjas_contiguas_bloquean_por_el_margen_operativo() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (8, 0), (10, 0))],
    )

    assert {c.severidad for c in tipos(evaluacion, "reserva")} == {"bloquea"}
    assert not evaluacion.permite_confirmar


def test_descarga_y_margen_operativo_extienden_la_ocupacion() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(desde=(13, 29), hasta=(15, 29)),
        [reserva("FEX-ANTES", (10, 0), (12, 0), descarga_min=60)],
    )

    # La ocupación termina a las 13:00; el margen llega a 13:30 y se pisa por 1 min.
    assert {c.recurso for c in tipos(evaluacion, "reserva")} == {"chofer", "vehiculo"}
    assert not evaluacion.permite_confirmar


def test_descarga_y_margen_justos_permiten_continuidad() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(desde=(13, 30), hasta=(15, 30)),
        [reserva("FEX-ANTES", (10, 0), (12, 0), descarga_min=60)],
    )

    assert tipos(evaluacion, "reserva") == []


def test_otro_dia_no_es_conflicto() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-MANANA", (10, 0), (12, 0), dia=date(2026, 11, 4))],
    )

    assert evaluacion.conflictos == ()
    assert not evaluacion.bloquea
    # Sin vecinos en el día no hay traslado que medir: la evaluación es verificada.
    assert evaluacion.traslado_verificado is True


# --------------------------------------------------------------------------- #
# 5-7. Qué recursos se consideran y qué estados reservan.
# --------------------------------------------------------------------------- #
def test_mismo_vehiculo_con_otro_chofer_reporta_solo_el_vehiculo() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-OTRO", (10, 30), (11, 30), chofer=8, vehiculo=9)],
    )

    assert [c.recurso for c in evaluacion.conflictos] == ["vehiculo"]


def test_estados_terminales_no_reservan() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [
            reserva("FEX-CANCELADA", (10, 0), (12, 0), estado="cancelada"),
            reserva("FEX-FINALIZADA", (10, 0), (12, 0), estado="finalizada"),
        ],
    )

    assert evaluacion.conflictos == ()
    assert evaluacion.traslado_verificado is True


def test_sin_recursos_asignados_no_hay_conflictos() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(chofer=None, vehiculo=None),
        [reserva("FEX-VIEJO", (10, 0), (12, 0))],
    )

    assert evaluacion.conflictos == ()


# --------------------------------------------------------------------------- #
# 8-9. Traslado no verificable: se permite confirmar, pero no se miente.
# --------------------------------------------------------------------------- #
def test_sin_medidor_marca_el_traslado_como_no_verificado() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (8, 0), (9, 0))],
    )

    assert tipos(evaluacion, "traslado") == []
    assert evaluacion.traslado_verificado is False
    assert evaluacion.requiere_advertencia_traslado is True
    assert evaluacion.permite_confirmar


def test_medidor_sin_datos_no_asume_cero_minutos() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (8, 0), (9, 0))],
        travel_minutes=disp.traslado_fijo(None),
    )

    assert tipos(evaluacion, "traslado") == []
    assert evaluacion.traslado_verificado is False
    assert evaluacion.permite_confirmar


# --------------------------------------------------------------------------- #
# 10-13. Cálculo del traslado y del margen.
# --------------------------------------------------------------------------- #
def test_traslado_insuficiente_bloquea() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (8, 0), (9, 0))],
        travel_minutes=disp.traslado_fijo(45),
    )

    conflictos = tipos(evaluacion, "traslado")
    assert {conflicto.recurso for conflicto in conflictos} == {"chofer", "vehiculo"}
    conflicto = conflictos[0]
    assert conflicto.recurso == "chofer"
    assert conflicto.severidad == "bloquea"
    assert conflicto.referencia == "FEX-ANTES"
    # 09:00 -> 10:00 son 60 minutos; hacen falta 45 de viaje + 30 de margen.
    assert conflicto.minutos_faltantes == 15
    assert evaluacion.bloquea


def test_traslado_que_entra_sin_margen_bloquea() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (8, 0), (9, 0))],
        travel_minutes=disp.traslado_fijo(60),
    )

    conflicto = tipos(evaluacion, "traslado")[0]
    assert conflicto.minutos_faltantes == 30


def test_traslado_con_margen_justo_permite() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (7, 30), (8, 30))],
        travel_minutes=disp.traslado_fijo(60),
    )

    # 08:30 -> 10:00 son 90 minutos: 60 de viaje + 30 de margen, exacto.
    assert tipos(evaluacion, "traslado") == []
    assert evaluacion.traslado_verificado is True
    assert evaluacion.permite_confirmar


def test_el_margen_es_configurable() -> None:
    antes = [reserva("FEX-ANTES", (8, 0), (9, 0))]

    sin_margen = disp.evaluar_disponibilidad(
        candidato(), antes, travel_minutes=disp.traslado_fijo(60), margen_min=0
    )
    con_margen = disp.evaluar_disponibilidad(
        candidato(), antes, travel_minutes=disp.traslado_fijo(60), margen_min=30
    )
    margen_largo = disp.evaluar_disponibilidad(
        candidato(), antes, travel_minutes=disp.traslado_fijo(60), margen_min=90
    )

    assert tipos(sin_margen, "traslado") == []
    assert tipos(con_margen, "traslado")[0].minutos_faltantes == 30
    assert margen_largo.bloquea
    assert tipos(margen_largo, "reserva")
    assert margen_largo.margen_min == 90


def test_traslado_del_lado_siguiente_tambien_bloquea() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-DESPUES", (13, 0), (15, 0))],
        travel_minutes=disp.traslado_fijo(45),
    )

    conflicto = tipos(evaluacion, "traslado")[0]
    assert conflicto.referencia == "FEX-DESPUES"
    # 12:00 -> 13:00 son 60 minutos; hacen falta 45 de viaje + 30 de margen.
    assert conflicto.minutos_faltantes == 15


def test_traslado_del_vehiculo_se_evalua_aunque_cambie_el_chofer() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(desde=(10, 0), hasta=(12, 0), chofer=8, vehiculo=9),
        [
            reserva(
                "FEX-ANTES",
                (8, 0),
                (9, 0),
                chofer=7,
                vehiculo=9,
            )
        ],
        travel_minutes=disp.traslado_fijo(45),
    )

    (conflicto,) = tipos(evaluacion, "traslado")
    assert conflicto.recurso == "vehiculo"
    assert conflicto.minutos_faltantes == 15


# --------------------------------------------------------------------------- #
# 14. El traslado solo se exige contra reservas firmes.
# --------------------------------------------------------------------------- #
def test_traslado_no_se_evalua_contra_reservas_blandas() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-DUDOSO", (8, 0), (9, 0), estado="pendiente")],
        travel_minutes=disp.traslado_fijo(45),
    )

    assert tipos(evaluacion, "traslado") == []
    assert evaluacion.traslado_verificado is True
    assert evaluacion.permite_confirmar


# --------------------------------------------------------------------------- #
# 15. Auto-exclusión y determinismo.
# --------------------------------------------------------------------------- #
def test_el_propio_viaje_no_se_reporta() -> None:
    en_edicion = disp.Reserva(
        referencia="FEX-NUEVO",
        estado="confirmada",
        franja=franja((10, 0), (12, 0)),
        id=5,
        chofer_id=7,
        vehiculo_id=9,
    )

    evaluacion = disp.evaluar_disponibilidad(en_edicion, [en_edicion])

    assert evaluacion.conflictos == ()


def test_usa_la_reserva_anterior_mas_cercana() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [
            reserva("FEX-LEJOS", (6, 0), (7, 0)),
            reserva("FEX-CERCA", (8, 0), (9, 30)),
        ],
        travel_minutes=disp.traslado_fijo(45),
    )

    conflicto = tipos(evaluacion, "traslado")[0]
    assert conflicto.referencia == "FEX-CERCA"
    assert conflicto.minutos_faltantes == 45


def test_el_medidor_recibe_origen_y_destino_en_orden() -> None:
    llamadas: list[tuple[str, str]] = []

    def medidor(origen: disp.Reserva, destino: disp.Reserva) -> int:
        llamadas.append((origen.referencia, destino.referencia))
        return 10

    disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-ANTES", (7, 0), (8, 0))],
        travel_minutes=medidor,
    )
    disp.evaluar_disponibilidad(
        candidato(),
        [reserva("FEX-DESPUES", (14, 0), (16, 0))],
        travel_minutes=medidor,
    )

    assert llamadas == [
        ("FEX-ANTES", "FEX-NUEVO"),
        ("FEX-NUEVO", "FEX-DESPUES"),
    ]


def test_no_modifica_las_reservas_recibidas() -> None:
    reservas = [
        reserva("FEX-B", (8, 0), (9, 0)),
        reserva("FEX-A", (14, 0), (16, 0)),
    ]
    copia = list(reservas)

    disp.evaluar_disponibilidad(candidato(), reservas, travel_minutes=disp.traslado_fijo(10))

    assert reservas == copia


# --------------------------------------------------------------------------- #
# 16. Entradas inválidas fallan ruidosamente.
# --------------------------------------------------------------------------- #
def test_franja_invalida_falla() -> None:
    with pytest.raises(ValueError, match="franja"):
        disp.evaluar_disponibilidad(candidato(desde=(12, 0), hasta=(10, 0)), [])

    with pytest.raises(ValueError, match="franja"):
        disp.evaluar_disponibilidad(candidato(desde=(10, 0), hasta=(10, 0)), [])


def test_margen_negativo_falla() -> None:
    with pytest.raises(ValueError, match="margen"):
        disp.evaluar_disponibilidad(candidato(), [], margen_min=-1)


def test_traslado_negativo_falla() -> None:
    with pytest.raises(ValueError, match="negativo"):
        disp.evaluar_disponibilidad(
            candidato(),
            [reserva("FEX-ANTES", (8, 0), (9, 0))],
            travel_minutes=disp.traslado_fijo(-5),
        )


# --------------------------------------------------------------------------- #
# 17. Todos los conflictos, en orden estable.
# --------------------------------------------------------------------------- #
def test_reporta_todos_los_conflictos_en_orden_estable() -> None:
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [
            reserva("FEX-VEHICULO", (10, 15), (10, 45), chofer=8, vehiculo=9),
            reserva("FEX-CHOFER", (10, 30), (11, 30), chofer=7, vehiculo=99),
        ],
    )

    assert [(c.recurso, c.tipo, c.referencia) for c in evaluacion.conflictos] == [
        ("chofer", "reserva", "FEX-CHOFER"),
        ("vehiculo", "reserva", "FEX-VEHICULO"),
    ]


def test_la_advertencia_de_traslado_no_impide_confirmar() -> None:
    """El caso completo: solape blando + traslado sin datos."""
    evaluacion = disp.evaluar_disponibilidad(
        candidato(),
        [
            reserva("FEX-DUDOSO", (10, 30), (11, 30), estado="pendiente", chofer=7, vehiculo=99),
            reserva("FEX-ANTES", (8, 0), (9, 0), chofer=7, vehiculo=99),
        ],
        travel_minutes=disp.traslado_fijo(None),
    )

    assert evaluacion.permite_confirmar
    assert len(evaluacion.advertencias) == 1
    assert evaluacion.requiere_advertencia_traslado is True
