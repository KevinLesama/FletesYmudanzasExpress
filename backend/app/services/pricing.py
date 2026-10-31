"""Formula de costos y precios de un viaje.

Es el UNICO lugar donde se calcula plata. La usan la creacion de solicitudes,
la recotizacion de planificacion y la vista previa de la configuracion del
chofer, asi el numero que ve el admin es el mismo que se guarda.

Reglas comerciales:

* Distancia de ida: se redondea SIEMPRE hacia arriba (un viaje de 7,2 km se
  cobra como 8).
* Distancia total: ida + vuelta por el mismo camino.
* Tiempo total: ida + vuelta + espera (carga y descarga), en horas.
* Costo del chofer: tarifa base + km totales * tarifa por km
  + horas totales * tarifa por hora.
* Precio sugerido: costo del chofer * margen (1.5 por defecto, o sea 50 %).
* Sena: 50 % del precio acordado.

Todo se calcula con Decimal para no arrastrar errores de punto flotante.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def ceil_km(value: float | Decimal) -> Decimal:
    """Kilometros enteros hacia arriba, con dos decimales."""
    return Decimal(str(value)).to_integral_value(rounding=ROUND_CEILING).quantize(CENT)


def total_hours(
    duracion_ida_min: int | None,
    duracion_vuelta_min: int | None,
    espera_min: int | None,
) -> Decimal:
    """Horas de servicio: ida + vuelta + espera (carga y descarga)."""
    minutos = (
        max(int(duracion_ida_min or 0), 0)
        + max(int(duracion_vuelta_min or 0), 0)
        + max(int(espera_min or 0), 0)
    )
    return (Decimal(minutos) / Decimal(60)).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Quote:
    km_ida: Decimal
    km_vuelta: Decimal
    km_total: Decimal
    duracion_ida_min: int
    duracion_vuelta_min: int
    espera_min: int
    tarifa_base: Decimal
    tarifa_por_km: Decimal
    tarifa_por_hora: Decimal
    costo_base: Decimal
    costo_km: Decimal
    costo_tiempo: Decimal
    costo_chofer: Decimal
    margen: Decimal
    precio_sugerido: Decimal
    sena_requerida: Decimal

    @property
    def horas_totales(self) -> Decimal:
        return total_hours(
            self.duracion_ida_min, self.duracion_vuelta_min, self.espera_min
        )


def compute_quote(
    *,
    km_ida: float | Decimal,
    duracion_ida_min: int | None,
    duracion_vuelta_min: int | None = None,
    espera_min: int = 0,
    tarifa_base: float | Decimal = 0,
    tarifa_por_km: float | Decimal = 0,
    tarifa_por_hora: float | Decimal = 0,
    margen: float | Decimal = Decimal("1.5"),
) -> Quote:
    """Calcula el costo del chofer, el precio sugerido y la sena."""
    ida = ceil_km(km_ida)
    if ida <= 0:
        raise ValueError("La distancia de ida debe ser mayor a cero.")

    ida_min = max(int(duracion_ida_min or 0), 0)
    # La vuelta recorre el mismo camino que la ida.
    vuelta_min = max(int(duracion_vuelta_min if duracion_vuelta_min is not None else ida_min), 0)
    espera = max(int(espera_min or 0), 0)

    km_total = ida * 2
    horas = total_hours(ida_min, vuelta_min, espera)

    base = Decimal(str(tarifa_base or 0))
    por_km = Decimal(str(tarifa_por_km or 0))
    por_hora = Decimal(str(tarifa_por_hora or 0))
    factor = Decimal(str(margen or 0))

    costo_base = _money(base)
    costo_km = _money(km_total * por_km)
    costo_tiempo = _money(horas * por_hora)
    costo_chofer = _money(costo_base + costo_km + costo_tiempo)
    precio_sugerido = _money(costo_chofer * factor)

    return Quote(
        km_ida=ida,
        km_vuelta=ida,
        km_total=km_total,
        duracion_ida_min=ida_min,
        duracion_vuelta_min=vuelta_min,
        espera_min=espera,
        tarifa_base=_money(base),
        tarifa_por_km=_money(por_km),
        tarifa_por_hora=_money(por_hora),
        costo_base=costo_base,
        costo_km=costo_km,
        costo_tiempo=costo_tiempo,
        costo_chofer=costo_chofer,
        margen=factor,
        precio_sugerido=precio_sugerido,
        sena_requerida=_money(precio_sugerido / 2),
    )


def sena(precio_final: float | Decimal) -> Decimal:
    """Sena requerida: 50 % del precio acordado."""
    return _money(Decimal(str(precio_final or 0)) / 2)
