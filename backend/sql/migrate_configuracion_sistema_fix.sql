-- Fletes Express - Migración: corrige configuracion_sistema
--
-- DOS PROBLEMAS QUE ARREGLA
--
-- 1) TRIGGER ROTO
--    schema.sql crea el disparador tr_configuracion_sistema_actualizado_en,
--    pero la tabla no tenía la columna `actualizado_en`. La función
--    fn_marcar_actualizado_en hace `NEW.actualizado_en := now()`, así que
--    cualquier UPDATE sobre configuracion_sistema fallaba con:
--        record "new" has no field "actualizado_en"
--    En la práctica: PUT /api/settings/system devolvía 500 y los ajustes de
--    operación y precios no se podían guardar.
--
-- 2) RLS APAGADO
--    schema.sql habilita RLS y revoca los permisos de anon/authenticated
--    sobre las 5 tablas originales, pero `configuracion_sistema` quedó
--    afuera de ese loop. En Supabase eso la deja alcanzable por la API REST
--    con la clave anon. Se cierra acá y también en schema.sql.
--
-- Es idempotente. No modifica datos: la fila singleton conserva sus valores.

BEGIN;

-- 1) Columna que el trigger necesita.
ALTER TABLE configuracion_sistema
    ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN configuracion_sistema.actualizado_en IS
    'Sellado por tr_configuracion_sistema_actualizado_en en cada UPDATE.';

-- La función ya existe si se corrió install.sql; se recrea igual para que esta
-- migración funcione también sobre una base creada solo con migraciones.
CREATE OR REPLACE FUNCTION fn_marcar_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_configuracion_sistema_actualizado_en ON configuracion_sistema;

CREATE TRIGGER tr_configuracion_sistema_actualizado_en
    BEFORE UPDATE ON configuracion_sistema
    FOR EACH ROW EXECUTE FUNCTION fn_marcar_actualizado_en();

-- 2) Cerrar el acceso por la API REST de Supabase.
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE configuracion_sistema FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE configuracion_sistema FROM authenticated;
    END IF;
END $$;

COMMIT;
