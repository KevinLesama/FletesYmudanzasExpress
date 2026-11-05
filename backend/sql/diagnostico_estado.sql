-- ===========================================================================
-- Fletes Express - Diagnóstico del estado de la base
-- ---------------------------------------------------------------------------
-- QUÉ ES
--   Una consulta de SOLO LECTURA. No crea, no modifica y no borra nada.
--   Devuelve UNA tabla con el estado real del esquema `public`.
--
-- POR QUÉ HACE FALTA
--   El export de Supabase ("schema for context only") no lista vistas,
--   triggers, índices ni restricciones EXCLUDE, y además repite nombres de
--   constraint que PostgreSQL no permitiría. No sirve para decidir.
--   Esto sí: lee el catálogo real.
--
-- CÓMO SE USA
--   Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
--   Devuelve un solo resultado. Copiarlo entero.
--
-- QUÉ MIRAR
--   01 vistas        -> deben estar v_personal (el login), v_solicitudes,
--                       v_agenda_confirmada, v_remitos_pendientes,
--                       v_recaudacion_usuario.
--   02 tablas        -> las 8 tablas del mock (clients, drivers, ...) tienen
--                       que dar 0 filas para poder borrarlas sin riesgo.
--   03 constraints   -> deben aparecer ck_solicitudes_con_chofer_y_vehiculo,
--                       ck_solicitudes_planificacion_completa,
--                       ck_solicitudes_finalizada_en y los dos EXCLUDE
--                       (contype = 'x'). La FK cliente debe ser COMPUESTA:
--                       (cliente_id, cliente_rol) -> usuarios(id, rol).
--   04 triggers      -> tr_*_actualizado_en, tr_solicitudes_cierre,
--                       tr_solicitudes_transicion, tr_pagos_validar_monto,
--                       tr_*_sin_borrar.
--   06 identity      -> si dice ALWAYS en vez de BY DEFAULT, cualquier carga
--                       con id explícito (seed, import) va a fallar.
--   07 duplicados    -> si hay filas acá, re-correr install.sql va a fallar al
--                       crear los índices únicos. Limpiar antes.
--   08 rls           -> todas las tablas de negocio deben decir true.
-- ===========================================================================

WITH
vistas AS (
    SELECT '01 vistas' AS seccion, table_name AS nombre, ''::text AS detalle
    FROM information_schema.views
    WHERE table_schema = 'public'
),

tablas AS (
    SELECT
        '02 tablas',
        c.relname,
        (xpath(
            '/row/cnt/text()',
            query_to_xml(format('SELECT count(*) AS cnt FROM public.%I', c.relname), false, true, '')
        ))[1]::text || ' filas'
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
),

constraints AS (
    SELECT
        '03 constraints',
        con.conname,
        CASE con.contype
            WHEN 'p' THEN 'PRIMARY KEY'
            WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'c' THEN 'CHECK'
            WHEN 'u' THEN 'UNIQUE'
            WHEN 'x' THEN 'EXCLUDE'
            ELSE con.contype::text
        END || ' :: ' || pg_get_constraintdef(con.oid)
    FROM pg_constraint con
    WHERE con.conrelid = 'public.solicitudes'::regclass
),

triggers AS (
    SELECT '04 triggers', t.tgname, c.relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
),

funciones AS (
    SELECT '05 funciones', p.proname, ''
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      -- Oculta las funciones que instala btree_gist: no son nuestras.
      AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass
            AND d.objid = p.oid
            AND d.deptype = 'e'
      )
),

identidad AS (
    SELECT
        '06 identity',
        table_name || '.' || column_name,
        identity_generation
    FROM information_schema.columns
    WHERE table_schema = 'public' AND is_identity = 'YES'
),

duplicados AS (
    SELECT '07 duplicados', 'usuarios.email', lower(email) AS detalle
    FROM usuarios
    WHERE email IS NOT NULL
    GROUP BY lower(email) HAVING count(*) > 1

    UNION ALL
    SELECT '07 duplicados', 'usuarios.telefono', rol || ':' || regexp_replace(telefono, '\D', '', 'g')
    FROM usuarios
    GROUP BY rol, regexp_replace(telefono, '\D', '', 'g') HAVING count(*) > 1

    UNION ALL
    SELECT '07 duplicados', 'vehiculos.patente', upper(regexp_replace(patente, '[\s-]', '', 'g'))
    FROM vehiculos
    GROUP BY upper(regexp_replace(patente, '[\s-]', '', 'g')) HAVING count(*) > 1

    UNION ALL
    SELECT '07 duplicados', 'solicitudes.codigo', codigo
    FROM solicitudes
    GROUP BY codigo HAVING count(*) > 1

    UNION ALL
    SELECT '07 duplicados', 'solicitudes.remito_numero', remito_numero
    FROM solicitudes
    WHERE remito_numero IS NOT NULL
    GROUP BY remito_numero HAVING count(*) > 1
),

rls AS (
    SELECT '08 rls', c.relname, c.relrowsecurity::text
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
)

SELECT seccion, nombre, detalle FROM (
    SELECT * FROM vistas
    UNION ALL SELECT * FROM tablas
    UNION ALL SELECT * FROM constraints
    UNION ALL SELECT * FROM triggers
    UNION ALL SELECT * FROM funciones
    UNION ALL SELECT * FROM identidad
    UNION ALL SELECT * FROM duplicados
    UNION ALL SELECT * FROM rls
) reporte
ORDER BY seccion, nombre;
