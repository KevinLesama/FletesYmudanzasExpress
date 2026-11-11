-- Fletes Express - Migración: margen operativo configurable en la reserva
--
-- ANTES DE ESTA MIGRACIÓN
--   Las restricciones EXCLUDE de agenda usaban `descarga_min + 30` fijo,
--   mientras configuracion_sistema.margen_operativo_min acepta 30..1440 y el
--   backend ya lo aplicaba al evaluar disponibilidad. La base podía aceptar un
--   solapamiento que la aplicación consideraba inválido.
--
-- DESPUÉS
--   solicitudes.margen_operativo_min congela el margen vigente al planificar el
--   viaje, y las restricciones usan ese valor. Cambiar la configuración afecta
--   a los viajes que se planifiquen de ahí en adelante: una reserva confirmada
--   no se reinterpreta porque cambie un parámetro global.
--
-- EJECUCIÓN
--   Manual, sobre una base existente, con respaldo y autorización. Si hay viajes
--   confirmados que se solaparían con el margen configurado, aborta sin tocar
--   nada: no hay forma de aplicar la regla sin decidir primero qué viaje se mueve.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Preflight: ¿el margen configurado genera solapamientos entre confirmados?
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_margen    integer;
    v_conflicts text;
BEGIN
    SELECT COALESCE(
        (SELECT margen_operativo_min FROM configuracion_sistema WHERE id = 1),
        30
    ) INTO v_margen;

    WITH confirmadas AS (
        SELECT id, codigo, fecha, hora_desde, hora_hasta, descarga_min,
               chofer_id, vehiculo_id
        FROM solicitudes
        WHERE estado = 'confirmada'
    ),
    solapamientos AS (
        SELECT
            'chofer'::text AS recurso,
            a.chofer_id    AS recurso_id,
            a.id AS id_a, a.codigo AS codigo_a,
            b.id AS id_b, b.codigo AS codigo_b,
            tsrange(
                a.fecha + a.hora_desde,
                a.fecha + a.hora_hasta + make_interval(mins => a.descarga_min + v_margen),
                '[)'
            ) AS rango_a,
            tsrange(
                b.fecha + b.hora_desde,
                b.fecha + b.hora_hasta + make_interval(mins => b.descarga_min + v_margen),
                '[)'
            ) AS rango_b
        FROM confirmadas a
        JOIN confirmadas b
          ON a.id < b.id
         AND a.chofer_id = b.chofer_id
        WHERE a.chofer_id IS NOT NULL

        UNION ALL

        SELECT
            'vehículo'::text,
            a.vehiculo_id,
            a.id, a.codigo, b.id, b.codigo,
            tsrange(
                a.fecha + a.hora_desde,
                a.fecha + a.hora_hasta + make_interval(mins => a.descarga_min + v_margen),
                '[)'
            ),
            tsrange(
                b.fecha + b.hora_desde,
                b.fecha + b.hora_hasta + make_interval(mins => b.descarga_min + v_margen),
                '[)'
            )
        FROM confirmadas a
        JOIN confirmadas b
          ON a.id < b.id
         AND a.vehiculo_id = b.vehiculo_id
        WHERE a.vehiculo_id IS NOT NULL
    )
    SELECT string_agg(
               format('%s %s: %s y %s', recurso, recurso_id, codigo_a, codigo_b),
               E'\n'
               ORDER BY recurso, recurso_id, id_a, id_b
           )
      INTO v_conflicts
      FROM solapamientos
     WHERE rango_a && rango_b;

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = format(
                'No se puede aplicar la migración: hay viajes confirmados que se solapan con %s minutos de margen operativo.',
                v_margen
            ),
            DETAIL = v_conflicts,
            HINT = 'No se modificó nada. Resolvé esos solapamientos o bajá margen_operativo_min y volvé a ejecutar.';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Columna que congela el margen de cada viaje.
-- ---------------------------------------------------------------------------
ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS margen_operativo_min integer NOT NULL DEFAULT 30;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_solicitudes_margen_operativo'
          AND conrelid = 'solicitudes'::regclass
    ) THEN
        ALTER TABLE solicitudes
            ADD CONSTRAINT ck_solicitudes_margen_operativo
            CHECK (margen_operativo_min BETWEEN 0 AND 1440);
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Backfill: los viajes existentes quedan con el margen vigente hoy.
-- ---------------------------------------------------------------------------
UPDATE solicitudes
   SET margen_operativo_min = COALESCE(
       (SELECT margen_operativo_min FROM configuracion_sistema WHERE id = 1),
       30
   );

-- ---------------------------------------------------------------------------
-- 4. Disparador: refresca el margen cuando cambia la planificación o el estado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_fijar_margen_operativo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT c.margen_operativo_min
      INTO NEW.margen_operativo_min
      FROM configuracion_sistema c
     WHERE c.id = 1;

    IF NEW.margen_operativo_min IS NULL THEN
        NEW.margen_operativo_min := 30;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_solicitudes_margen_operativo ON solicitudes;
CREATE TRIGGER tr_solicitudes_margen_operativo
    BEFORE INSERT OR UPDATE OF fecha, hora_desde, hora_hasta, descarga_min, estado
    ON solicitudes
    FOR EACH ROW EXECUTE FUNCTION fn_fijar_margen_operativo();

-- ---------------------------------------------------------------------------
-- 5. Restricciones de agenda con el margen de la fila.
-- ---------------------------------------------------------------------------
ALTER TABLE solicitudes
    DROP CONSTRAINT IF EXISTS ex_solicitudes_chofer_sin_solape,
    DROP CONSTRAINT IF EXISTS ex_solicitudes_vehiculo_sin_solape;

ALTER TABLE solicitudes
    ADD CONSTRAINT ex_solicitudes_chofer_sin_solape EXCLUDE USING gist (
        chofer_id WITH =,
        tsrange(
            fecha + hora_desde,
            fecha + hora_hasta + make_interval(mins => descarga_min + margen_operativo_min),
            '[)'
        ) WITH &&
    ) WHERE (estado = 'confirmada'),
    ADD CONSTRAINT ex_solicitudes_vehiculo_sin_solape EXCLUDE USING gist (
        vehiculo_id WITH =,
        tsrange(
            fecha + hora_desde,
            fecha + hora_hasta + make_interval(mins => descarga_min + margen_operativo_min),
            '[)'
        ) WITH &&
    ) WHERE (estado = 'confirmada');

COMMENT ON COLUMN solicitudes.margen_operativo_min IS
    'Margen operativo de configuracion_sistema al momento de planificar el viaje. Es el colchón que la restricción de agenda reserva después de la descarga.';

COMMIT;
