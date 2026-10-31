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
    # Supabase Auth: la URL y la anon key se usan para validar los JWT.
    # La service_role_key queda reservada al backend (nunca al bundle).
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # Google Maps Platform (Places API New + Routes API). La key es del backend:
    # nunca se expone en el bundle del frontend.
    google_maps_api_key: str = ""
    # Enriquecimiento geográfico opcional. Google se reutiliza mediante geo.py;
    # el fallback OSM sólo se activa cuando sus endpoints están configurados.
    geo_enrichment_enabled: bool = True
    # Nominatim/OSRM permiten que el flujo siga funcionando sin una clave de
    # Google. Se puede desactivar explícitamente con GEO_FALLBACK_ENABLED=false.
    geo_fallback_enabled: bool = True
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    routing_url: str = "https://router.project-osrm.org"
    geo_user_agent: str = "fletes-express/1.0"
    geo_timeout_seconds: float = 6.0
    # Regla comercial: precio sugerido = costo del chofer * margen.
    pricing_margin: float = 1.5
    # Espera estandar de una mudanza, en minutos (ida, descarga y vuelta).
    default_wait_minutes: int = 120

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url.strip())

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_anon_key.strip())

    @property
    def service_role_configured(self) -> bool:
        return bool(self.supabase_service_role_key.strip())

    @property
    def geo_configured(self) -> bool:
        return bool(self.google_maps_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
