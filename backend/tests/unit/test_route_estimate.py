from __future__ import annotations

from datetime import date, time, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import api
from app.services.scraping.schemas import GeoResult, GeoStatus, Route


class FakeSession:
    def __init__(self) -> None:
        self.commits = 0

    def commit(self) -> None:
        self.commits += 1

    def refresh(self, _request: object) -> None:
        pass


def _request(**overrides: object) -> SimpleNamespace:
    defaults = {
        "origen_lat": -34.6037,
        "origen_lng": -58.3816,
        "destino_lat": -34.6083,
        "destino_lng": -58.3702,
        "duracion_ida_min": None,
        "fecha": date.today() + timedelta(days=2),
        "hora_desde": time(11),
        "duracion_vuelta_min": None,
        "km_estimados": None,
        "km_vuelta": None,
        "km_total": None,
        "carga_min": 60,
        "horas_estimadas": None,
    }
    return SimpleNamespace(**(defaults | overrides))


def test_route_estimate_persists_route_data(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()
    session = FakeSession()

    class FakeGeo:
        def route(self, _origin, _destination, departure_time=None) -> GeoResult:
            assert departure_time is not None
            assert departure_time.hour == 11
            return GeoResult(GeoStatus.OK, Route(12, 42, "test"))

    monkeypatch.setattr(api, "_get_request_or_404", lambda _db, _ref: request)
    monkeypatch.setattr(api, "get_geo_service", lambda: FakeGeo())
    monkeypatch.setattr(api.serializers, "serialize_solicitud", lambda _request: {"ok": True})

    result = api.estimate_request_route("request-1", session)

    assert result == {"ok": True}
    assert session.commits == 1
    assert request.duracion_ida_min == 42
    assert request.duracion_vuelta_min == 42
    assert request.km_estimados == 12
    assert request.km_vuelta == 12
    assert request.km_total == 24
    assert request.horas_estimadas == 2.4


def test_route_estimate_rejects_missing_coordinates(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request(destino_lat=None)
    monkeypatch.setattr(api, "_get_request_or_404", lambda _db, _ref: request)

    with pytest.raises(HTTPException) as error:
        api.estimate_request_route("request-1", FakeSession())

    assert error.value.status_code == 409
    assert "coordenadas" in error.value.detail.lower()


def test_route_estimate_reports_unavailable_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    request = _request()

    class FakeGeo:
        def route(self, _origin, _destination, departure_time=None) -> GeoResult:
            return GeoResult(GeoStatus.UNAVAILABLE, message="Proveedor no disponible.")

    monkeypatch.setattr(api, "_get_request_or_404", lambda _db, _ref: request)
    monkeypatch.setattr(api, "get_geo_service", lambda: FakeGeo())

    with pytest.raises(HTTPException) as error:
        api.estimate_request_route("request-1", FakeSession())

    assert error.value.status_code == 503
    assert error.value.detail == "Proveedor no disponible."
