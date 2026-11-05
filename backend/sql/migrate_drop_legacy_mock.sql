-- Fletes Express - Migración: elimina las tablas del mock original
--
-- CONTEXTO
--   La base conserva DOS esquemas completos en `public`:
--
--     Nuevo (lo usa el código):  usuarios, vehiculos, solicitudes,
--                                items_carga, pagos, configuracion_sistema
--     Viejo (mock, sin uso):     clients, drivers, driver_factors, vehicles,
--                                requests, request_cargo_items, incidents,
--                                payments
--
--   Las 8 tablas viejas vienen de la app de simulación: ids de texto
--   ("drv-1", "req-4"), estados con el texto de pantalla ("Pendiente de
--   seña") y `payments.received_by` como texto. Ninguna línea del backend ni
--   del frontend las consulta; el ORM solo mapea las 6 tablas nuevas.
--
--   No hay claves foráneas desde las tablas nuevas hacia las viejas, así que
--   borrarlas no rompe nada del negocio.
--
-- SEGURIDAD
--   La migración ABORTA si alguna de las 8 tablas tiene filas. Así no se
--   pierde ningún dato por accidente. Si el conteo da 0, borra todo en una
--   sola transacción.
--
--   Si alguna tabla tiene datos que querés conservar:
--     1. pg_dump -t clients -t drivers ... > backup_mock.sql
--     2. reemplazá el DROP de abajo por:
--          ALTER TABLE clients RENAME TO legacy_clients;
--        (y lo mismo con cada tabla)
--     3. decidí después si migrar o descartar.
--
-- Ejecutar manualmente en Supabase > SQL Editor, con backup previo.

BEGIN;

DO $$
DECLARE
    v_tabla    text;
    v_filas    bigint;
    v_pendientes text[] := ARRAY[]::text[];
BEGIN
    FOREACH v_tabla IN ARRAY ARRAY[
        'clients', 'drivers', 'driver_factors', 'vehicles',
        'requests', 'request_cargo_items', 'incidents', 'payments'
    ]
    LOOP
        -- Si la tabla ya no existe (migración corrida antes), no hay nada que hacer.
        CONTINUE WHEN to_regclass(format('public.%I', v_tabla)) IS NULL;

        EXECUTE format('SELECT count(*) FROM public.%I', v_tabla) INTO v_filas;

        IF v_filas > 0 THEN
            v_pendientes := v_pendientes || format('%s (%s filas)', v_tabla, v_filas);
        END IF;
    END LOOP;

    IF array_length(v_pendientes, 1) > 0 THEN
        RAISE EXCEPTION USING
            MESSAGE = 'La migración no se aplicó: hay tablas del mock con datos.',
            DETAIL  = array_to_string(v_pendientes, ', '),
            HINT    = 'Archivá esas tablas (pg_dump) o renombralas a legacy_* antes de volver a ejecutar.';
    END IF;
END $$;

-- El orden respeta las dependencias, aunque CASCADE lo haría innecesario.
DROP TABLE IF EXISTS public.payments           CASCADE;
DROP TABLE IF EXISTS public.incidents          CASCADE;
DROP TABLE IF EXISTS public.request_cargo_items CASCADE;
DROP TABLE IF EXISTS public.requests           CASCADE;
DROP TABLE IF EXISTS public.driver_factors     CASCADE;
DROP TABLE IF EXISTS public.vehicles           CASCADE;
DROP TABLE IF EXISTS public.drivers            CASCADE;
DROP TABLE IF EXISTS public.clients            CASCADE;

COMMIT;
