"""Configuracion de la aplicacion.

Las credenciales se leen exclusivamente desde variables de entorno (archivo .env
en local o variables del contenedor). Nunca se escriben en el codigo.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "local"
    # Por defecto sin base de datos: permite arrancar la API en modo "sin DB"
    # (por ejemplo para ver /docs). Si esta vacio, los endpoints devuelven 503.
    database_url: str = ""
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
