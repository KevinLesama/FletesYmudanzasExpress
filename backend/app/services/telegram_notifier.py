"""Avisos por Telegram de nuevas solicitudes.

El envio es best-effort: si falta configuracion, Telegram no responde o el
mensaje falla, el alta de la solicitud ya persistida nunca se ve afectada.

Las credenciales viven exclusivamente en el .env del backend; el token nunca
llega al frontend ni se escribe en logs.
"""
from __future__ import annotations

import logging
import os
from html import escape
from typing import Any
from urllib.parse import quote, urlparse, urlunparse

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"
_MAX_MESSAGE_LENGTH = 4000


def _get_web_base_url() -> str:
    settings = get_settings()
    base = getattr(settings, "web_base_url", None) or os.getenv("WEB_BASE_URL") or "http://localhost:8080"
    parsed = urlparse(str(base).strip())

    # Telegram rechaza "localhost" y "127.0.0.1" en botones inline_keyboard.
    # 127.0.0.1.nip.io resuelve a 127.0.0.1 en tu PC pero Telegram lo valida como dominio real.
    if (parsed.hostname or "").lower() in {"localhost", "127.0.0.1", "0.0.0.0"}:
        port = f":{parsed.port}" if parsed.port else ""
        parsed = parsed._replace(netloc=f"127.0.0.1.nip.io{port}")

    return urlunparse(parsed).rstrip("/")


def build_new_request_reply_markup(data: dict) -> dict | None:
    codigo = str(data.get("codigo") or data.get("id") or "").strip()
    if not codigo:
        return None

    url = f"{_get_web_base_url()}/planificacion?id={quote(codigo)}"
    return {
        "inline_keyboard": [
            [
                {
                    "text": "🌐 Ver en la web",
                    "url": url,
                }
            ]
        ]
    }


def _fmt_money(value: float | None) -> str | None:
    if value is None:
        return None
    return f"${value:,.0f}".replace(",", ".")


def _fmt_km(value: float | None) -> str | None:
    if value is None:
        return None
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    return f"{text} km"


def _fmt_date(value: Any) -> str:
    text = str(value or "")[:10]
    parts = text.split("-")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return text


def _place_lines(
    icon: str,
    title: str,
    *,
    address: Any,
    barrio: Any,
    floor: Any,
    elevator: Any,
    notes: Any,
) -> list[str]:
    value = str(address or "").strip() or "Sin direccion"
    barrio_text = str(barrio or "").strip()
    if barrio_text:
        value = f"{value} ({barrio_text})"

    lines = [f"{icon} <b>{title}:</b> {escape(value)}"]

    extras: list[str] = []
    if floor:
        extras.append(f"piso {escape(str(floor))}")
    if elevator is not None:
        extras.append("con ascensor" if elevator else "sin ascensor")
    if extras:
        lines.append("   " + " · ".join(extras))
    if notes:
        lines.append(f"   📝 {escape(str(notes))}")
    return lines


