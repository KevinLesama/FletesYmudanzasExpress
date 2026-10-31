from __future__ import annotations

from decimal import Decimal, ROUND_CEILING

from .providers import GeoProvider, ProviderNotFound, ProviderUnavailable
from .schemas import GeoResult, GeoStatus


def route(
    provider: GeoProvider,
    origin: tuple[float, float],
    destination: tuple[float, float],
) -> GeoResult:
    try:
        result = provider.route(origin, destination)
    except ProviderNotFound as exc:
        return GeoResult(GeoStatus.NOT_FOUND, message=str(exc))
    except ProviderUnavailable as exc:
        return GeoResult(GeoStatus.UNAVAILABLE, message=str(exc))
    rounded = float(Decimal(str(result.distance_km)).to_integral_value(rounding=ROUND_CEILING))
    return GeoResult(
        GeoStatus.OK,
        type(result)(rounded, result.duration_min, result.provider),
    )
