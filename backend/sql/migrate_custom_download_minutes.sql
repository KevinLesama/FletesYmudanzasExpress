-- Fletes Express - Migración: descarga editable en minutos
--
-- Permite que administración indique la duración de descarga manualmente.
-- Conserva los valores existentes; la restricción anterior solo permitía
-- 30, 60, 90 y 120, todos dentro del nuevo rango.

BEGIN;

ALTER TABLE solicitudes
    DROP CONSTRAINT IF EXISTS ck_solicitudes_descarga;

ALTER TABLE solicitudes
    ADD CONSTRAINT ck_solicitudes_descarga
    CHECK (descarga_min BETWEEN 0 AND 1440);

COMMENT ON COLUMN solicitudes.descarga_min IS
    'Minutos estimados para descargar en destino (0 a 1440). Extiende la ocupación del recurso sin cambiar la hora de llegada.';

COMMIT;
