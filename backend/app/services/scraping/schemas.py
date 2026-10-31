from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class GeoStatus(StrEnum):
    OK = "ok"
    NOT_FOUND = "not_found"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class Suggestion:
    place_id: str
    primary: str
    secondary: str | None = None
    provider: str = "unknown"
    lat: float | None = None
    lng: float | None = None


@dataclass(frozen=True)
class Location:
    place_id: str | None
    address: str
    lat: float
    lng: float
    locality: str | None = None
    partido: str | None = None
    province: str | None = None
    provider: str = "unknown"


@dataclass(frozen=True)
class Route:
    distance_km: float
    duration_min: int
    provider: str = "unknown"


@dataclass(frozen=True)
class GeoResult:
    status: GeoStatus
    value: object | None = None
    message: str | None = None
