from datetime import date, time
from types import SimpleNamespace

import pytest

from app.routers.api import availability_options


class _Scalars:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def all(self) -> list[object]:
        return self._rows


class _AvailabilityDb:
    def __init__(self) -> None:
        self._results = [[7], [SimpleNamespace(id=9)], []]

    def scalars(self, _statement: object) -> _Scalars:
        return _Scalars(self._results.pop(0))

    def get(self, _model: type, _key: int) -> object:
        return SimpleNamespace(margen_operativo_min=30)


@pytest.mark.parametrize(
    "start",
    [
        time(10, 0),
        time(8, 0),
        time(13, 0),
    ],
)
def test_partial_schedule_returns_neutral_options(start: time) -> None:
    result = availability_options(
        db=_AvailabilityDb(),
        fecha=date(2026, 9, 24),
        hora_desde=start,
        hora_hasta=None,
        carga_min=None,
        descarga_min=None,
        exclude=None,
    )

    assert result.schedule_verified is False
    assert result.drivers[0].blocked is False
    assert result.vehicles[0].blocked is False
    assert result.drivers[0].verified is False
    assert result.vehicles[0].verified is False
    assert result.drivers[0].warnings == []
    assert result.vehicles[0].warnings == []


def test_complete_schedule_runs_the_normal_resource_evaluation(monkeypatch) -> None:
    evaluations: list[tuple[int | None, int | None]] = []

    def evaluate(_db, _candidate, *, chofer_id, vehiculo_id, **_kwargs):
        evaluations.append((chofer_id, vehiculo_id))
        return SimpleNamespace(bloqueos=[], traslado_verificado=True)

    monkeypatch.setattr("app.routers.api.business.evaluar_agenda", evaluate)
    fecha = date(2026, 9, 24)

    result = availability_options(
        db=_AvailabilityDb(),
        fecha=fecha,
        hora_desde=time(10, 0),
        hora_hasta=time(12, 0),
        carga_min=60,
        descarga_min=45,
        exclude=None,
    )

    assert result.schedule_verified is True
    assert result.drivers[0].blocked is False
    assert result.drivers[0].verified is True
    assert result.drivers[0].warnings == []
    assert result.vehicles[0].blocked is False
    assert result.vehicles[0].verified is True
    assert result.vehicles[0].warnings == []
    assert evaluations == [(7, None), (None, 9)]
