"""Serializacion de entidades ORM a los esquemas de salida."""

from __future__ import annotations

from app.models import Solicitud, Usuario, Vehiculo
from app.schemas import (
    ItemCargaOut,
    PagoOut,
    UsuarioOut,
    VehiculoOut,
)
from app.services import pricing


def serialize_usuario(usuario: Usuario) -> UsuarioOut:
    return UsuarioOut.model_validate(usuario)


def serialize_vehiculo(vehiculo: Vehiculo) -> VehiculoOut:
    return VehiculoOut.model_validate(vehiculo)


def serialize_solicitud(solicitud: Solicitud) -> dict:
    items_list = getattr(solicitud, "items_carga", None) or []
    pagos_list = getattr(solicitud, "pagos", None) or []

    items = [
        ItemCargaOut(
            id=i.id,
            descripcion=i.descripcion,
            cantidad=i.cantidad,
            fragil=i.fragil,
            nota=i.nota,
            posicion=i.posicion,
        )
        for i in items_list
    ]
    pagos = [
        PagoOut(
            id=p.id,
            solicitud_id=p.solicitud_id,
            concepto=getattr(p, "concepto", getattr(p, "concept", None)),
            metodo=p.metodo,
            monto=float(p.monto),
            fecha=p.fecha,
            recibido_por_id=p.recibido_por_id,
            comprobante_ruta=p.comprobante_ruta,
            comprobante_nombre=p.comprobante_nombre,
            notas=p.notas,
        )
        for p in pagos_list
    ]
    precio_calculado = float(solicitud.precio_calculado) if solicitud.precio_calculado is not None else None
    precio_final = float(solicitud.precio_final)
    precio_editado = (
        solicitud.precio_calculado is not None and precio_final != precio_calculado
    )
    # La sena no se guarda: siempre es el 50 % del precio acordado.
    sena_requerida = float(pricing.sena(precio_final))

    cliente = getattr(solicitud, "cliente", None)
    client_name = getattr(cliente, "nombre", None) or solicitud.notas or ""
    phone = getattr(cliente, "telefono", None) or ""

    cargo_items = [
        {"name": i.descripcion, "units": i.cantidad, "note": i.nota}
        for i in items
    ]

    pagos_legacy = [
        {
            "id": p.id,
            "concept": p.concepto,
            "method": p.metodo,
            "received_by": p.recibido_por_id,
            "amount": float(p.monto),
            "date": p.fecha.isoformat() if hasattr(p.fecha, "isoformat") else p.fecha,
            "notes": p.notas,
        }
        for p in pagos
    ]

    sena_total = sum(
        (float(p.monto) for p in pagos_list if getattr(p, "concepto", getattr(p, "concept", None)) == "sena"),
        0.0,
    )

    data = {
        "id": solicitud.id,
        "codigo": solicitud.codigo,
        "cliente_id": solicitud.cliente_id,
        "cliente_rol": solicitud.cliente_rol,
        "estado": solicitud.estado,
        "fecha": solicitud.fecha.isoformat() if hasattr(solicitud.fecha, "isoformat") else solicitud.fecha,
        "hora_desde": solicitud.hora_desde.isoformat() if hasattr(solicitud.hora_desde, "isoformat") else solicitud.hora_desde,
        "hora_hasta": solicitud.hora_hasta.isoformat() if hasattr(solicitud.hora_hasta, "isoformat") else solicitud.hora_hasta,
        "origen_direccion": solicitud.origen_direccion,
        "origen_barrio": solicitud.origen_barrio,
        "origen_piso": solicitud.origen_piso,
        "origen_ascensor": solicitud.origen_ascensor,
        "origen_notas": solicitud.origen_notas,
        "destino_direccion": solicitud.destino_direccion,
        "destino_barrio": solicitud.destino_barrio,
        "destino_piso": solicitud.destino_piso,
        "destino_ascensor": solicitud.destino_ascensor,
        "destino_notas": solicitud.destino_notas,
        "origen_place_id": solicitud.origen_place_id,
        "origen_lat": float(solicitud.origen_lat) if solicitud.origen_lat is not None else None,
        "origen_lng": float(solicitud.origen_lng) if solicitud.origen_lng is not None else None,
        "destino_place_id": solicitud.destino_place_id,
        "destino_lat": float(solicitud.destino_lat) if solicitud.destino_lat is not None else None,
        "destino_lng": float(solicitud.destino_lng) if solicitud.destino_lng is not None else None,
        "chofer_id": solicitud.chofer_id,
        "chofer_rol": solicitud.chofer_rol,
        "vehiculo_id": solicitud.vehiculo_id,
        "km_estimados": float(solicitud.km_estimados) if solicitud.km_estimados is not None else None,
        "km_vuelta": float(solicitud.km_vuelta) if solicitud.km_vuelta is not None else None,
        "km_total": float(solicitud.km_total) if solicitud.km_total is not None else None,
        "duracion_ida_min": solicitud.duracion_ida_min,
        "duracion_vuelta_min": solicitud.duracion_vuelta_min,
        "espera_min": solicitud.espera_min,
        "horas_estimadas": float(solicitud.horas_estimadas) if solicitud.horas_estimadas is not None else None,
        "tarifa_base_aplicada": float(solicitud.tarifa_base_aplicada) if solicitud.tarifa_base_aplicada is not None else None,
        "tarifa_km_aplicada": float(solicitud.tarifa_km_aplicada) if solicitud.tarifa_km_aplicada is not None else None,
        "tarifa_hora_aplicada": float(solicitud.tarifa_hora_aplicada) if solicitud.tarifa_hora_aplicada is not None else None,
        "costo_chofer": float(solicitud.costo_chofer) if solicitud.costo_chofer is not None else None,
        "precio_calculado": precio_calculado,
        "precio_final": precio_final,
        "sena_requerida": sena_requerida,
        "precio_editado": precio_editado,
        "precio_modificado_por": solicitud.precio_modificado_por,
        "precio_modificado_en": solicitud.precio_modificado_en.isoformat() if solicitud.precio_modificado_en else None,
        "remito_numero": solicitud.remito_numero,
        "remito_ruta": solicitud.remito_ruta,
        "remito_nombre": solicitud.remito_nombre,
        "remito_subido_por_id": solicitud.remito_subido_por_id,
        "receptor_nombre": solicitud.receptor_nombre,
        "receptor_documento": solicitud.receptor_documento,
        "remito_cargado": solicitud.remito_ruta is not None,
        "finalizada_en": solicitud.finalizada_en.isoformat() if solicitud.finalizada_en else None,
        "motivo_cancelacion": solicitud.motivo_cancelacion,
        "notas": solicitud.notas,
        "items_carga": [i.model_dump() for i in items],
        "pagos": [p.model_dump() for p in pagos],
        "creado_en": solicitud.creado_en.isoformat() if solicitud.creado_en else None,
        "actualizado_en": solicitud.actualizado_en.isoformat() if solicitud.actualizado_en else None,
        "client_name": client_name,
        "phone": phone,
        "status": solicitud.estado,
        "date": solicitud.fecha.isoformat() if hasattr(solicitud.fecha, "isoformat") else solicitud.fecha,
        "arrival_from": solicitud.hora_desde.isoformat()[:5] if hasattr(solicitud.hora_desde, "isoformat") else str(solicitud.hora_desde)[:5],
        "arrival_to": solicitud.hora_hasta.isoformat()[:5] if hasattr(solicitud.hora_hasta, "isoformat") else str(solicitud.hora_hasta)[:5],
        "service_from": solicitud.hora_desde.isoformat()[:5] if hasattr(solicitud.hora_desde, "isoformat") else str(solicitud.hora_desde)[:5],
        "service_to": solicitud.hora_hasta.isoformat()[:5] if hasattr(solicitud.hora_hasta, "isoformat") else str(solicitud.hora_hasta)[:5],
        "origin_address": solicitud.origen_direccion,
        "origin_barrio": solicitud.origen_barrio,
        "origin_floor": solicitud.origen_piso,
        "origin_elevator": solicitud.origen_ascensor,
        "destination_address": solicitud.destino_direccion,
        "destination_barrio": solicitud.destino_barrio,
        "destination_floor": solicitud.destino_piso,
        "destination_elevator": solicitud.destino_ascensor,
        "cargo_items": cargo_items,
        "cargo_approx_units": sum((i.cantidad for i in items), 0),
        "cargo_fragile": any((i.fragil for i in items)),
        "cargo_notes": solicitud.origen_notas or solicitud.destino_notas or solicitud.notas,
        "driver_id": solicitud.chofer_id,
        "vehicle_id": solicitud.vehiculo_id,
        "price": float(precio_final),
        # La seña no se guarda en el viaje: es el 50 % del precio final
        # (regla de presentación, ver backend/sql/schema.sql).
        "deposit_required": sena_requerida,
        "deposit_received": sena_total,
        "confirmed": solicitud.estado in ("confirmada", "finalizada"),
        "estimated_km": float(solicitud.km_estimados) if solicitud.km_estimados is not None else None,
        "estimated_hours": float(solicitud.horas_estimadas) if solicitud.horas_estimadas is not None else None,
        "distance_km": float(solicitud.km_estimados) if solicitud.km_estimados is not None else None,
        "return_km": float(solicitud.km_vuelta) if solicitud.km_vuelta is not None else None,
        "total_km": float(solicitud.km_total) if solicitud.km_total is not None else None,
        "eta_minutes": solicitud.duracion_ida_min,
        "wait_minutes": solicitud.espera_min,
        "driver_cost": float(solicitud.costo_chofer) if solicitud.costo_chofer is not None else None,
        "suggested_price": precio_calculado,
        "price_overridden": bool(solicitud.precio_modificado_por is not None),
        "arrived_at": None,
        "finished_at": solicitud.finalizada_en.isoformat() if solicitud.finalizada_en else None,
        "incidents": [],
        "remito_data_url": solicitud.remito_ruta,
        "remito_name": solicitud.remito_nombre,
        "payments": pagos_legacy,
    }
    return data


# Aliases
serialize_client = serialize_usuario
serialize_driver = serialize_usuario
serialize_vehicle = serialize_vehiculo
serialize_request = serialize_solicitud
deposit_received = lambda request: float(sum(p.monto for p in request.pagos if p.concepto == "sena"))
