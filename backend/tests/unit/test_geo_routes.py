from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

from app.services import geo
from app.services.scraping import service
from app.services.scraping.providers import ProviderNotFound, ProviderUnavailable
from app.services.scraping.schemas import GeoStatus, Route


def test_google_routes_uses_future_departure_and_rounds_minutes_up() -> None:
    departure = datetime(2030, 1, 2, 15, 4, 5, tzinfo=timezone.utc)
    response = {
        "routes": [
            {
                "distanceMeters": 2100,
                "duration": "61.2s",
                "polyline": {"encodedPolyline": ""},
            }
        ]
    }

    with (
        patch.object(geo, "_api_key", return_value="not-a-real-key"),
        patch.object(geo, "_request", return_value=response) as request,
    ):
        route = geo.compute_route((-34.6, -58.4), (-34.61, -58.39), departure)

    payload = request.call_args.kwargs["json"]
    assert payload["travelMode"] == "DRIVE"
    assert payload["routingPreference"] == "TRAFFIC_AWARE"
    assert payload["departureTime"] == "2030-01-02T15:04:05Z"
    assert route.duration_min == 2
    assert route.distance_km == 2.1


def test_google_routes_omits_past_departure_and_does_not_add_a_minute() -> None:
    response = {"routes": [{"distanceMeters": 10, "duration": "0s"}]}
    past = datetime(2020, 1, 1, tzinfo=timezone.utc)

    with (
        patch.object(geo, "_api_key", return_value="not-a-real-key"),
        patch.object(geo, "_request", return_value=response) as request,
    ):
        route = geo.compute_route((-34.6, -58.4), (-34.61, -58.39), past)

    assert "departureTime" not in request.call_args.kwargs["json"]
    assert route.duration_min == 0


def test_geo_service_prefers_google_and_keeps_osm_as_fallback(monkeypatch) -> None:
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: SimpleNamespace(
            geo_enrichment_enabled=True,
            google_maps_api_key="configured",
            geo_fallback_enabled=True,
            nominatim_url="https://nominatim.example/search",
            routing_url="https://routing.example",
            geo_user_agent="tests",
            geo_timeout_seconds=1,
        ),
    )

    providers = service.get_geo_service.__wrapped__().providers

    assert [provider.name for provider in providers] == ["google", "osm"]


def test_geo_service_uses_only_osm_when_google_key_is_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: SimpleNamespace(
            geo_enrichment_enabled=True,
            google_maps_api_key="",
            geo_fallback_enabled=True,
            nominatim_url="https://nominatim.example/search",
            routing_url="https://routing.example",
            geo_user_agent="tests",
            geo_timeout_seconds=1,
        ),
    )

    providers = service.get_geo_service.__wrapped__().providers

    assert [provider.name for provider in providers] == ["osm"]


def test_geo_service_falls_back_to_osm_when_google_is_unavailable() -> None:
    class FakeProvider:
        def __init__(self, name: str, available: bool) -> None:
            self.name = name
            self.available = available

        def route(self, _origin, _destination, _departure_time=None):
            if not self.available:
                raise ProviderUnavailable("offline")
            return Route(2, 4, self.name)

    route_result = service.GeoEnrichmentService(
        [FakeProvider("google", False), FakeProvider("osm", True)]
    ).route((-34.6, -58.4), (-34.61, -58.39))

    assert route_result.status == GeoStatus.OK
    assert route_result.value.provider == "osm"


def test_geo_service_handles_a_provider_route_not_found() -> None:
    class NoRouteProvider:
        name = "google"

        def route(self, _origin, _destination, _departure_time=None):
            raise ProviderNotFound("No route")

    route_result = service.GeoEnrichmentService([NoRouteProvider()]).route(
        (-34.6, -58.4), (-34.61, -58.39)
    )

    assert route_result.status == GeoStatus.NOT_FOUND
    assert route_result.value is None


def test_scheduled_departure_uses_buenos_aires_local_time() -> None:
    future = datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")) + timedelta(days=2)

    departure = service.scheduled_departure(future.date(), time(future.hour, 30))

    assert departure is not None
    assert departure.tzinfo == ZoneInfo("America/Argentina/Buenos_Aires")
    assert departure.minute == 30


def test_scheduled_departure_is_not_sent_for_past_trips() -> None:
    assert service.scheduled_departure(date(2020, 1, 1), time(10)) is None
