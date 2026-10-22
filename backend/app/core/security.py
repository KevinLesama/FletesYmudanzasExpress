"""Validacion de los JWT que emite Supabase Auth.

El navegador obtiene el token con supabase-js y lo manda como
`Authorization: Bearer <token>`. Aca se verifica la firma contra el JWKS del
proyecto y se resuelve el usuario de la app (tabla `usuarios`).

El rol NO se saca del token: la fuente de verdad es `usuarios.rol`, para que
habilitar o cambiar permisos sea una operacion de la app y no del dashboard de
Supabase. La cuenta de login se vincula al usuario por `auth_user_id` o, en el
primer ingreso, por email.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable
from typing import Any, TypedDict

import httpx
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import User

JWKS_TTL_SECONDS = 3600
# Roles con acceso a la API. 'cliente' no se loguea: es un contacto de la
# empresa de mudanzas, no un usuario del sistema.
ROLES = ("admin", "chofer")
UNAUTHORIZED_DETAIL = "Sesion invalida o vencida. Inicia sesion de nuevo."
NO_VINCULADO_DETAIL = "Tu cuenta de acceso no esta vinculada a un usuario de Fletes."

_jwks_cache: dict[str, Any] = {"keys": [], "fetched_at": 0.0}


class CurrentUser(TypedDict):
    """Identidad resuelta: token de Supabase + usuario de la app."""

    auth_id: str
    email: str
    user_id: str
    role: str
    name: str


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


def _as_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None


def _resolve_by_email(db: Session, email: str) -> User | None:
    """Busca el usuario de la app por email (sin distinguir mayusculas)."""
    if not email:
        return None
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


def _resolve_app_user(db: Session, auth_id: str, email: str) -> User | None:
    """Busca el usuario de la app por auth_user_id y, si no hay, por email."""
    auth_uuid = _as_uuid(auth_id)
    if auth_uuid is not None:
        user = db.scalar(select(User).where(User.auth_user_id == auth_uuid))
        if user is not None:
            return user
    user = _resolve_by_email(db, email)
    if user is not None and user.auth_user_id is None and auth_uuid is not None:
        # Primer ingreso: se vincula la cuenta de Supabase al usuario de la app.
        user.auth_user_id = auth_uuid
        db.commit()
    return user


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    settings = get_settings()

    if not settings.auth_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "Autenticacion no configurada. Defini SUPABASE_URL y SUPABASE_ANON_KEY "
                "en el backend."
            ),
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Falta el token de sesion.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.removeprefix("Bearer ").strip()
    auth_id = ""
    email = ""

    try:
        claims = verify_access_token(token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=UNAUTHORIZED_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # El JWT trae `sub`; el endpoint /user de GoTrue trae `id`.
    auth_id = str(claims.get("sub") or claims.get("id") or "")
    email = str(claims.get("email") or "")
    user = _resolve_app_user(db, auth_id, email)
    if user is None:
        raise HTTPException(status_code=403, detail=NO_VINCULADO_DETAIL)

    if user.status != "Activo":
        raise HTTPException(
            status_code=403, detail="Tu usuario esta inactivo. Contacta a la administracion."
        )
    if user.role not in ROLES:
        raise HTTPException(status_code=403, detail="Tu rol no tiene acceso a la aplicacion.")
    return CurrentUser(
        auth_id=auth_id,
        email=email,
        user_id=user.id,
        role=user.role,
        name=user.name,
    )


def require_role(*roles: str) -> Callable[..., CurrentUser]:
    """Dependency factory: 403 si el rol del usuario no esta en `roles`."""

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="No tenes permisos para esta accion.")
        return user

    return dependency
