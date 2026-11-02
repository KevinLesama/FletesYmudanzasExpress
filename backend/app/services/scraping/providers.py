from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.services import geo

from .schemas import Location, Route, Suggestion


class ProviderUnavailable(RuntimeError):
    pass


class ProviderNotFound(RuntimeError):
    pass


class GeoProvider(Protocol):
    name: str

    def search(self, query: str, limit: int) -> list[Suggestion]:
        ...

    def resolve(self, place_id: str) -> Location:
        ...

    def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> Route:
        ...

    def route_geometry(
        self, origin: tuple[float, float], destination: tuple[float, float]
    ) -> list[tuple[float, float]] | None:
        ...


class GoogleProvider:
    name = "google"

    def search(self, query: str, limit: int) -> list[Suggestion]:
        try:
            return [
                Suggestion(s.place_id, s.primary, s.secondary, self.name)
                for s in geo.search_places(query, limit)
            ]
        except (geo.GeoNotConfiguredError, geo.GeoUnavailableError) as exc:
            raise ProviderUnavailable(str(exc)) from exc

    def resolve(self, place_id: str) -> Location:
        try:
            place = geo.place_detail(place_id)
        except (geo.GeoNotConfiguredError, geo.GeoUnavailableError) as exc:
            raise ProviderUnavailable(str(exc)) from exc
        return Location(
            place.place_id,
            place.direccion,
            place.lat,
            place.lng,
            place.localidad,
            place.partido,
            place.provincia,
            self.name,
        )

    def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> Route:
        return self.route_with_geometry(origin, destination)[0]

    def route_with_geometry(
        self, origin: tuple[float, float], destination: tuple[float, float]
    ) -> tuple[Route, list[tuple[float, float]] | None]:
        try:
            route = geo.compute_route(origin, destination)
        except (geo.GeoNotConfiguredError, geo.GeoUnavailableError) as exc:
            raise ProviderUnavailable(str(exc)) from exc
        return Route(route.distance_km, route.duration_min, self.name), None

    def route_geometry(
        self, origin: tuple[float, float], destination: tuple[float, float]
    ) -> list[tuple[float, float]] | None:
        return None


@dataclass(frozen=True)
class OSMProvider:
    nominatim_url: str
    routing_url: str
    user_agent: str = "fletes-express/1.0"
    timeout_seconds: float = 6.0
    name: str = "osm"
    _route_geometry_cache: dict[
        tuple[float, float, float, float], list[tuple[float, float]] | None
    ] = field(default_factory=dict, init=False, repr=False, compare=False)

    @staticmethod
    def _route_key(
        origin: tuple[float, float], destination: tuple[float, float]
    ) -> tuple[float, float, float, float]:
        return (
            round(origin[0], 6),
            round(origin[1], 6),
            round(destination[0], 6),
            round(destination[1], 6),
        )

    def route_geometry(
        self, origin: tuple[float, float], destination: tuple[float, float]
    ) -> list[tuple[float, float]] | None:
        return self._route_geometry_cache.get(self._route_key(origin, destination))

    def _get(self, url: str, **params) -> list[dict]:
        try:
            response = httpx.get(
                url,
                params=params,
                headers={"User-Agent": self.user_agent},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailable("El proveedor geográfico no respondió.") from exc
        if not isinstance(data, list):
            raise ProviderUnavailable("Respuesta inválida del proveedor geográfico.")
        return data

    def _get_json(self, url: str, **params):
        try:
            response = httpx.get(
                url,
                params=params,
                headers={"User-Agent": self.user_agent},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailable("El proveedor geográfico no respondió.") from exc

    @staticmethod
    def _details_url(base_url: str) -> str:
        if "/search" in base_url:
            return base_url.replace("/search", "/details", 1)
        return base_url.rstrip("/") + "/details"

    @staticmethod
    def _reverse_url(base_url: str) -> str:
        if "/search" in base_url:
            return base_url.replace("/search", "/reverse", 1)
        return base_url.rstrip("/") + "/reverse"

    def search(self, query: str, limit: int) -> list[Suggestion]:
        rows = self._get(
            self.nominatim_url,
            q=query,
            format="jsonv2",
            addressdetails=1,
            limit=limit,
            countrycodes="ar",
        )
        return [
            Suggestion(
                place_id=str(row.get("place_id")),
                primary=str(row.get("display_name", "")).split(",")[0],
                secondary=str(row.get("display_name", "")),
                provider=self.name,
                lat=float(row["lat"]),
                lng=float(row["lon"]),
            )
            for row in rows
            if row.get("place_id") and row.get("lat") and row.get("lon")
        ]

    def resolve(self, place_id: str) -> Location:
        details_url = self._details_url(self.nominatim_url)
        row = self._get_json(
            details_url,
            format="json",
            place_id=place_id,
        )
        if not isinstance(row, dict):
            raise ProviderNotFound("No se encontró la ubicación.")
        geometry = row.get("centroid") or row.get("geometry") or {}
        coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
        if coordinates is None and row.get("lat") is not None and row.get("lon") is not None:
            lat = float(row.get("lat"))
            lng = float(row.get("lon"))
        else:
            try:
                lng, lat = float(coordinates[0]), float(coordinates[1])
            except (TypeError, ValueError, IndexError, KeyError) as exc:
                raise ProviderUnavailable("La ubicación no tiene coordenadas.") from exc
        address = str(row.get("display_name") or row.get("localname") or f"{lat}, {lng}").strip()
        return Location(place_id, address, lat, lng, provider=self.name)

    def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> Route:
        return self.route_with_geometry(origin, destination)[0]

    def route_with_geometry(
        self, origin: tuple[float, float], destination: tuple[float, float]
    ) -> tuple[Route, list[tuple[float, float]] | None]:
        url = f"{self.routing_url.rstrip('/')}/route/v1/driving/{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
        try:
            response = httpx.get(
                url,
                params={"overview": "full", "geometries": "geojson"},
                headers={"User-Agent": self.user_agent},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderUnavailable("El proveedor de rutas no respondió.") from exc
        routes = data.get("routes") if isinstance(data, dict) else None
        if not routes:
            raise ProviderNotFound("No se encontró una ruta.")
        first = routes[0]
        raw_geometry = first.get("geometry")
        raw_coordinates = (
            raw_geometry.get("coordinates")
            if isinstance(raw_geometry, dict) and raw_geometry.get("type") == "LineString"
            else None
        )
        geometry = None
        if raw_coordinates is not None:
            try:
                geometry = [(float(point[0]), float(point[1])) for point in raw_coordinates]
            except (TypeError, ValueError, IndexError) as exc:
                raise ProviderUnavailable("Respuesta inválida del proveedor de rutas.") from exc
        key = self._route_key(origin, destination)
        if key not in self._route_geometry_cache and len(self._route_geometry_cache) >= 256:
            self._route_geometry_cache.pop(next(iter(self._route_geometry_cache)))
        self._route_geometry_cache[key] = geometry
        route = Route(float(first["distance"]) / 1000, round(float(first["duration"]) / 60), self.name)
        return route, geometry
