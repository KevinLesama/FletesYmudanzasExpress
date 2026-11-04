-- Fletes Express - reemplazo de solicitudes por escenarios de disponibilidad
--
-- DESTRUCTIVO: elimina todas las solicitudes existentes (actualmente se esperan
-- 43) y, por CASCADE, sus ítems de carga y pagos. Después carga casos sintéticos
-- en varias fechas. No elimina clientes, choferes ni vehículos existentes.
--
-- ATENCIÓN: al ejecutar, reemplaza las solicitudes actuales. El script aborta
-- si no encuentra exactamente 43 solicitudes antes de borrarlas.
--
-- Ejecutar solo después de aplicar las migraciones operativas y de descarga.
-- Todo corre en una transacción: si la carga falla, el borrado se revierte.
--
-- Códigos FEX-990000001 a FEX-990000010: ejemplos identificables para pruebas.
-- Los recursos sintéticos se conservan para que puedan reutilizarse en el panel.

BEGIN;

DO $$
DECLARE
    autorizar_reemplazo boolean := true;
    cantidad_actual bigint;
BEGIN
    IF NOT autorizar_reemplazo THEN
        RAISE EXCEPTION
            'Reemplazo cancelado. Revisá el SQL y establecé autorizar_reemplazo = TRUE para continuar.'
            USING HINT = 'Esta operación elimina solicitudes, ítems de carga y pagos existentes.';
    END IF;

    SELECT count(*) INTO cantidad_actual FROM solicitudes;
    IF cantidad_actual <> 43 THEN
        RAISE EXCEPTION
            'Reemplazo cancelado: se esperaban 43 solicitudes y se encontraron %.',
            cantidad_actual
            USING HINT = 'Verificá la base y actualizá el preflight deliberadamente si el total cambió.';
    END IF;
END
$$;

INSERT INTO usuarios (
    rol, nombre, telefono, email, licencia,
    tarifa_base, tarifa_por_km, tarifa_por_hora
)
VALUES
    ('cliente', 'Cliente pruebas disponibilidad', '11 5550 7101',
     'availability-test-client@example.invalid', NULL, 0, 0, 0),
    ('chofer', 'Chofer prueba disponibilidad 1', '11 5550 7102',
     'availability-test-driver1@example.invalid', 'TEST-AV-1', 50000, 800, 10000),
    ('chofer', 'Chofer prueba disponibilidad 2', '11 5550 7103',
     'availability-test-driver2@example.invalid', 'TEST-AV-2', 50000, 800, 10000)
ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO NOTHING;

INSERT INTO vehiculos (patente, tipo, capacidad_kg, estado, notas)
VALUES
    ('TSTAV01', 'Vehículo de prueba', 1500, 'disponible',
     'FEX datos sintéticos de disponibilidad'),
    ('TSTAV02', 'Vehículo de prueba', 2500, 'disponible',
     'FEX datos sintéticos de disponibilidad')
ON CONFLICT (upper(regexp_replace(patente, '[\s-]', '', 'g'))) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuarios
        WHERE email = 'availability-test-client@example.invalid'
          AND rol = 'cliente'
          AND nombre = 'Cliente pruebas disponibilidad'
    ) OR NOT EXISTS (
        SELECT 1 FROM usuarios
        WHERE email = 'availability-test-driver1@example.invalid'
          AND rol = 'chofer'
          AND nombre = 'Chofer prueba disponibilidad 1'
    ) OR NOT EXISTS (
        SELECT 1 FROM usuarios
        WHERE email = 'availability-test-driver2@example.invalid'
          AND rol = 'chofer'
          AND nombre = 'Chofer prueba disponibilidad 2'
    ) THEN
        RAISE EXCEPTION
            'No se pudieron validar los usuarios sintéticos de prueba; se cancela la carga.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM vehiculos WHERE patente = 'TSTAV01')
       OR NOT EXISTS (SELECT 1 FROM vehiculos WHERE patente = 'TSTAV02') THEN
        RAISE EXCEPTION
            'No se pudieron validar las patentes sintéticas; se cancela la carga.';
    END IF;
END
$$;

TRUNCATE TABLE solicitudes RESTART IDENTITY CASCADE;

