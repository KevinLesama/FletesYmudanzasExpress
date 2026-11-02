"""Operaciones administrativas de Supabase Auth para el backend.

La clave service_role solo se usa desde FastAPI. Nunca debe llegar al frontend.
"""

from __future__ import annotations

import httpx

from app.core.config import Settings


class SupabaseAdminError(RuntimeError):
    """Error controlado al crear o eliminar una cuenta Auth."""


def _admin_headers(settings: Settings) -> dict[str, str]:
    if not settings.service_role_configured:
        raise SupabaseAdminError("La invitación de usuarios no está configurada.")
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def invite_user(email: str, settings: Settings) -> str:
    """Crea una cuenta no confirmada y envía la invitación de Auth."""
    try:
        response = httpx.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/invite",
            headers=_admin_headers(settings),
            json={"email": email, "redirect_to": settings.auth_invite_redirect_url},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise SupabaseAdminError("No se pudo contactar a Supabase Auth.") from exc

    if response.is_error:
        if response.status_code == 422:
            raise SupabaseAdminError("Ya existe una cuenta Auth con ese email.")
        raise SupabaseAdminError("Supabase Auth rechazó la invitación.")

    try:
        user_id = response.json().get("id")
    except ValueError as exc:
        raise SupabaseAdminError("Supabase Auth devolvió una respuesta inválida.") from exc
    if not user_id:
        raise SupabaseAdminError("Supabase Auth no devolvió el id de la cuenta.")
    return str(user_id)


def delete_user(user_id: str, settings: Settings) -> None:
    """Elimina una cuenta creada durante un alta que no pudo completarse."""
    try:
        response = httpx.delete(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}",
            headers=_admin_headers(settings),
            timeout=10,
        )
    except httpx.HTTPError:
        return
    if response.is_error:
        return
