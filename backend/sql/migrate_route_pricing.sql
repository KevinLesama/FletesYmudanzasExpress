-- ===========================================================================
-- Fletes Express - Migración: recorrido con geolocalización y costos
-- ---------------------------------------------------------------------------
-- QUÉ HACE
--   Agrega a `solicitudes` las columnas de geolocalización, recorrido y
--   cotización que usa la fórmula de costos del chofer:
--     place_id + coordenadas de origen y destino
--     km_vuelta, km_total, duracion_ida_min, duracion_vuelta_min, espera_min
--     snapshot de tarifas del chofer y costo_chofer
--   Recrea v_solicitudes con las columnas nuevas.
--
-- CÓMO USARLO
--   Supabase > SQL Editor > New query > pegar y ejecutar.
--   Es IDEMPOTENTE: se puede correr más de una vez.
--   No borra ni modifica datos: solo agrega columnas con DEFAULT seguro.
--
-- POR QUÉ HACE FALTA
--   backend/sql/schema.sql usa CREATE TABLE IF NOT EXISTS: si la tabla ya
--   existe, PostgreSQL la saltea completa y no agrega columnas nuevas. Este
--   archivo es la vía para una base que ya tiene datos.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Geolocalización (Google Maps)
-- ---------------------------------------------------------------------------
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS origen_place_id      text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS origen_lat           numeric(9,6);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS origen_lng           numeric(9,6);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS destino_place_id     text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS destino_lat          numeric(9,6);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS destino_lng          numeric(9,6);

-- ---------------------------------------------------------------------------
-- 2. Recorrido
--    km_estimados ya existe y pasa a significar "distancia de ida".
--    km_total es ida + vuelta: la base del costo del chofer.
-- ---------------------------------------------------------------------------
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS km_vuelta            numeric(10,2);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS km_total             numeric(10,2);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS duracion_ida_min     integer;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS duracion_vuelta_min  integer;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS espera_min           integer NOT NULL DEFAULT 120;

-- ---------------------------------------------------------------------------
-- 3. Cotización
--    Las tarifas aplicadas son un snapshot: si el chofer cambia su
--    configuración, los viajes ya cotizados conservan su número.
-- ---------------------------------------------------------------------------
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS tarifa_base_aplicada numeric(12,2);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS tarifa_km_aplicada   numeric(12,2);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS tarifa_hora_aplicada numeric(12,2);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS costo_chofer         numeric(12,2);

