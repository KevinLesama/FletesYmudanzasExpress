-- ===========================================================================
-- Autenticacion (Supabase Auth)
-- ---------------------------------------------------------------------------
-- Ejecutar DESPUES de schema.sql y ANTES de seed.sql, desde el SQL Editor de
-- Supabase (auth.users no existe en un Postgres local sin Supabase).
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- Solo `drivers` se vincula a un usuario de la app: los `clients` son clientes
-- de la empresa de mudanzas, no cuentas con login.
-- ===========================================================================

ALTER TABLE drivers
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- El indice de `auth_user_id` ya lo crea el UNIQUE; no hace falta otro.

-- Rol por defecto en app_metadata (minimo privilegio). El rol real se edita a
-- mano desde el Dashboard: Authentication > Users > raw_app_meta_data.
-- Nunca usar user_metadata: el usuario puede editarlo desde el cliente.
CREATE OR REPLACE FUNCTION public.set_default_auth_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.raw_app_meta_data IS NULL OR NEW.raw_app_meta_data ->> 'role' IS NULL THEN
        NEW.raw_app_meta_data :=
            COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'driver');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_auth_role ON auth.users;
CREATE TRIGGER trg_set_default_auth_role
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.set_default_auth_role();
