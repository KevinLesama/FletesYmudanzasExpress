"""Validacion de los JWT que emite Supabase Auth.

El navegador obtiene el token con supabase-js y lo manda como
`Authorization: Bearer <token>`. Aca se verifica la firma contra el JWKS del
proyecto y se extrae el rol desde `app_metadata` (el usuario no puede editarlo;
`user_metadata` si, por eso no se usa).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any, TypedDict

import httpx
import jwt
from fastapi import Depends, Header, HTTPException

from app.core.config import get_settings

JWKS_TTL_SECONDS = 3600
ROLES = ("admin", "coordinator", "driver")
ROLE_FALLBACK = "driver"  # minimo privilegio si el claim falta o es desconocido
UNAUTHORIZED_DETAIL = "Sesion invalida o vencida. Inicia sesion de nuevo."

_jwks_cache: dict[str, Any] = {"keys": [], "fetched_at": 0.0}


class CurrentUser(TypedDict):
    id: str
    email: str
    role: str


def _auth_url(path: str) -> str:
    return f"{get_settings().supabase_url.rstrip('/')}/auth/v1{path}"


def _get_jwks(force: bool = False) -> list[dict[str, Any]]:
    """Claves publicas del proyecto, cacheadas en memoria por una hora."""
    fresh = time.time() - _jwks_cache["fetched_at"] < JWKS_TTL_SECONDS
    if fresh and _jwks_cache["keys"] and not force:
        return _jwks_cache["keys"]
    response = httpx.get(_auth_url("/.well-known/jwks.json"), timeout=5)
    response.raise_for_status()
    keys = response.json().get("keys", [])
    _jwks_cache.update(keys=keys, fetched_at=time.time())
    return keys


def _decode_local(token: str) -> dict[str, Any]:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    keys = _get_jwks()
    if kid and not any(key.get("kid") == kid for key in keys):
        keys = _get_jwks(force=True)  # la clave roto: recargar una vez
    jwk = next((key for key in keys if key.get("kid") == kid), keys[0] if keys else None)
    if jwk is None:
        raise jwt.InvalidTokenError("JWKS sin claves")
    return jwt.decode(
        token,
        key=jwt.PyJWK(jwk).key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )


def _claims_from_user_endpoint(token: str) -> dict[str, Any]:
    """Fallback: valida el token contra GoTrue cuando el JWKS no responde."""
    settings = get_settings()
    response = httpx.get(
        _auth_url("/user"),
        headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        timeout=5,
    )
    response.raise_for_status()
    return response.json()


def verify_access_token(token: str) -> dict[str, Any]:
    try:
        return _decode_local(token)
    except Exception:
        return _claims_from_user_endpoint(token)


def _role_of(claims: dict[str, Any]) -> str:
    app_metadata = claims.get("app_metadata") or {}
    role = str(app_metadata.get("role") or ROLE_FALLBACK)
    return role if role in ROLES else ROLE_FALLBACK


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not get_settings().auth_configured:
        raise HTTPException(
            status_code=503,
            detail="Autenticacion no configurada. Defini SUPABASE_URL y SUPABASE_ANON_KEY en el backend.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Falta el token de sesion.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = verify_access_token(authorization.removeprefix("Bearer ").strip())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=UNAUTHORIZED_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(
        # El JWT trae `sub`; el endpoint /user de GoTrue trae `id`.
        id=str(claims.get("sub") or claims.get("id") or ""),
        email=str(claims.get("email") or ""),
        role=_role_of(claims),
    )


def require_role(*roles: str) -> Callable[..., CurrentUser]:
    """Dependency factory: 403 si el rol del usuario no esta en `roles`."""

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="No tenes permisos para esta accion.")
        return user

    return dependency
