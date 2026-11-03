-- ===========================================================================
-- Fletes Express - Migración: cierre del viaje desde el portal del chofer
-- ---------------------------------------------------------------------------
-- QUÉ HACE
--   Agrega a `solicitudes` la modalidad de cobro del saldo elegida por el
--   chofer y el momento en que fotografió el remito en su dispositivo.
--   La imagen no se sube: la base solo registra que el paso se completó.
--
-- CÓMO USARLO
--   Supabase > SQL Editor > New query > pegar y ejecutar.
--   Es IDEMPOTENTE: se puede correr más de una vez.
--   No borra ni modifica datos: solo agrega columnas y una restricción.
--
-- POR QUÉ HACE FALTA
--   backend/sql/schema.sql usa CREATE TABLE IF NOT EXISTS: si la tabla ya
--   existe, PostgreSQL la saltea completa y no agrega columnas nuevas. Este
--   archivo es la vía para una base que ya tiene datos.
-- ===========================================================================

BEGIN;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS metodo_cobro_saldo text;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS remito_foto_tomada_en timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_solicitudes_metodo_cobro_saldo'
          AND conrelid = 'solicitudes'::regclass
    ) THEN
        ALTER TABLE solicitudes
            ADD CONSTRAINT ck_solicitudes_metodo_cobro_saldo
            CHECK (
                metodo_cobro_saldo IS NULL
                OR metodo_cobro_saldo IN ('efectivo', 'transferencia')
            );
    END IF;
END $$;

COMMENT ON COLUMN solicitudes.metodo_cobro_saldo IS
    'Modalidad elegida por el chofer para cobrar el saldo: efectivo | transferencia.';

COMMENT ON COLUMN solicitudes.remito_foto_tomada_en IS
    'Momento en que el chofer fotografió el remito en su dispositivo (la imagen no se sube).';

COMMIT;
