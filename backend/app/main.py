"""Punto de entrada de la API.

Ejecutar en local:
    uvicorn app.main:app --reload --port 8000

Documentacion interactiva: http://localhost:8000/docs
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.session import DatabaseNotConfiguredError
from app.routers.api import (
    availability_router,
    clients_router,
    drivers_router,
    geo_router,
    health_router,
    me_router,
    payments_router,
    pricing_router,
    requests_router,
    vehicles_router,
)
settings = get_settings()

app = FastAPI(
    title="Fletes Express API",
    description="Backend del sistema de gestión de fletes y mudanzas.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DatabaseNotConfiguredError)
async def database_not_configured_handler(
    _request: Request, exc: DatabaseNotConfiguredError
) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Base de datos no configurada. Definí DATABASE_URL en el archivo .env.",
        },
    )


api_prefix = "/api"
for router in (
    clients_router,
    drivers_router,
    vehicles_router,
    requests_router,
    payments_router,
    availability_router,
    geo_router,
    pricing_router,
    me_router,
):
    app.include_router(router, prefix=api_prefix)

app.include_router(health_router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"] = openapi_schema.get("components", {})
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    for path in openapi_schema["paths"].values():
        for operation in path.values():
            if isinstance(operation, dict) and "security" not in operation:
                # Solo agregar a endpoints que usan auth? mejor agregar a todos excepto health
                pass
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
