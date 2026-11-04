-- Fletes Express - Migración: tiempos operativos confirmados explícitamente
--
-- Mantiene los minutos y horarios históricos. Las solicitudes pendientes
-- quedan sin marcar como confirmadas porque la base no registra si el valor
-- antiguo (por ejemplo, 60 min) fue un default o una decisión administrativa.
-- Los viajes ya confirmados/finalizados conservan su condición operativa.
-- No ejecutar sobre una base real sin respaldo y autorización.

BEGIN;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS hora_hasta_confirmado boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS carga_min_confirmado boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS descarga_min_confirmado boolean NOT NULL DEFAULT false;

ALTER TABLE solicitudes
    ALTER COLUMN hora_hasta DROP NOT NULL,
    ALTER COLUMN carga_min DROP NOT NULL,
    ALTER COLUMN carga_min DROP DEFAULT,
    ALTER COLUMN descarga_min DROP NOT NULL,
    ALTER COLUMN descarga_min DROP DEFAULT;

UPDATE solicitudes
   SET hora_hasta_confirmado = true,
       carga_min_confirmado = true,
       descarga_min_confirmado = true
 WHERE estado IN ('confirmada', 'finalizada');

ALTER TABLE solicitudes
    DROP CONSTRAINT IF EXISTS ck_solicitudes_ventana,
    DROP CONSTRAINT IF EXISTS ck_solicitudes_carga,
    DROP CONSTRAINT IF EXISTS ck_solicitudes_descarga,
    DROP CONSTRAINT IF EXISTS ck_solicitudes_carga_confirmada,
    DROP CONSTRAINT IF EXISTS ck_solicitudes_descarga_confirmada,
    DROP CONSTRAINT IF EXISTS ck_solicitudes_planificacion_completa;

ALTER TABLE solicitudes
    ADD CONSTRAINT ck_solicitudes_ventana
        CHECK (hora_hasta IS NULL OR hora_hasta > hora_desde),
    ADD CONSTRAINT ck_solicitudes_carga
        CHECK (carga_min IS NULL OR carga_min BETWEEN 0 AND 1440),
    ADD CONSTRAINT ck_solicitudes_descarga
        CHECK (descarga_min IS NULL OR descarga_min BETWEEN 0 AND 1440),
    ADD CONSTRAINT ck_solicitudes_carga_confirmada
        CHECK (NOT carga_min_confirmado OR carga_min IS NOT NULL),
    ADD CONSTRAINT ck_solicitudes_descarga_confirmada
        CHECK (NOT descarga_min_confirmado OR descarga_min IS NOT NULL),
    ADD CONSTRAINT ck_solicitudes_planificacion_completa
        CHECK (
            estado NOT IN ('confirmada', 'finalizada')
            OR (
                hora_hasta IS NOT NULL
                AND hora_hasta_confirmado
                AND carga_min_confirmado
                AND descarga_min_confirmado
            )
        );

COMMENT ON COLUMN solicitudes.carga_min_confirmado IS
    'Indica que administración aceptó explícitamente carga_min.';
COMMENT ON COLUMN solicitudes.descarga_min_confirmado IS
    'Indica que administración aceptó explícitamente descarga_min.';
COMMENT ON COLUMN solicitudes.hora_hasta_confirmado IS
    'Indica que administración aceptó o recalculó explícitamente la llegada estimada.';

COMMIT;
