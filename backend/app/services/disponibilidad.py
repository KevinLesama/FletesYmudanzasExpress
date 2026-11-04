"""Motor de disponibilidad operativa: lógica pura, sin base de datos ni red.

Responde una sola pregunta: **¿se puede confirmar este viaje con estos recursos?**

Vocabulario:

* Reserva **firme** (``confirmada``): bloquea el recurso. Dos firmes no pueden
  solaparse.
* Reserva **blanda** (``pendiente``): avisa, pero no bloquea. El horario todavía
  puede moverse.
* ``finalizada`` y ``cancelada`` no reservan nada.

Además del solapamiento, un chofer necesita tiempo físico para trasladarse
entre dos servicios. Ese traslado más un margen de 30 minutos tiene que entrar
en la franja libre entre ambos viajes.

Cuando el traslado no se puede calcular (sin coordenadas, sin datos del
proveedor, proveedor caído) **no se asume cero**: la evaluación queda marcada
como no verificada y la confirmación se permite con una advertencia explícita.
Nunca se presenta la disponibilidad como verificada si no lo está.

Este módulo no importa el ORM, ni ``httpx``, ni settings. Todo entra por
parámetro, así que es determinista y se puede probar sin infraestructura.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal

#: Margen operativo entre el fin de un viaje y el inicio del siguiente.
MARGEN_MIN = 30

TipoReserva = Literal["blanda", "firme"]
Recurso = Literal["chofer", "vehiculo"]
Severidad = Literal["bloquea", "advierte"]
TipoConflicto = Literal["reserva", "traslado"]

#: Única fuente de verdad de la semántica de estados. Etapa 4 la reutiliza:
#: no debe existir otra copia de esta regla en el backend.
ESTADOS_RESERVA: Mapping[str, TipoReserva] = {
    "pendiente": "blanda",
    "confirmada": "firme",
}


@dataclass(frozen=True)
class Franja:
    """Ventana en la que un viaje ocupa sus recursos (misma que la base)."""

    fecha: date
    desde: time
    hasta: time

    @property
    def valida(self) -> bool:
        return self.desde < self.hasta

    def solapa(self, otra: Franja) -> bool:
        """Intervalo semiabierto: entrar a la hora que el otro sale no es choque."""
        if self.fecha != otra.fecha:
            return False
        return self.desde < otra.hasta and otra.desde < self.hasta


@dataclass(frozen=True)
class Reserva:
    """Un viaje ya cargado, tal como lo ve el motor. Sin ORM.

    Etapa 4 la construye desde las filas de ``solicitudes``; acá no se sabe que
    existe una base de datos.
    """

    referencia: str
    estado: str
    franja: Franja
    id: int | None = None
    chofer_id: int | None = None
    vehiculo_id: int | None = None
    descarga_min: int = 0
    origen: tuple[float, float] | None = None
    destino: tuple[float, float] | None = None

    @property
    def tipo(self) -> TipoReserva | None:
        return ESTADOS_RESERVA.get(self.estado)

    @property
    def inicio(self) -> datetime:
        return datetime.combine(self.franja.fecha, self.franja.desde)

    @property
    def fin_efectivo(self) -> datetime:
        return datetime.combine(self.franja.fecha, self.franja.hasta) + timedelta(
            minutes=self.descarga_min
        )

    def solapa(self, otra: Reserva, margen_min: int = MARGEN_MIN) -> bool:
        return (
            self.inicio < otra.fin_efectivo + timedelta(minutes=margen_min)
            and otra.inicio < self.fin_efectivo + timedelta(minutes=margen_min)
        )


@dataclass(frozen=True)
class AsignacionProvisional:
    referencia: str
    estado_visible: str
    fecha: date
    desde: time
    hasta: time | None
    descarga_min: int | None
    hora_hasta_confirmada: bool
    carga_confirmada: bool
    descarga_confirmada: bool
    chofer_id: int | None = None
    vehiculo_id: int | None = None


@dataclass(frozen=True)
class Conflicto:
    """Un motivo concreto por el que el viaje no debería confirmarse.

    Sin texto libre a propósito: el copy para la UI se arma en otra capa, así
    los tests del motor no se rompen cuando cambia una palabra.
    """

    tipo: TipoConflicto
    recurso: Recurso
    severidad: Severidad
    referencia: str | None = None
    minutos_faltantes: int | None = None


@dataclass(frozen=True)
class Evaluacion:
    conflictos: tuple[Conflicto, ...] = ()
    traslado_verificado: bool = True
    margen_min: int = MARGEN_MIN

    @property
    def bloqueos(self) -> tuple[Conflicto, ...]:
        return tuple(c for c in self.conflictos if c.severidad == "bloquea")

    @property
    def advertencias(self) -> tuple[Conflicto, ...]:
        return tuple(c for c in self.conflictos if c.severidad == "advierte")

    @property
    def bloquea(self) -> bool:
        return bool(self.bloqueos)

    @property
    def permite_confirmar(self) -> bool:
        return not self.bloquea

    @property
    def requiere_advertencia_traslado(self) -> bool:
        """La confirmación se permite, pero no puede mostrarse como verificada."""
        return not self.traslado_verificado


def advertencias_asignaciones_provisionales(
    *,
    fecha: date,
    desde: time,
    hasta: time | None,
    descarga_min: int | None,
    carga_confirmada: bool,
    descarga_confirmada: bool,
    asignaciones: Sequence[AsignacionProvisional],
    margen_min: int = MARGEN_MIN,
) -> dict[tuple[Recurso, int], tuple[str, ...]]:
    """Describe posibles cruces con asignaciones no confirmadas, sin bloquear.

    Cuando cualquiera de los dos horarios está incompleto, solo se emite una
    advertencia si todavía podría existir un cruce; nunca se inventa una
    duración para decidirlo.
    """
    candidato_completo = (
        hasta is not None
        and desde < hasta
        and descarga_min is not None
        and carga_confirmada
        and descarga_confirmada
    )
    candidato = (
        Reserva(
            referencia="CANDIDATA",
            estado="pendiente",
            franja=Franja(fecha, desde, hasta),
            descarga_min=descarga_min,
        )
        if candidato_completo and hasta is not None and descarga_min is not None
        else None
    )
    resultado: dict[tuple[Recurso, int], list[str]] = {}

    for asignacion in asignaciones:
        if asignacion.fecha != fecha:
            continue
        recursos = tuple(
            (recurso, recurso_id)
            for recurso, recurso_id in (
                ("chofer", asignacion.chofer_id),
                ("vehiculo", asignacion.vehiculo_id),
            )
            if recurso_id is not None
        )
        if not recursos:
            continue

        horario_completo = (
            asignacion.hasta is not None
            and asignacion.desde < asignacion.hasta
            and asignacion.descarga_min is not None
            and asignacion.hora_hasta_confirmada
            and asignacion.carga_confirmada
            and asignacion.descarga_confirmada
        )
        if candidato is not None and horario_completo:
            otra = Reserva(
                referencia=asignacion.referencia,
                estado="pendiente",
                franja=Franja(fecha, asignacion.desde, asignacion.hasta),
                descarga_min=asignacion.descarga_min or 0,
            )
            if not candidato.solapa(otra, margen_min):
                continue
        elif candidato is not None:
            fin_candidato = candidato.fin_efectivo + timedelta(minutes=margen_min)
            if datetime.combine(fecha, asignacion.desde) >= fin_candidato:
                continue

        for recurso, recurso_id in recursos:
            nombre_recurso = "chofer" if recurso == "chofer" else "vehículo"
            texto = (
                f"Este {nombre_recurso} está asignado a la solicitud {asignacion.referencia}, "
                f"que se encuentra {asignacion.estado_visible}."
            )
            if not horario_completo:
                texto += (
                    " El horario de esa solicitud está incompleto; no se puede determinar "
                    "con precisión el solapamiento."
                )
            resultado.setdefault((recurso, recurso_id), []).append(texto)

    return {recurso: tuple(mensajes) for recurso, mensajes in resultado.items()}


#: ``travel_minutes(origen, destino)`` -> minutos, o None si no se puede calcular.
MedidorTraslado = Callable[[Reserva, Reserva], int | None]


def traslado_fijo(minutos: int | None) -> MedidorTraslado:
    """Medidor determinista para tests y para escenarios sin datos geográficos."""

    def medir(_origen: Reserva, _destino: Reserva) -> int | None:
        return minutos

    return medir


def evaluar_disponibilidad(
    viaje: Reserva,
    reservas: Sequence[Reserva],
    *,
    travel_minutes: MedidorTraslado | None = None,
    margen_min: int = MARGEN_MIN,
) -> Evaluacion:
    """Evalúa si ``viaje`` puede confirmarse junto a ``reservas``.

    Args:
        viaje: viaje candidato. Su ``id`` se usa para no reportarse a sí mismo.
        reservas: el resto de los viajes que el sistema conoce. Filtrar por día
            es opcional: el motor descarta lo que no corresponde.
        travel_minutes: resuelve el traslado entre dos viajes del mismo chofer.
            ``None`` significa "no hay forma de medirlo", no "cero minutos".
        margen_min: minutos de colchón exigidos entre viajes.

    Raises:
        ValueError: franja inválida (``desde >= hasta``), margen negativo o un
            traslado negativo. Es un error de programación, no un estado de
            negocio: la base ya impide esos valores.
    """
    if not viaje.franja.valida:
        raise ValueError(
            f"La franja del viaje {viaje.referencia} es inválida: "
            f"{viaje.franja.desde} >= {viaje.franja.hasta}."
        )
    if margen_min < 0:
        raise ValueError("El margen no puede ser negativo.")
    if viaje.descarga_min < 0:
        raise ValueError("La descarga no puede ser negativa.")

    conflictos: list[Conflicto] = []
    firmes: dict[Recurso, list[Reserva]] = {"chofer": [], "vehiculo": []}

    for otra in reservas:
        if otra.id is not None and otra.id == viaje.id:
            continue
        tipo = otra.tipo
        if tipo is None:
            continue
        if otra.descarga_min < 0:
            raise ValueError("La descarga no puede ser negativa.")
        recursos = _recursos_compartidos(viaje, otra)
        if not recursos:
            continue

        if viaje.solapa(otra, margen_min):
            severidad: Severidad = "bloquea" if tipo == "firme" else "advierte"
            conflictos.extend(
                Conflicto("reserva", recurso, severidad, otra.referencia)
                for recurso in recursos
            )
            continue

        if tipo == "firme":
            for recurso in recursos:
                firmes[recurso].append(otra)

    travel_cache: dict[tuple[Reserva, Reserva], int | None] = {}
    verificaciones = [
        _evaluar_traslado(
            viaje,
            firmes[recurso],
            recurso=recurso,
            travel_minutes=travel_minutes,
            travel_cache=travel_cache,
            margen_min=margen_min,
            conflictos=conflictos,
        )
        for recurso in ("chofer", "vehiculo")
    ]
    verificado = all(verificaciones)

    conflictos.sort(key=lambda c: (c.recurso, c.tipo, c.referencia or ""))
    return Evaluacion(
        conflictos=tuple(conflictos),
        traslado_verificado=verificado,
        margen_min=margen_min,
    )


def pares_traslado_requeridos(
    viaje: Reserva,
    reservas: Sequence[Reserva],
    *,
    margen_min: int = MARGEN_MIN,
) -> tuple[tuple[Reserva, Reserva], ...]:
    """Devuelve los pares de rutas necesarios para evaluar los vecinos firmes."""
    firmes: dict[Recurso, list[Reserva]] = {"chofer": [], "vehiculo": []}
    for otra in reservas:
        if (otra.id is not None and otra.id == viaje.id) or otra.tipo != "firme":
            continue
        if viaje.solapa(otra, margen_min):
            continue
        for recurso in _recursos_compartidos(viaje, otra):
            firmes[recurso].append(otra)

    pares: list[tuple[Reserva, Reserva]] = []
    vistos: set[tuple[Reserva, Reserva]] = set()
    for vecinos in firmes.values():
        anterior = _mas_cercana_anterior(viaje, vecinos)
        siguiente = _mas_cercana_siguiente(viaje, vecinos)
        for par in ((anterior, viaje), (viaje, siguiente)):
            if par[0] is not None and par[1] is not None and par not in vistos:
                vistos.add(par)
                pares.append(par)
    return tuple(pares)


def _recursos_compartidos(a: Reserva, b: Reserva) -> tuple[Recurso, ...]:
    recursos: list[Recurso] = []
    if a.chofer_id is not None and a.chofer_id == b.chofer_id:
        recursos.append("chofer")
    if a.vehiculo_id is not None and a.vehiculo_id == b.vehiculo_id:
        recursos.append("vehiculo")
    return tuple(recursos)


def _evaluar_traslado(
    viaje: Reserva,
    firmes: Sequence[Reserva],
    *,
    recurso: Recurso,
    travel_minutes: MedidorTraslado | None,
    travel_cache: dict[tuple[Reserva, Reserva], int | None],
    margen_min: int,
    conflictos: list[Conflicto],
) -> bool:
    """Suma conflictos de traslado y devuelve si el componente quedó verificado.

    Solo se evalúa contra reservas firmes: el horario de un pendiente todavía
    puede moverse, así que bloquear por traslado contra él sería inventar
    precisión. Se evalúa cada recurso porque un vehículo puede cambiar de chofer
    entre servicios.

    Sin viajes vecinos no hay traslado que medir: la evaluación es verificada
    aunque no haya medidor.
    """
    anterior = _mas_cercana_anterior(viaje, firmes)
    siguiente = _mas_cercana_siguiente(viaje, firmes)
    if anterior is None and siguiente is None:
        return True
    if travel_minutes is None:
        return False

    verificado = True
    for origen, destino, vecina, es_anterior in (
        (anterior, viaje, anterior, True),
        (viaje, siguiente, siguiente, False),
    ):
        if vecina is None:
            continue
        key = (origen, destino)
        if key not in travel_cache:
            travel_cache[key] = travel_minutes(origen, destino)
        minutos = travel_cache[key]
        if minutos is None:
            # Sin datos: ni conflicto ni cero minutos. Se marca no verificado.
            verificado = False
            continue
        if minutos < 0:
            raise ValueError("El tiempo de traslado no puede ser negativo.")

        if es_anterior:
            disponible = _minutos_entre(vecina.fin_efectivo, viaje.inicio)
        else:
            disponible = _minutos_entre(viaje.fin_efectivo, vecina.inicio)
        necesario = minutos + margen_min
        if disponible < necesario:
            conflictos.append(
                Conflicto(
                    tipo="traslado",
                    recurso=recurso,
                    severidad="bloquea",
                    referencia=vecina.referencia,
                    minutos_faltantes=necesario - disponible,
                )
            )
    return verificado


def _mas_cercana_anterior(viaje: Reserva, firmes: Sequence[Reserva]) -> Reserva | None:
    candidatas = [
        otra
        for otra in firmes
        if otra.franja.fecha == viaje.franja.fecha
        and otra.fin_efectivo <= viaje.inicio
    ]
    return max(candidatas, key=lambda r: r.fin_efectivo) if candidatas else None


def _mas_cercana_siguiente(viaje: Reserva, firmes: Sequence[Reserva]) -> Reserva | None:
    candidatas = [
        otra
        for otra in firmes
        if otra.franja.fecha == viaje.franja.fecha
        and otra.inicio >= viaje.fin_efectivo
    ]
    return min(candidatas, key=lambda r: r.inicio) if candidatas else None


def _minutos_entre(a: datetime, b: datetime) -> int:
    """Minutos enteros entre dos instantes, con ``b >= a``."""
    return int((b - a).total_seconds() // 60)
