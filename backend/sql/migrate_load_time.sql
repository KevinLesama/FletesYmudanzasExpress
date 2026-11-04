-- Fletes Express - Migración: tiempo de carga y llegada estimada
--
-- Agrega la duración de carga sin modificar ni reinterpretar los valores
-- históricos de espera_min. No ejecutar sobre una base real sin respaldo y
-- autorización.

BEGIN;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS carga_min integer NOT NULL DEFAULT 60;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_solicitudes_carga'
          AND conrelid = 'solicitudes'::regclass
    ) THEN
        ALTER TABLE solicitudes
            ADD CONSTRAINT ck_solicitudes_carga
            CHECK (carga_min BETWEEN 0 AND 1440);
    END IF;
END $$;

COMMENT ON COLUMN solicitudes.carga_min IS
    'Minutos estimados para cargar en el origen. Se suman al inicio y a la ETA de Maps para calcular hora_hasta.';

COMMIT;
