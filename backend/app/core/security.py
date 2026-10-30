"""Validacion de los JWT que emite Supabase Auth y resolucion del rol.

El navegador obtiene el token con supabase-js y lo manda como
`Authorization: Bearer <token>`. Aca se verifica la firma contra el JWKS del
proyecto y se resuelve quien es la persona contra la tabla `usuarios`.

El rol NO viaja en el token: sale de `usuarios.rol` (esquema nuevo). Asi un
cambio de permisos en el panel tiene efecto inmediato, sin esperar a que
venza el JWT. Solo `administrador` y `chofer` pueden iniciar sesion; los
clientes son contactos, no cuentas del sistema.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any, TypedDict

import httpx
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db

JWKS_TTL_SECONDS = 3600
ROLES = ("administrador", "chofer")
UNAUTHORIZED_DETAIL = "Sesion invalida o vencida. Inicia sesion de nuevo."
SIN_PERFIL_DETAIL = "Tu cuenta no esta habilitada como personal de la empresa."
DESHABILITADO_DETAIL = "Tu usuario esta deshabilitado. Hablá con administración."

_jwks_cache: dict[str, Any] = {"keys": [], "fetched_at": 0.0}

# Un email identifica a una sola persona (indice unico global). La vista
# `v_personal` (auth.sql) ya deja afuera a los clientes: son contactos, no
# cuentas del sistema, aunque tengan email cargado.
_BUSCAR_USUARIO = text(
    """
    SELECT id, nombre, rol, activo, auth_user_id
      FROM v_personal
     WHERE auth_user_id = :auth_id
        OR (auth_user_id IS NULL AND lower(email) = lower(:email))
     LIMIT 1
    """
)

_VINCULAR_USUARIO = text(
    "UPDATE usuarios SET auth_user_id = :auth_id WHERE id = :usuario_id"
)


class CurrentUser(TypedDict):
    id: str  # id de la cuenta en Supabase Auth (JWT `sub`)
    email: str
    rol: str  # administrador | chofer
    usuario_id: int  # id en public.usuarios
    nombre: str


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


def _resolver_usuario(db: Session, auth_id: str, email: str) -> CurrentUser:
    """Busca el perfil por `auth_user_id` o, en el primer ingreso, por email."""
    try:
        fila = db.execute(
            _BUSCAR_USUARIO, {"auth_id": auth_id or None, "email": email or ""}
        ).mappings().first()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudo resolver el usuario. Verificá que el esquema nuevo esté aplicado.",
        ) from exc

    if fila is None:
        raise HTTPException(status_code=403, detail=SIN_PERFIL_DETAIL)

    if not fila["activo"]:
        raise HTTPException(status_code=403, detail=DESHABILITADO_DETAIL)

    # Primer ingreso: la cuenta existe en Auth pero todavia no estaba vinculada.
    if fila["auth_user_id"] is None and auth_id:
        db.execute(_VINCULAR_USUARIO, {"auth_id": auth_id, "usuario_id": fila["id"]})
        db.commit()

    return CurrentUser(
        id=auth_id,
        email=email,
        rol=str(fila["rol"]),
        usuario_id=int(fila["id"]),
        nombre=str(fila["nombre"]),
    )


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
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

    # El JWT trae `sub`; el endpoint /user de GoTrue trae `id`.
    auth_id = str(claims.get("sub") or claims.get("id") or "")
    email = str(claims.get("email") or "")
    if not auth_id and not email:
        raise HTTPException(
            status_code=401,
            detail=UNAUTHORIZED_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _resolver_usuario(db, auth_id, email)


def require_role(*roles: str) -> Callable[..., CurrentUser]:
    """Dependency factory: 403 si el rol del usuario no esta en `roles`."""

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user["rol"] not in roles:
            raise HTTPException(status_code=403, detail="No tenes permisos para esta accion.")
        return user

    return dependency
