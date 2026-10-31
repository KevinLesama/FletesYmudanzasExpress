"""Geolocalizacion con Google Maps Platform.

Dos APIs, ambas del lado servidor:

* Places API (New)  -> autocompletado de direcciones y detalle de un lugar.
* Routes API (v2)   -> distancia y duracion de un viaje en auto.

La key vive en `GOOGLE_MAPS_API_KEY` y nunca viaja al frontend. Si falta o el
servicio falla se lanza una excepcion propia: el llamador decide el codigo HTTP
y NUNCA se inventan distancias, tiempos ni precios.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PLACES_URL = "https://places.googleapis.com/v1/places"
AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

TIMEOUT_SECONDS = 6.0
# Regiones donde opera la empresa: evita sugerencias de otros paises.
REGION_CODES = ["ar"]


class GeoNotConfiguredError(RuntimeError):
    """Falta GOOGLE_MAPS_API_KEY en el backend."""


class GeoUnavailableError(RuntimeError):
    """Google Maps no respondio o devolvio un error."""


@dataclass(frozen=True)
class PlaceSuggestion:
    place_id: str
    primary: str
    secondary: str | None


@dataclass(frozen=True)
class PlaceDetail:
    place_id: str
    direccion: str
    lat: float
    lng: float
    localidad: str | None
    partido: str | None
    provincia: str | None


@dataclass(frozen=True)
class RouteEstimate:
    distance_km: float
    duration_min: int


def _api_key() -> str:
    key = get_settings().google_maps_api_key.strip()
    if not key:
        raise GeoNotConfiguredError("Falta GOOGLE_MAPS_API_KEY.")
    return key


def _request(method: str, url: str, *, headers: dict, **kwargs) -> dict:
    """Ejecuta la llamada y traduce cualquier falla a GeoUnavailableError."""
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.request(method, url, headers=headers, **kwargs)
    except httpx.HTTPError as exc:
        logger.warning("Google Maps no respondio (%s): %s", url, exc)
        raise GeoUnavailableError("El servicio de mapas no respondio.") from exc

    if response.status_code >= 400:
        # Se registra el estado y el cuerpo acotado, nunca la key.
        logger.warning(
            "Google Maps devolvio %s en %s: %s",
            response.status_code,
            url,
            response.text[:300],
        )
        raise GeoUnavailableError(
            f"El servicio de mapas devolvio un error ({response.status_code})."
        )

    try:
        return response.json()
    except ValueError as exc:
        raise GeoUnavailableError("Respuesta invalida del servicio de mapas.") from exc


def _component(components: list[dict], *types: str) -> str | None:
    for component in components or []:
        if any(t in (component.get("types") or []) for t in types):
            text = component.get("longText") or component.get("shortText")
            if text:
                return str(text)
    return None


def search_places(query: str, limit: int = 5) -> list[PlaceSuggestion]:
    """Autocompletado de direcciones restringido a Argentina."""
    data = _request(
        "POST",
        AUTOCOMPLETE_URL,
        headers={
            "X-Goog-Api-Key": _api_key(),
            "Content-Type": "application/json",
        },
        json={
            "input": query.strip(),
            "languageCode": "es-419",
            "regionCode": "AR",
            "includedRegionCodes": REGION_CODES,
        },
    )

    suggestions: list[PlaceSuggestion] = []
    for item in data.get("suggestions") or []:
        prediction = item.get("placePrediction") or {}
        place_id = prediction.get("placeId")
        if not place_id:
            continue
        text = (prediction.get("text") or {}).get("text") or ""
        structured = prediction.get("structuredFormat") or {}
        primary = (structured.get("mainText") or {}).get("text") or text
        secondary = (structured.get("secondaryText") or {}).get("text") or None
        suggestions.append(
            PlaceSuggestion(
                place_id=str(place_id),
                primary=str(primary).strip(),
                secondary=str(secondary).strip() if secondary else None,
            )
        )
        if len(suggestions) >= limit:
            break
    return suggestions


def place_detail(place_id: str) -> PlaceDetail:
    """Direccion normalizada, coordenadas y jurisdiccion de un lugar."""
    data = _request(
        "GET",
        f"{PLACES_URL}/{place_id}",
        headers={
            "X-Goog-Api-Key": _api_key(),
            "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
        },
        params={"languageCode": "es-419"},
    )

    location = data.get("location") or {}
    lat = location.get("latitude")
    lng = location.get("longitude")
    if lat is None or lng is None:
        raise GeoUnavailableError("El lugar no tiene coordenadas.")

    components = data.get("addressComponents") or []
    return PlaceDetail(
        place_id=str(data.get("id") or place_id),
        direccion=str(data.get("formattedAddress") or "").strip(),
        lat=float(lat),
        lng=float(lng),
        localidad=_component(components, "locality", "sublocality_level_1", "postal_town"),
        partido=_component(components, "administrative_area_level_2"),
        provincia=_component(components, "administrative_area_level_1"),
    )


def compute_route(origin: tuple[float, float], destination: tuple[float, float]) -> RouteEstimate:
    """Distancia y duracion en auto entre dos coordenadas (lat, lng)."""
    def _point(coords: tuple[float, float]) -> dict:
        return {"location": {"latLng": {"latitude": coords[0], "longitude": coords[1]}}}

    data = _request(
        "POST",
        ROUTES_URL,
        headers={
            "X-Goog-Api-Key": _api_key(),
            "Content-Type": "application/json",
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        json={
            "origin": _point(origin),
            "destination": _point(destination),
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE",
            "computeAlternativeRoutes": False,
            "languageCode": "es-419",
            "units": "METRIC",
        },
    )

    routes = data.get("routes") or []
    if not routes:
        raise GeoUnavailableError("Google Maps no encontro una ruta entre los puntos.")

    route = routes[0]
    distance_m = route.get("distanceMeters")
    if distance_m is None:
        raise GeoUnavailableError("La ruta no tiene distancia.")

    duration_raw = str(route.get("duration") or "0s").rstrip("s")
    try:
        duration_s = int(float(duration_raw))
    except ValueError:
        duration_s = 0

    return RouteEstimate(
        distance_km=float(distance_m) / 1000.0,
        duration_min=max(duration_s // 60, 1),
    )
