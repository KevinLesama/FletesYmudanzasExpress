from __future__ import annotations

import logging
from functools import lru_cache
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings

from . import geocoding, routing
from .providers import GoogleProvider, OSMProvider
from .schemas import GeoResult, GeoStatus

logger = logging.getLogger(__name__)
BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")


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

    def route(self, origin, destination, departure_time: datetime | None = None) -> GeoResult:
        departure_key = departure_time.isoformat() if departure_time else None
        key = (
            "route",
            round(origin[0], 6),
            round(origin[1], 6),
            round(destination[0], 6),
            round(destination[1], 6),
            departure_key,
        )
        if key in self._cache:
            return self._cache[key]
        result = self._route(origin, destination, departure_time)
        if result.status != GeoStatus.UNAVAILABLE:
            if len(self._cache) >= 256:
                self._cache.pop(next(iter(self._cache)))
            self._cache[key] = result
        return result

    def _route(self, origin, destination, departure_time: datetime | None) -> GeoResult:
        last = GeoResult(GeoStatus.UNAVAILABLE, message="Sin proveedores disponibles.")
        for index, provider in enumerate(self.providers):
            result = routing.route(provider, origin, destination, departure_time)
            if result.status == GeoStatus.OK:
                logger.info("Route provider selected: %s", provider.name)
                return result
            if result.status == GeoStatus.NOT_FOUND:
                logger.info("Route not found by provider: %s", provider.name)
                return result
            if index + 1 < len(self.providers):
                logger.info("Route provider unavailable; trying configured fallback: %s", provider.name)
            else:
                logger.info("Route provider unavailable: %s", provider.name)
            last = result
        return last


def scheduled_departure(
    travel_date: date | None,
    start_time: time | None,
    *,
    offset_minutes: int = 0,
) -> datetime | None:
    if travel_date is None or start_time is None:
        return None
    departure = datetime.combine(travel_date, start_time) + timedelta(minutes=offset_minutes)
    departure = departure.replace(tzinfo=BUENOS_AIRES)
    if departure <= datetime.now(BUENOS_AIRES):
        return None
    return departure


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
