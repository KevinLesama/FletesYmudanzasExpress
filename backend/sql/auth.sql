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
--   usuario de la app por esta columna; si está vacía, lo resuelve por email
--   (primer ingreso) y completa el vínculo sola.
--
-- ES IDEMPOTENTE: se puede volver a correr sin romper nada.
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA IMPORTANTE (leer antes de tocar la resolución de usuarios)
-- ---------------------------------------------------------------------------
--   Los tres roles viven en la MISMA tabla. Los clientes NO son cuentas del
--   sistema: son contactos de la empresa y pueden tener email cargado.
--
--   Por eso, TODA resolución de identidad por email DEBE filtrar el rol:
--
--       SELECT * FROM usuarios
--        WHERE lower(email) = lower($1)
--          AND rol IN ('administrador', 'chofer');
--
--   Si esa condición falta, un cliente con email puede quedar autenticado
--   como si fuera personal. La vista `v_personal` del final ya trae el filtro
--   aplicado: conviene usarla en lugar de consultar `usuarios` a mano.
--
--   El ROL sale de `usuarios.rol`, nunca del token ni del app_metadata de
--   Supabase: habilitar o cambiar permisos se hace desde el panel.
--
--   El alta de cuentas sigue siendo manual (Authentication > Users) usando el
--   MISMO email cargado en el panel. Ver backend/sql/futuraBD.sql para las
--   decisiones pendientes sobre altas automáticas e invitaciones.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columna de vínculo
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_auth_user_id
    ON usuarios (auth_user_id);

COMMENT ON COLUMN usuarios.auth_user_id IS
    'Cuenta de Supabase Auth vinculada. NULL = todavía no ingresó.';

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
-- 3. Personal habilitado para iniciar sesión
-- ---------------------------------------------------------------------------
-- Deja el filtro por rol en un solo lugar. Es la fuente recomendada para
-- resolver el usuario del JWT: los clientes quedan afuera por definición.
CREATE OR REPLACE VIEW v_personal AS
SELECT
    id,
    auth_user_id,
    rol,
    nombre,
    email,
    telefono,
    activo
FROM usuarios
WHERE rol IN ('administrador', 'chofer');

COMMENT ON VIEW v_personal IS
    'Administradores y choferes. Única fuente válida para resolver el login por email.';

-- ---------------------------------------------------------------------------
-- 4. La vista tampoco se expone por REST
-- ---------------------------------------------------------------------------
-- Las vistas de PostgreSQL se ejecutan con los permisos del dueño, así que
-- revocar en las tablas no alcanza: hay que revocar también acá.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE v_personal FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE v_personal FROM authenticated;
    END IF;
END $$;