def build_new_request_message(data: dict, source: str | None = None) -> str:
    codigo = str(data.get("codigo") or data.get("id") or "").strip()
    lines: list[str] = [f"🚚 <b>Nueva solicitud</b>{f' {escape(codigo)}' if codigo else ''}"]

    name = str(data.get("client_name") or "").strip()
    phone = str(data.get("phone") or "").strip()
    if name:
        lines.append(f"👤 <b>Solicitante:</b> {escape(name)}")
    if phone:
        lines.append(f" <b>Telefono:</b> {escape(phone)}")

    fecha = _fmt_date(data.get("date"))
    desde = str(data.get("arrival_from") or "").strip()
    hasta = str(data.get("arrival_to") or "").strip()
    if fecha:
        horario = f" de {desde} a {hasta}" if desde and hasta else ""
        lines.append(f" <b>Fecha:</b> {fecha}{horario}")

    lines.extend(
        _place_lines(
            "📍",
            "Origen",
            address=data.get("origin_address"),
            barrio=data.get("origin_barrio"),
            floor=data.get("origin_floor"),
            elevator=data.get("origin_elevator"),
            notes=data.get("origen_notas"),
        )
    )
    lines.extend(
        _place_lines(
            "🏁",
            "Destino",
            address=data.get("destination_address"),
            barrio=data.get("destination_barrio"),
            floor=data.get("destination_floor"),
            elevator=data.get("destination_elevator"),
            notes=data.get("destino_notas"),
        )
    )

    items = data.get("items_carga") or []
    if items:
        lines.append("📦 <b>Carga:</b>")
        for item in items:
            descripcion = escape(str(item.get("descripcion") or "Sin descripcion"))
            cantidad = item.get("cantidad") or 1
            detalle = f"   • {cantidad} × {descripcion}"
            if item.get("fragil"):
                detalle += " (frágil)"
            if item.get("nota"):
                detalle += f" — {escape(str(item['nota']))}"
            lines.append(detalle)
    else:
        lines.append("📦 <b>Carga:</b> sin detalle")

    distancia = _fmt_km(data.get("distance_km"))
    total = _fmt_km(data.get("total_km"))
    if distancia:
        extra = f" (total ida y vuelta: {total})" if total and total != distancia else ""
        lines.append(f"📏 <b>Distancia:</b> {distancia}{extra}")
    else:
        lines.append("📏 <b>Distancia:</b> no calculada")

    eta = data.get("eta_minutes")
    if eta:
        lines.append(f"⏱ <b>Duracion ida:</b> {int(eta)} min")
    wait = data.get("wait_minutes")
    if wait:
        lines.append(f" <b>Espera:</b> {int(wait)} min")

    price = _fmt_money(data.get("price"))
    deposit = _fmt_money(data.get("deposit_required"))
    if price:
        extra = f" (seña {deposit})" if deposit else ""
        lines.append(f"💰 <b>Precio:</b> {price}{extra}")

    notas = str(data.get("notas") or "").strip()
    if notas:
        lines.append(f"🗒️ <b>Notas:</b> {escape(notas)}")

    if source:
        lines.append(f"📲 <b>Canal:</b> {escape(source)}")

    text = "\n".join(lines)
    if len(text) > _MAX_MESSAGE_LENGTH:
        text = text[: _MAX_MESSAGE_LENGTH - 1] + "…"
    return text


def notify_new_request(data: dict, source: str | None = None) -> None:
    """Envia el aviso a Telegram. Nunca levanta excepciones."""
    try:
        settings = get_settings()
        if not settings.telegram_configured:
            return

        api_url = _TELEGRAM_API_URL.format(token=settings.telegram_bot_token.strip())
        payload: dict[str, Any] = {
            "chat_id": settings.telegram_chat_id.strip(),
            "text": build_new_request_message(data, source),
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        reply_markup = build_new_request_reply_markup(data)
        if reply_markup:
            payload["reply_markup"] = reply_markup

        response = httpx.post(
            api_url,
            json=payload,
            timeout=settings.telegram_timeout_seconds,
        )

        # Si Telegram rechaza la URL del boton (ej. configuracion invalida), reintenta sin boton
        if response.status_code == 400 and "reply_markup" in payload:
            logger.warning("Telegram rechazo reply_markup (400); reintentando envio sin boton.")
            payload.pop("reply_markup", None)
            response = httpx.post(
                api_url,
                json=payload,
                timeout=settings.telegram_timeout_seconds,
            )

        if response.status_code >= 400:
            logger.warning(
                "Telegram rechazo el aviso de solicitud (status %s)", response.status_code
            )
    except httpx.HTTPError as exc:
        # Se registra solo el tipo: el mensaje de httpx puede incluir la URL con el token.
        logger.warning("No se pudo enviar el aviso de solicitud a Telegram (%s)", type(exc).__name__)