WITH recursos AS (
    SELECT
        (SELECT id FROM usuarios
         WHERE email = 'availability-test-client@example.invalid') AS cliente_id,
        (SELECT id FROM usuarios
         WHERE email = 'availability-test-driver1@example.invalid') AS chofer_1,
        (SELECT id FROM usuarios
         WHERE email = 'availability-test-driver2@example.invalid') AS chofer_2,
        (SELECT id FROM vehiculos WHERE patente = 'TSTAV01') AS vehiculo_1,
        (SELECT id FROM vehiculos WHERE patente = 'TSTAV02') AS vehiculo_2
),
casos(
    codigo, dias, estado, hora_desde, hora_hasta, descarga_min,
    chofer_n, vehiculo_n, descripcion
) AS (
    VALUES
        ('FEX-990000001',  7, 'confirmada', time '09:00', time '11:00', 120, 1, 1,
         'Confirmada: bloquea chofer y vehículo hasta llegada + descarga + margen'),
        ('FEX-990000002',  7, 'pendiente',  time '11:30', time '12:30',  60, 1, 2,
         'Pendiente: advierte por conflicto con la agenda confirmada del chofer 1'),
        ('FEX-990000003',  7, 'confirmada', time '09:00', time '10:00',  30, 2, 2,
         'Confirmada: segundo recurso y descarga corta'),
        ('FEX-990000004',  7, 'pendiente',  time '10:30', time '11:30',  60, 2, 2,
         'Pendiente: advierte por conflicto con chofer y vehículo 2'),
        ('FEX-990000005', 10, 'confirmada', time '09:00', time '11:00',  60, 1, 1,
         'Confirmada en otra fecha: reserva extendida por descarga y margen'),
        ('FEX-990000006', 10, 'pendiente',  time '12:45', time '13:45',  60, 1, 2,
         'Pendiente: franja posterior a descarga y margen; permite probar traslado'),
        ('FEX-990000007', 10, 'confirmada', time '14:00', time '15:00',  30, 1, 2,
         'Confirmada: otro servicio del mismo chofer, sin solapamiento horario'),
        ('FEX-990000008', 10, 'pendiente',  time '14:30', time '15:30',  60, 2, 2,
         'Pendiente: advierte por vehículo ocupado por viaje confirmado'),
        ('FEX-990000009', 14, 'confirmada', time '10:00', time '12:00',  30, 2, 1,
         'Confirmada en tercera fecha: ejemplo de límite de descarga + margen'),
        ('FEX-990000010', 14, 'pendiente',  time '13:00', time '14:00',  60, 1, 1,
         'Pendiente: inicia justo al liberarse el vehículo, para probar límite semiabierto')
)
INSERT INTO solicitudes (
    codigo, cliente_id, estado, fecha, hora_desde, hora_hasta,
    origen_direccion, origen_barrio, origen_lat, origen_lng,
    destino_direccion, destino_barrio, destino_lat, destino_lng,
    chofer_id, vehiculo_id, descarga_min, carga_min, km_estimados,
    solicitante_nombre, solicitante_telefono, notas
)
SELECT
    c.codigo,
    r.cliente_id,
    c.estado,
    CURRENT_DATE + c.dias,
    c.hora_desde,
    c.hora_hasta,
    'Av. Corrientes 1000, CABA',
    'San Nicolás',
    -34.6037,
    -58.3816,
    'Plaza de Mayo, CABA',
    'Monserrat',
    -34.6083,
    -58.3702,
    CASE c.chofer_n WHEN 1 THEN r.chofer_1 ELSE r.chofer_2 END,
    CASE c.vehiculo_n WHEN 1 THEN r.vehiculo_1 ELSE r.vehiculo_2 END,
    c.descarga_min,
    60,
    10,
    'PRUEBA DISPONIBILIDAD - CASO ' || right(c.codigo, 1),
    '11 5550 7101',
    c.descripcion
FROM recursos r
CROSS JOIN casos c;

DO $$
BEGIN
    IF (SELECT count(*) FROM solicitudes) <> 10 THEN
        RAISE EXCEPTION
            'La carga de prueba no creó las 10 solicitudes esperadas; se revierte toda la transacción.';
    END IF;
END
$$;

COMMIT;
