-- Fletes Express - Migración: descarga y agenda operativa
--
-- Ejecutar manualmente sobre una base existente después de revisar el
-- preflight. No aplicar sin respaldo ni autorización.

BEGIN;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS descarga_min integer NOT NULL DEFAULT 60;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_solicitudes_descarga'
          AND conrelid = 'solicitudes'::regclass
    ) THEN
        ALTER TABLE solicitudes
            ADD CONSTRAINT ck_solicitudes_descarga
            CHECK (descarga_min IN (30, 60, 90, 120));
    END IF;
END $$;

DO $$
DECLARE
    v_conflicts text;
BEGIN
    WITH confirmadas AS (
        SELECT id, codigo, fecha, hora_desde, hora_hasta, descarga_min,
               chofer_id, vehiculo_id
        FROM solicitudes
        WHERE estado = 'confirmada'
    ),
    solapamientos AS (
        SELECT
            'chofer'::text AS recurso,
            a.chofer_id AS recurso_id,
            a.id AS id_a,
            a.codigo AS codigo_a,
            b.id AS id_b,
            b.codigo AS codigo_b,
            tsrange(
                a.fecha + a.hora_desde,
                a.fecha + a.hora_hasta + make_interval(mins => a.descarga_min + 30),
                '[)'
            ) AS rango_a,
            tsrange(
                b.fecha + b.hora_desde,
                b.fecha + b.hora_hasta + make_interval(mins => b.descarga_min + 30),
                '[)'
            ) AS rango_b
        FROM confirmadas a
        JOIN confirmadas b
          ON a.id < b.id
         AND a.chofer_id = b.chofer_id
        WHERE a.chofer_id IS NOT NULL

        UNION ALL

        SELECT
            'vehículo'::text AS recurso,
            a.vehiculo_id AS recurso_id,
            a.id AS id_a,
            a.codigo AS codigo_a,
            b.id AS id_b,
            b.codigo AS codigo_b,
            tsrange(
                a.fecha + a.hora_desde,
                a.fecha + a.hora_hasta + make_interval(mins => a.descarga_min + 30),
                '[)'
            ) AS rango_a,
            tsrange(
                b.fecha + b.hora_desde,
                b.fecha + b.hora_hasta + make_interval(mins => b.descarga_min + 30),
                '[)'
            ) AS rango_b
        FROM confirmadas a
        JOIN confirmadas b
          ON a.id < b.id
         AND a.vehiculo_id = b.vehiculo_id
        WHERE a.vehiculo_id IS NOT NULL
    )
    SELECT string_agg(
        format(
            'Recurso %s #%s: %s (ID %s) y %s (ID %s), solapamiento [%s, %s)',
            recurso,
            recurso_id,
            codigo_a,
            id_a,
            codigo_b,
            id_b,
            greatest(lower(rango_a), lower(rango_b)),
            least(upper(rango_a), upper(rango_b))
        ),
        E'\n'
        ORDER BY recurso, recurso_id, id_a, id_b
    )
    INTO v_conflicts
    FROM solapamientos
    WHERE rango_a && rango_b;

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = 'No se puede aplicar la migración: hay viajes confirmados que se solapan con descarga y margen operativo.',
            DETAIL = v_conflicts,
            HINT = 'No se modificaron solicitudes. Revise y resuelva estos conflictos manualmente antes de volver a ejecutar la migración.';
    END IF;
END $$;

ALTER TABLE solicitudes
    DROP CONSTRAINT IF EXISTS ex_solicitudes_chofer_sin_solape,
    DROP CONSTRAINT IF EXISTS ex_solicitudes_vehiculo_sin_solape;

ALTER TABLE solicitudes
    ADD CONSTRAINT ex_solicitudes_chofer_sin_solape EXCLUDE USING gist (
        chofer_id WITH =,
        tsrange(
            fecha + hora_desde,
            fecha + hora_hasta + make_interval(mins => descarga_min + 30),
            '[)'
        ) WITH &&
    ) WHERE (estado = 'confirmada'),
    ADD CONSTRAINT ex_solicitudes_vehiculo_sin_solape EXCLUDE USING gist (
        vehiculo_id WITH =,
        tsrange(
            fecha + hora_desde,
            fecha + hora_hasta + make_interval(mins => descarga_min + 30),
            '[)'
        ) WITH &&
    ) WHERE (estado = 'confirmada');

COMMENT ON COLUMN solicitudes.descarga_min IS
    'Descarga estimada tras la llegada al destino. No forma parte de espera_min ni de la hora de llegada; opciones: 30, 60, 90 o 120 minutos.';

COMMIT;
