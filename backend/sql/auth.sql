-- ===========================================================================
-- Fletes Express - Autenticación (Supabase Auth)
-- ---------------------------------------------------------------------------
-- CUÁNDO USARLO
--   Ejecutar DESPUÉS de schema.sql y ANTES de seed.sql, desde el SQL Editor de
--   Supabase. También sirve en un PostgreSQL local: la clave foránea a
--   auth.users se agrega solo si ese esquema existe.
--
-- QUÉ HACE
--   Agrega `usuarios.auth_user_id`: el id de la cuenta de Supabase Auth
--   vinculada a ese usuario. La API valida el JWT del navegador y resuelve el
--   usuario de la app por esta columna; si está vacía, la resuelve por email
--   (primer ingreso) y completa el vínculo sola.
--
-- ES IDEMPOTENTE: se puede volver a correr sin romper nada.
--
-- IMPORTANTE
--   El ROL no sale de esta columna ni del token: la fuente de verdad es
--   `usuarios.rol` ('admin' | 'chofer' | 'cliente'). Las cuentas de login se
--   crean en Supabase (Authentication > Users) y el alta de los usuarios de la
--   app se hace desde el panel de Flota. Ver backend/sql/futuraBD.sql para las
--   decisiones que todavía hay que validar con el equipo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columna de vínculo
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_auth_user_id ON usuarios (auth_user_id);

-- ---------------------------------------------------------------------------
-- 2. Clave foránea a auth.users (solo en Supabase)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_usuarios_auth_user_id'
             AND conrelid = 'public.usuarios'::regclass
       )
    THEN
        ALTER TABLE public.usuarios
            ADD CONSTRAINT fk_usuarios_auth_user_id
            FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Aviso por email al crear la cuenta de Supabase
-- ---------------------------------------------------------------------------
-- Las cuentas se crean a mano (Authentication > Users) o, más adelante, con
-- la feature de mails de registro que todavía no está implementada. Para que
-- la app no acepte una cuenta sin rol, el backend devuelve 403 si el email del
-- token no está en `usuarios`; no hace falta ningún trigger para eso.
