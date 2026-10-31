from __future__ import annotations

from .providers import GeoProvider, ProviderNotFound, ProviderUnavailable
from .schemas import GeoResult, GeoStatus


def search(provider: GeoProvider, query: str, limit: int = 5) -> GeoResult:
    if not query.strip():
        return GeoResult(GeoStatus.NOT_FOUND, message="La búsqueda está vacía.")
    try:
        suggestions = provider.search(query.strip(), limit)
    except ProviderUnavailable as exc:
        return GeoResult(GeoStatus.UNAVAILABLE, message=str(exc))
    return GeoResult(
        GeoStatus.OK if suggestions else GeoStatus.NOT_FOUND,
        suggestions,
        None if suggestions else "No se encontraron coincidencias.",
    )


def resolve(provider: GeoProvider, place_id: str) -> GeoResult:
    try:
        return GeoResult(GeoStatus.OK, provider.resolve(place_id))
    except ProviderNotFound as exc:
        return GeoResult(GeoStatus.NOT_FOUND, message=str(exc))
    except ProviderUnavailable as exc:
        return GeoResult(GeoStatus.UNAVAILABLE, message=str(exc))
