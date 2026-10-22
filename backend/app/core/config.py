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
    # Supabase Auth: la URL y la anon key se usan para validar los JWT que
    # envia el navegador. Son publicas. La service_role_key queda reservada
    # para el backend (nunca al bundle del frontend).
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url.strip())

    @property
    def auth_configured(self) -> bool:
        """Sin estas dos variables la API no puede validar los tokens."""
        return bool(self.supabase_url.strip() and self.supabase_anon_key.strip())

    @property
    def service_role_configured(self) -> bool:
        """Reservada para el alta de cuentas de Supabase (feature pendiente)."""
        return bool(self.supabase_service_role_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
