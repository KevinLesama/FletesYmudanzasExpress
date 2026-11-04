from __future__ import annotations

import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from app.services.scraping.providers import OSMProvider, ProviderUnavailable
from app.services.scraping.schemas import Location, Route, Suggestion
from app.services.scraping.service import GeoEnrichmentService


class FakeProvider:
    name = "fake"

    def __init__(self, *, available: bool = True, suggestions=None):
        self.available = available
        self.suggestions = suggestions or []
        self.search_calls = 0
        self.route_calls = 0

    def search(self, query: str, limit: int):
        self.search_calls += 1
        if not self.available:
            raise ProviderUnavailable("offline")
        return self.suggestions[:limit]

    def resolve(self, place_id: str):
        if not self.available:
            raise ProviderUnavailable("offline")
        return Location(place_id, "Calle 123", -34.6, -58.4, provider=self.name)

    def route(self, origin, destination, departure_time=None):
        self.route_calls += 1
        if not self.available:
            raise ProviderUnavailable("offline")
        return Route(2.2, 30, self.name)


class ScrapingServiceTests(unittest.TestCase):
    def test_search_and_cache(self):
        provider = FakeProvider(suggestions=[Suggestion("1", "Caballito")])
        service = GeoEnrichmentService([provider])
        first = service.search(" Caballito ")
        second = service.search("caballito")
        self.assertEqual(first.value[0].primary, "Caballito")
        self.assertIs(first, second)
        self.assertEqual(provider.search_calls, 1)

    def test_route_rounds_up(self):
        result = GeoEnrichmentService([FakeProvider()]).route((-34.6, -58.4), (-34.7, -58.5))
        self.assertEqual(result.value.distance_km, 3)
        self.assertEqual(result.value.duration_min, 30)

    def test_unavailable_route_is_retried_after_provider_recovers(self):
        provider = FakeProvider(available=False)
        service = GeoEnrichmentService([provider])
        origin, destination = (-34.6, -58.4), (-34.7, -58.5)

        first = service.route(origin, destination)
        provider.available = True
        second = service.route(origin, destination)

        self.assertEqual(first.status.value, "unavailable")
        self.assertEqual(second.status.value, "ok")
        self.assertEqual(provider.route_calls, 2)

    def test_route_cache_varies_by_scheduled_departure(self):
        provider = FakeProvider()
        service = GeoEnrichmentService([provider])
        origin, destination = (-34.6, -58.4), (-34.7, -58.5)
        first_departure = datetime(2030, 1, 1, 10, tzinfo=timezone.utc)
        second_departure = datetime(2030, 1, 1, 11, tzinfo=timezone.utc)

        service.route(origin, destination, first_departure)
        service.route(origin, destination, second_departure)

        self.assertEqual(provider.route_calls, 2)

    def test_fallback_provider(self):
        result = GeoEnrichmentService([FakeProvider(available=False), FakeProvider()]).route(
            (-34.6, -58.4), (-34.7, -58.5)
        )
        self.assertEqual(result.status.value, "ok")

    def test_unavailable_is_explicit(self):
        result = GeoEnrichmentService([FakeProvider(available=False)]).search("Caballito")
        self.assertEqual(result.status.value, "unavailable")

    @patch("app.services.scraping.providers.httpx.get")
    def test_osm_resolve_uses_nominatim_details_endpoint(self, mock_get):
        detail_response = Mock()
        detail_response.raise_for_status.return_value = None
        detail_response.json.return_value = {
            "place_id": 17527705,
            "centroid": {"coordinates": [-58.3697268, -34.6029769]},
            "display_name": "Leandro N. Alem, Buenos Aires",
        }

        mock_get.side_effect = [detail_response]

        provider = OSMProvider(
            nominatim_url="https://nominatim.openstreetmap.org/search",
            routing_url="https://router.project-osrm.org",
        )

        result = provider.resolve("17527705")

        self.assertEqual(result.lat, -34.6029769)
        self.assertEqual(result.lng, -58.3697268)
        self.assertEqual(result.address, "Leandro N. Alem, Buenos Aires")
        self.assertEqual(mock_get.call_args_list[0].kwargs["params"]["format"], "json")

    @patch("app.services.scraping.providers.httpx.get")
    def test_osm_route_rounds_duration_up_to_whole_minutes(self, mock_get):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "routes": [
                {
                    "distance": 2100,
                    "duration": 61,
                    "geometry": {"type": "LineString", "coordinates": []},
                }
            ]
        }
        mock_get.return_value = response
        provider = OSMProvider(
            nominatim_url="https://nominatim.openstreetmap.org/search",
            routing_url="https://router.project-osrm.org",
        )

        route = provider.route((-34.6, -58.4), (-34.61, -58.39))

        self.assertEqual(route.duration_min, 2)


if __name__ == "__main__":
    unittest.main()
