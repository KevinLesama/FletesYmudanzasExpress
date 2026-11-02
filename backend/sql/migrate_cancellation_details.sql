-- Fletes Express - Migración: autor y devolución de seña al cancelar
--
-- Ejecutar manualmente en Supabase > SQL Editor sobre una base existente.
-- Es idempotente y no modifica los viajes cancelados anteriores:
-- cancelado_por queda NULL y sena_devuelta queda false.

BEGIN;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS cancelado_por text;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS sena_devuelta boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_solicitudes_cancelado_por'
    ) THEN
        ALTER TABLE solicitudes
            ADD CONSTRAINT ck_solicitudes_cancelado_por
            CHECK (cancelado_por IS NULL OR cancelado_por IN ('cliente', 'empresa'));
    END IF;
END $$;

COMMIT;
