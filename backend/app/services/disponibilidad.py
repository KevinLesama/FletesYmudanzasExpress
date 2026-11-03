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
from datetime import date, time
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

    @property
    def tipo(self) -> TipoReserva | None:
        return ESTADOS_RESERVA.get(self.estado)


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

    conflictos: list[Conflicto] = []
    firmes: dict[Recurso, list[Reserva]] = {"chofer": [], "vehiculo": []}

    for otra in reservas:
        if otra.id is not None and otra.id == viaje.id:
            continue
        tipo = otra.tipo
        if tipo is None:
            continue
        recursos = _recursos_compartidos(viaje, otra)
        if not recursos:
            continue

        if viaje.franja.solapa(otra.franja):
            severidad: Severidad = "bloquea" if tipo == "firme" else "advierte"
            conflictos.extend(
                Conflicto("reserva", recurso, severidad, otra.referencia)
                for recurso in recursos
            )
            continue

        if tipo == "firme":
            for recurso in recursos:
                firmes[recurso].append(otra)

    verificado = _evaluar_traslado(
        viaje,
        firmes["chofer"],
        travel_minutes=travel_minutes,
        margen_min=margen_min,
        conflictos=conflictos,
    )

    conflictos.sort(key=lambda c: (c.recurso, c.tipo, c.referencia or ""))
    return Evaluacion(
        conflictos=tuple(conflictos),
        traslado_verificado=verificado,
        margen_min=margen_min,
    )


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
    travel_minutes: MedidorTraslado | None,
    margen_min: int,
    conflictos: list[Conflicto],
) -> bool:
    """Suma conflictos de traslado y devuelve si el componente quedó verificado.

    Solo se evalúa contra reservas firmes: el horario de un pendiente todavía
    puede moverse, así que bloquear por traslado contra él sería inventar
    precisión. Solo se evalúa por chofer: el rodado se mueve porque lo maneja
    el chofer, así que una sola restricción cubre ambos recursos.

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
        minutos = travel_minutes(origen, destino)
        if minutos is None:
            # Sin datos: ni conflicto ni cero minutos. Se marca no verificado.
            verificado = False
            continue
        if minutos < 0:
            raise ValueError("El tiempo de traslado no puede ser negativo.")

        if es_anterior:
            disponible = _minutos_entre(vecina.franja.hasta, viaje.franja.desde)
        else:
            disponible = _minutos_entre(viaje.franja.hasta, vecina.franja.desde)
        necesario = minutos + margen_min
        if disponible < necesario:
            conflictos.append(
                Conflicto(
                    tipo="traslado",
                    recurso="chofer",
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
        and otra.franja.hasta <= viaje.franja.desde
    ]
    return max(candidatas, key=lambda r: r.franja.hasta) if candidatas else None


def _mas_cercana_siguiente(viaje: Reserva, firmes: Sequence[Reserva]) -> Reserva | None:
    candidatas = [
        otra
        for otra in firmes
        if otra.franja.fecha == viaje.franja.fecha
        and otra.franja.desde >= viaje.franja.hasta
    ]
    return min(candidatas, key=lambda r: r.franja.desde) if candidatas else None


def _minutos_entre(a: time, b: time) -> int:
    """Minutos enteros entre dos horas del mismo día, con ``b >= a``."""
    segundos = (b.hour - a.hour) * 3600 + (b.minute - a.minute) * 60 + (b.second - a.second)
    return segundos // 60
