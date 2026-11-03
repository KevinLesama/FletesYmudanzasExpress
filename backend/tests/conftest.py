"""Configuracion compartida de las pruebas del backend.

Las pruebas estan separadas en dos carriles:

* ``tests/unit/``: logica pura. No tocan base de datos, red ni disco.
* ``tests/pg/``: integracion contra un PostgreSQL real. Solo corren cuando
  esta definida ``FEX_TEST_DATABASE_URL``; si no, se omiten.

Este archivo no importa la aplicacion ni abre conexiones: puede cargarse
siempre, aun cuando no haya base de datos disponible.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Permite `import app...` sin depender del directorio desde el que se invoca
# pytest (raiz del repo o `backend/`).
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Etiqueta cada prueba segun su carpeta: ``-m unit`` / ``-m pg``.

    Asi no hace falta repetir el marcador en cada test y es imposible olvidarlo
    al agregar archivos nuevos.
    """
    for item in items:
        path = Path(str(item.path)).as_posix()
        if "/tests/pg/" in path:
            item.add_marker(pytest.mark.pg)
        elif "/tests/unit/" in path:
            item.add_marker(pytest.mark.unit)
