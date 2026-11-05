-- Fletes Express - Migración: elimina las tablas del mock original
--
-- ADVERTENCIA: BORRA DATOS SIN VERIFICAR
--   Elimina las 8 tablas del mock con todo su contenido, tengan filas o no.
--   No hay rollback. Pensada para bases descartables (entorno de prueba que
--   se recarga a mano). Si necesitás conservar algo, no la ejecutes.
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
-- QUÉ SE BORRA
--   clients, drivers, driver_factors, vehicles, requests,
--   request_cargo_items, incidents, payments.
--   CASCADE arrastra además cualquier objeto que dependa de ellas.
--
-- QUÉ NO SE TOCA
--   usuarios, vehiculos, solicitudes, items_carga, pagos,
--   configuracion_sistema y las vistas (v_personal, v_solicitudes,
--   v_agenda_confirmada, v_remitos_pendientes, v_recaudacion_usuario).
--
-- ANTES DE EJECUTAR (opcional, solo lectura)
--   Para saber cuántas filas vas a perder, corré aparte:
--
--     SELECT 'clients' AS tabla, count(*) FROM clients
--     UNION ALL SELECT 'drivers', count(*) FROM drivers
--     UNION ALL SELECT 'driver_factors', count(*) FROM driver_factors
--     UNION ALL SELECT 'vehicles', count(*) FROM vehicles
--     UNION ALL SELECT 'requests', count(*) FROM requests
--     UNION ALL SELECT 'request_cargo_items', count(*) FROM request_cargo_items
--     UNION ALL SELECT 'incidents', count(*) FROM incidents
--     UNION ALL SELECT 'payments', count(*) FROM payments;
--
-- Ejecutar manualmente en Supabase > SQL Editor.

BEGIN;

-- El orden respeta las dependencias, aunque CASCADE lo haría innecesario.
DROP TABLE IF EXISTS public.payments            CASCADE;
DROP TABLE IF EXISTS public.incidents           CASCADE;
DROP TABLE IF EXISTS public.request_cargo_items CASCADE;
DROP TABLE IF EXISTS public.requests            CASCADE;
DROP TABLE IF EXISTS public.driver_factors      CASCADE;
DROP TABLE IF EXISTS public.vehicles            CASCADE;
DROP TABLE IF EXISTS public.drivers             CASCADE;
DROP TABLE IF EXISTS public.clients             CASCADE;

COMMIT;
