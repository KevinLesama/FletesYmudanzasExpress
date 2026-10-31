from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings

from . import geocoding, routing
from .providers import GoogleProvider, OSMProvider
from .schemas import GeoResult, GeoStatus


class GeoEnrichmentService:
    def __init__(self, providers):
        self.providers = tuple(providers)
        self._cache: dict[tuple, GeoResult] = {}

    def _cached(self, key: tuple, loader):
        if key in self._cache:
            return self._cache[key]
        result = loader()
        if len(self._cache) >= 256:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = result
        return result

    def search(self, query: str, limit: int = 5) -> GeoResult:
        normalized = query.strip().lower()
        return self._cached(("search", normalized, limit), lambda: self._search(normalized, limit))

    def _search(self, query: str, limit: int) -> GeoResult:
        last = GeoResult(GeoStatus.UNAVAILABLE, message="Sin proveedores disponibles.")
        for provider in self.providers:
            result = geocoding.search(provider, query, limit)
            if result.status != GeoStatus.UNAVAILABLE:
                return result
            last = result
        return last

    def resolve(self, place_id: str) -> GeoResult:
        return self._cached(("resolve", place_id), lambda: self._resolve(place_id))

    def _resolve(self, place_id: str) -> GeoResult:
        for provider in self.providers:
            result = geocoding.resolve(provider, place_id)
            if result.status != GeoStatus.UNAVAILABLE:
                return result
        return GeoResult(GeoStatus.UNAVAILABLE, message="Sin proveedores disponibles.")

    def route(self, origin, destination) -> GeoResult:
        key = ("route", round(origin[0], 6), round(origin[1], 6), round(destination[0], 6), round(destination[1], 6))
        return self._cached(key, lambda: self._route(origin, destination))

    def _route(self, origin, destination) -> GeoResult:
        last = GeoResult(GeoStatus.UNAVAILABLE, message="Sin proveedores disponibles.")
        for provider in self.providers:
            result = routing.route(provider, origin, destination)
            if result.status != GeoStatus.UNAVAILABLE:
                return result
            last = result
        return last


@lru_cache
def get_geo_service() -> GeoEnrichmentService:
    settings = get_settings()
    providers = []
    if settings.geo_enrichment_enabled and settings.google_maps_api_key.strip():
        providers.append(GoogleProvider())
    if settings.geo_fallback_enabled and settings.nominatim_url.strip() and settings.routing_url.strip():
        providers.append(
            OSMProvider(
                settings.nominatim_url,
                settings.routing_url,
                settings.geo_user_agent,
                settings.geo_timeout_seconds,
            )
        )
    return GeoEnrichmentService(providers)