-- ---------------------------------------------------------------------------
-- 4. Restricciones (ADD CONSTRAINT no soporta IF NOT EXISTS: se consulta el
--    catálogo para que el script siga siendo idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitudes_km_vuelta') THEN
        ALTER TABLE solicitudes ADD CONSTRAINT ck_solicitudes_km_vuelta
            CHECK (km_vuelta IS NULL OR km_vuelta >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitudes_km_total') THEN
        ALTER TABLE solicitudes ADD CONSTRAINT ck_solicitudes_km_total
            CHECK (km_total IS NULL OR km_total >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitudes_espera') THEN
        ALTER TABLE solicitudes ADD CONSTRAINT ck_solicitudes_espera
            CHECK (espera_min BETWEEN 0 AND 1440);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitudes_duraciones') THEN
        ALTER TABLE solicitudes ADD CONSTRAINT ck_solicitudes_duraciones
            CHECK ((duracion_ida_min IS NULL OR duracion_ida_min >= 0)
                   AND (duracion_vuelta_min IS NULL OR duracion_vuelta_min >= 0));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitudes_coordenadas') THEN
        ALTER TABLE solicitudes ADD CONSTRAINT ck_solicitudes_coordenadas
            CHECK ((origen_lat IS NULL OR origen_lat BETWEEN -90 AND 90)
                   AND (origen_lng IS NULL OR origen_lng BETWEEN -180 AND 180)
                   AND (destino_lat IS NULL OR destino_lat BETWEEN -90 AND 90)
                   AND (destino_lng IS NULL OR destino_lng BETWEEN -180 AND 180));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_solicitudes_tarifas') THEN
        ALTER TABLE solicitudes ADD CONSTRAINT ck_solicitudes_tarifas
            CHECK ((tarifa_base_aplicada IS NULL OR tarifa_base_aplicada >= 0)
                   AND (tarifa_km_aplicada IS NULL OR tarifa_km_aplicada >= 0)
                   AND (tarifa_hora_aplicada IS NULL OR tarifa_hora_aplicada >= 0)
                   AND (costo_chofer IS NULL OR costo_chofer >= 0));
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Comentarios
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN solicitudes.km_estimados IS
    'Distancia de ida en km, redondeada hacia arriba. Es la que se muestra como recorrido.';
COMMENT ON COLUMN solicitudes.km_total IS
    'Ida + vuelta. Es la base del costo del chofer, no el recorrido visible.';
COMMENT ON COLUMN solicitudes.espera_min IS
    'Minutos de espera (carga y descarga) que se suman al tiempo facturado.';
COMMENT ON COLUMN solicitudes.costo_chofer IS
    'Tarifa base + km totales * tarifa por km + horas totales * tarifa por hora.';
COMMENT ON COLUMN solicitudes.tarifa_base_aplicada IS
    'Snapshot de usuarios.tarifa_base al cotizar. No cambia si el chofer actualiza su tarifa.';

-- ---------------------------------------------------------------------------
-- 6. Vista de lectura (las columnas nuevas van al final: CREATE OR REPLACE
--    VIEW no permite insertarlas en el medio)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_solicitudes AS
SELECT
    s.id,
    s.codigo,
    s.estado,
    s.fecha,
    s.hora_desde,
    s.hora_hasta,

    cl.id       AS cliente_id,
    cl.nombre   AS cliente_nombre,
    cl.telefono AS cliente_telefono,

    ch.id       AS chofer_id,
    ch.nombre   AS chofer_nombre,
    ch.telefono AS chofer_telefono,

    ve.id       AS vehiculo_id,
    ve.patente  AS vehiculo_patente,
    ve.tipo     AS vehiculo_tipo,

    s.origen_direccion, s.origen_barrio, s.origen_piso, s.origen_ascensor, s.origen_notas,
    s.destino_direccion, s.destino_barrio, s.destino_piso, s.destino_ascensor, s.destino_notas,

    s.km_estimados,
    s.horas_estimadas,
    s.precio_calculado,
    s.precio_final,
    (s.precio_calculado IS NOT NULL
     AND s.precio_final IS DISTINCT FROM s.precio_calculado) AS precio_editado,
    s.precio_modificado_por,
    s.precio_modificado_en,

    COALESCE(it.cantidad_lineas, 0)   AS cantidad_lineas,
    COALESCE(it.total_unidades, 0)    AS total_unidades,
    COALESCE(it.tiene_fragil, false)  AS tiene_fragil,

    COALESCE(pg.total_pagado, 0)      AS total_pagado,
    s.precio_final - COALESCE(pg.total_pagado, 0) AS saldo,
    CASE
        WHEN COALESCE(pg.total_pagado, 0) = 0                                  THEN 'sin_pagos'
        WHEN COALESCE(pg.total_pagado, 0) < s.precio_final                     THEN 'parcial'
        WHEN COALESCE(pg.total_pagado, 0) = s.precio_final                     THEN 'cobrado'
        ELSE 'sobrepago'
    END AS estado_cobro,

    s.motivo_cancelacion,
    s.finalizada_en,
    s.remito_numero,
    s.remito_ruta,
    s.remito_nombre,
    s.remito_subido_por_id,
    s.receptor_nombre,
    s.receptor_documento,
    (s.remito_ruta IS NOT NULL) AS remito_cargado,
    s.notas,
    s.creado_en,
    s.actualizado_en,

    s.km_vuelta,
    s.km_total,
    s.duracion_ida_min,
    s.duracion_vuelta_min,
    s.espera_min,
    s.costo_chofer,
    s.tarifa_base_aplicada,
    s.tarifa_km_aplicada,
    s.tarifa_hora_aplicada,
    s.precio_final / 2 AS sena_requerida,
    s.origen_place_id,
    s.origen_lat,
    s.origen_lng,
    s.destino_place_id,
    s.destino_lat,
    s.destino_lng
FROM solicitudes s
JOIN      usuarios  cl ON cl.id = s.cliente_id
LEFT JOIN usuarios  ch ON ch.id = s.chofer_id
LEFT JOIN vehiculos ve ON ve.id = s.vehiculo_id
LEFT JOIN LATERAL (
    SELECT count(*)                        AS cantidad_lineas,
           COALESCE(sum(i.cantidad), 0)    AS total_unidades,
           bool_or(i.fragil)               AS tiene_fragil
      FROM items_carga i
     WHERE i.solicitud_id = s.id
) it ON true
LEFT JOIN LATERAL (
    SELECT COALESCE(sum(p.monto), 0) AS total_pagado
      FROM pagos p
     WHERE p.solicitud_id = s.id
) pg ON true;

COMMENT ON VIEW v_solicitudes IS
    'Viaje con datos de cliente, chofer, vehículo, bultos, cobrado, saldo y remito.';

COMMIT;
