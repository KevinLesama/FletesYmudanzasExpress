-- ===========================================================================
-- Fletes Express - Datos de demostración (OPCIONAL)
-- ---------------------------------------------------------------------------
-- PARA QUÉ SIRVE
--   Carga el mismo escenario que se ve en la demo: administradores, choferes,
--   flota, clientes, viajes en los cuatro estados, carga y cobros. Sirve para
--   probar el panel y las vistas sin cargar datos a mano.
--
-- CUÁNDO USARLO
--   Ejecutar DESPUÉS de schema.sql y de auth.sql, en Supabase > SQL Editor
--   (o con psql -f backend/sql/seed.sql).
--
-- ES IDEMPOTENTE
--   Se puede correr más de una vez sin duplicar filas. No usa IDs fijos: cada
--   bloque busca si la fila ya existe por su clave de negocio (rol+teléfono,
--   patente normalizada, código de viaje, etc.) y solo inserta lo que falta.
--
-- QUÉ CONTIENE
--   13 usuarios   2 administradores + 3 choferes + 8 clientes
--    4 vehículos  3 operativos + 1 en taller
--    6 viajes      2 pendientes, 2 confirmados, 1 finalizado, 1 cancelado
--    8 ítems de carga
--    5 pagos
--
-- LOS VIAJES
--   FEX-1001  pendiente   sin asignar y sin cotizar (llega de la landing)
--   FEX-1002  confirmada  Hernán + furgón chico; seña por transferencia
--   FEX-1003  confirmada  Marcelo + furgón grande; saldo en efectivo SIN
--                         remito: es el caso que aparece en v_remitos_pendientes
--   FEX-1004  pendiente   sin asignar y sin cotizar
--   FEX-1005  cancelada   conserva motivo; no ocupa agenda
--   FEX-1006  finalizada  Jorge + camión; remito R-0001 cargado y saldo en
--                         efectivo cobrado en destino
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. USUARIOS
-- ---------------------------------------------------------------------------
-- Los tres roles viven en la misma tabla. La clave para no duplicar es
-- (rol, teléfono): el mismo número puede existir como chofer y como cliente,
-- porque son dos figuras distintas del negocio.
-- Las tarifas y la licencia solo van en los choferes: los CHECK de la tabla
-- rechazan que un administrador o un cliente las tenga.
-- ---------------------------------------------------------------------------
WITH datos (
    rol, nombre, telefono, email, licencia,
    tarifa_base, tarifa_por_km, tarifa_por_hora, notas
) AS (
    VALUES
    -- Administradores
    ('administrador', 'Administración', '11 5555-0001', 'admin@fletesexpress.com.ar',
     NULL, 0, 0, 0, 'Cuenta principal del panel.'),
    ('administrador', 'Diego Ferreyra', '11 5555-0002', 'diego@fletesexpress.com.ar',
     NULL, 0, 0, 0, 'Administración; misma visibilidad que la cuenta principal.'),

    -- Choferes
    ('chofer', 'Marcelo Rodríguez', '11 5551-9001', 'marcelo@fletesexpress.com.ar',
     'L-1145', 65000, 900, 12000, 'Chofer de furgón grande.'),
    ('chofer', 'Hernán Pérez', '11 5558-1230', 'hernan@fletesexpress.com.ar',
     'L-2087', 62000, 850, 11000, NULL),
    ('chofer', 'Jorge Almada', '11 5550-6612', 'jorge@fletesexpress.com.ar',
     'L-3302', 58000, 800, 10000, 'Chofer de camión mudancero.'),

    -- Clientes (contactos de la empresa: NO inician sesión)
    ('cliente', 'Lucía Benítez', '11 4500-1287', NULL, NULL, 0, 0, 0, NULL),
    ('cliente', 'Martín Acosta', '11 3988-6201', NULL, NULL, 0, 0, 0, NULL),
    ('cliente', 'Estudio Norte SRL', '11 4702-3344', 'lucia@estudionorte.com.ar',
     NULL, 0, 0, 0, 'Contacto de la empresa: Lucía. No es una cuenta del sistema.'),
    ('cliente', 'Kevin', '11 3291-5140', NULL, NULL, 0, 0, 0, NULL),
    ('cliente', 'Estudio Sur', '11 4811-5560', NULL, NULL, 0, 0, 0, NULL),
    ('cliente', 'Marta Ríos', '11 6112-7789', NULL, NULL, 0, 0, 0, NULL),
    ('cliente', 'Tomás Vidal', '11 6103-4422', NULL, NULL, 0, 0, 0, NULL),
    ('cliente', 'Paula Sosa', '11 5120-9913', NULL, NULL, 0, 0, 0, NULL)
)
INSERT INTO usuarios (
    rol, nombre, telefono, email, licencia,
    tarifa_base, tarifa_por_km, tarifa_por_hora, notas
)
SELECT
    d.rol, d.nombre, d.telefono, d.email, d.licencia,
    d.tarifa_base::numeric(12,2),
    d.tarifa_por_km::numeric(12,2),
    d.tarifa_por_hora::numeric(12,2),
    d.notas
FROM datos d
WHERE NOT EXISTS (
    SELECT 1
      FROM usuarios u
     WHERE u.rol = d.rol
       AND regexp_replace(u.telefono, '\D', '', 'g')
         = regexp_replace(d.telefono, '\D', '', 'g')
);


-- ---------------------------------------------------------------------------
-- 2. VEHÍCULOS
-- ---------------------------------------------------------------------------
-- La flota es independiente de los choferes. `estado` es la condición
-- operativa, no el uso: que un vehículo esté asignado a un viaje se deriva de
-- solicitudes (v_agenda_confirmada), no se guarda acá.
-- La patente se compara normalizada (sin espacios ni guiones, en mayúsculas),
-- igual que el índice único de la tabla.
-- ---------------------------------------------------------------------------
WITH datos (patente, tipo, capacidad_kg, estado, notas) AS (
    VALUES
    ('AF 123 BC', 'Furgón grande',    1500, 'disponible',       NULL),
    ('AF 456 DE', 'Furgón chico',      500, 'disponible',       NULL),
    ('AF 789 FG', 'Camión mudancero', 3500, 'disponible',       NULL),
    ('AF 012 GH', 'Camión mediano',   2000, 'en_taller',        'Frenos en revisión: no asignar.')
)
INSERT INTO vehiculos (patente, tipo, capacidad_kg, estado, notas)
SELECT d.patente, d.tipo, d.capacidad_kg, d.estado, d.notas
FROM datos d
WHERE NOT EXISTS (
    SELECT 1
      FROM vehiculos v
     WHERE upper(regexp_replace(v.patente, '[\s-]', '', 'g'))
         = upper(regexp_replace(d.patente, '[\s-]', '', 'g'))
);


-- ---------------------------------------------------------------------------
-- 3. VIAJES
-- ---------------------------------------------------------------------------
-- Se cargan los cuatro estados. Los códigos son explícitos para que la demo
-- sea estable y legible; la secuencia se ajusta al final del archivo.
--
-- Agenda: FEX-1003 (Marcelo, 08:00-10:00) y FEX-1002 (Hernán, 12:00-14:00)
-- no se solapan ni en chofer ni en vehículo. La finalizada FEX-1006 tampoco
-- compite: las restricciones EXCLUDE solo miran las confirmadas.
--
-- El cliente se resuelve por teléfono y el chofer por email: nunca por ID.
-- ---------------------------------------------------------------------------
WITH datos (
    codigo, cliente_tel, estado, fecha, hora_desde, hora_hasta,
    origen_direccion, origen_barrio, origen_piso, origen_ascensor, origen_notas,
    destino_direccion, destino_barrio, destino_piso, destino_ascensor, destino_notas,
    chofer_email, vehiculo_patente,
    km_estimados, horas_estimadas, precio_calculado, precio_final,
    motivo_cancelacion, notas
) AS (
    VALUES
    ('FEX-1001', '11 3291-5140', 'pendiente', '2026-09-24', '09:00', '11:00',
     'Armenia 1450', 'Palermo', 'Piso 3', true,
     'Coordinar estacionamiento; sillón desmontable.',
     'Ruiz Huidobro 2500', 'Saavedra', 'Piso 1', false, NULL,
     NULL, NULL,
     NULL, NULL, NULL, 0,
     NULL, 'Llegó desde la landing: falta revisar y cotizar.'),

    ('FEX-1002', '11 4811-5560', 'confirmada', '2026-09-24', '12:00', '14:00',
     'Av. Cabildo 1800', 'Belgrano', 'Planta baja', true,
     'Retirar llaves en administración.',
     'Uruguay 300', 'Recoleta', 'Piso 2', true, NULL,
     'hernan@fletesexpress.com.ar', 'AF 456 DE',
     18, 2, 325000, 325000,
     NULL, NULL),

    ('FEX-1003', '11 6112-7789', 'confirmada', '2026-09-24', '08:00', '10:00',
     'Av. Corrientes 5200', 'Villa Crespo', 'Piso 2', true, NULL,
     'Fitz Roy 2100', 'Caballito', 'Piso 1', false,
     'Disponer de lugar para estacionar frente al edificio.',
     'marcelo@fletesexpress.com.ar', 'AF 123 BC',
     14, 2, 240000, 240000,
     NULL, NULL),

    ('FEX-1004', '11 6103-4422', 'pendiente', '2026-09-26', '09:00', '11:00',
     'Av. Medrano 700', 'Almagro', 'Piso 5', true,
     'Ingreso por el pasillo lateral.',
     'Av. San Martín 5900', 'Villa Devoto', 'Piso 1', true, NULL,
     NULL, NULL,
     NULL, NULL, NULL, 0,
     NULL, NULL),

    ('FEX-1005', '11 5120-9913', 'cancelada', '2026-09-20', '14:00', '16:00',
     'Quesada 3300', 'Núñez', 'Piso 3', true, NULL,
     'Av. Cabildo 980', 'Colegiales', 'Piso 1', true, NULL,
     NULL, NULL,
     NULL, NULL, NULL, 0,
     'Cancelada por el cliente',
     'Se reprograma para la semana siguiente.')
)
INSERT INTO solicitudes (
    codigo, cliente_id, estado, fecha, hora_desde, hora_hasta,
    origen_direccion, origen_barrio, origen_piso, origen_ascensor, origen_notas,
    destino_direccion, destino_barrio, destino_piso, destino_ascensor, destino_notas,
    chofer_id, vehiculo_id,
    km_estimados, horas_estimadas, precio_calculado, precio_final,
    motivo_cancelacion, notas
)
SELECT
    d.codigo,
    cli.id,
    d.estado,
    d.fecha::date,
    d.hora_desde::time,
    d.hora_hasta::time,
    d.origen_direccion, d.origen_barrio, d.origen_piso, d.origen_ascensor, d.origen_notas,
    d.destino_direccion, d.destino_barrio, d.destino_piso, d.destino_ascensor, d.destino_notas,
    cho.id,
    veh.id,
    d.km_estimados::numeric(10,2),
    d.horas_estimadas::numeric(6,2),
    d.precio_calculado::numeric(12,2),
    d.precio_final::numeric(12,2),
    d.motivo_cancelacion,
    d.notas
FROM datos d
JOIN usuarios cli
  ON cli.rol = 'cliente'
 AND regexp_replace(cli.telefono, '\D', '', 'g')
   = regexp_replace(d.cliente_tel, '\D', '', 'g')
LEFT JOIN usuarios cho
  ON cho.rol = 'chofer'
 AND lower(cho.email) = lower(d.chofer_email)
LEFT JOIN vehiculos veh
  ON upper(regexp_replace(veh.patente, '[\s-]', '', 'g'))
   = upper(regexp_replace(d.vehiculo_patente, '[\s-]', '', 'g'))
WHERE NOT EXISTS (
    SELECT 1 FROM solicitudes s WHERE s.codigo = d.codigo
);


-- ---------------------------------------------------------------------------
-- 3.1 VIAJE FINALIZADO CON REMITO
-- ---------------------------------------------------------------------------
-- Se inserta aparte porque es el único con remito y fecha de cierre. Imita el
-- cierre real: el chofer termina la entrega, completa el papel, le saca la
-- foto y la sube; recién entonces el viaje pasa a 'finalizada'.
--
-- El INSERT no pasa por fn_validar_transicion_estado (solo valida UPDATE) y
-- tampoco por fn_validar_cierre_viaje (también es BEFORE UPDATE), así que el
-- seed puede cargar historial. Los pagos se insertan después, y como el
-- remito ya está cargado, el efectivo entra sin problema.
--
-- La ruta es ficticia: en producción sale del bucket de Supabase Storage.
-- ---------------------------------------------------------------------------
WITH datos (
    codigo, cliente_tel, chofer_email, vehiculo_patente, fecha, hora_desde, hora_hasta,
    origen_direccion, origen_barrio, destino_direccion, destino_barrio,
    precio_calculado, precio_final, finalizada_en,
    remito_numero, remito_ruta, remito_nombre,
    receptor_nombre, receptor_documento, notas
) AS (
    VALUES
    ('FEX-1006', '11 4500-1287', 'jorge@fletesexpress.com.ar', 'AF 789 FG',
     '2026-09-22', '10:00', '12:00',
     'Av. Rivadavia 4800', 'Caballito', 'Zapiola 1200', 'Villa Urquiza',
     180000, 180000, '2026-09-22 12:40:00-03'::timestamptz,
     'R-0001', 'solicitudes/FEX-1006/remito-20260922.jpg', 'remito-0001.jpg',
     'Ana Gómez', '28.445.910',
     'Cerrado en destino; el cliente firmó conforme.')
)
INSERT INTO solicitudes (
    codigo, cliente_id, estado, fecha, hora_desde, hora_hasta,
    origen_direccion, origen_barrio,
    destino_direccion, destino_barrio,
    chofer_id, vehiculo_id,
    precio_calculado, precio_final,
    finalizada_en, remito_numero, remito_ruta, remito_nombre,
    remito_subido_por_id, receptor_nombre, receptor_documento, notas
)
SELECT
    d.codigo,
    cli.id,
    'finalizada',
    d.fecha::date,
    d.hora_desde::time,
    d.hora_hasta::time,
    d.origen_direccion, d.origen_barrio,
    d.destino_direccion, d.destino_barrio,
    cho.id,
    veh.id,
    d.precio_calculado::numeric(12,2),
    d.precio_final::numeric(12,2),
    d.finalizada_en,
    d.remito_numero, d.remito_ruta, d.remito_nombre,
    cho.id,
    d.receptor_nombre, d.receptor_documento, d.notas
FROM datos d
JOIN usuarios cli
  ON cli.rol = 'cliente'
 AND regexp_replace(cli.telefono, '\D', '', 'g')
   = regexp_replace(d.cliente_tel, '\D', '', 'g')
JOIN usuarios cho
  ON cho.rol = 'chofer'
 AND lower(cho.email) = lower(d.chofer_email)
JOIN vehiculos veh
  ON upper(regexp_replace(veh.patente, '[\s-]', '', 'g'))
   = upper(regexp_replace(d.vehiculo_patente, '[\s-]', '', 'g'))
WHERE NOT EXISTS (
    SELECT 1 FROM solicitudes s WHERE s.codigo = d.codigo
);


-- ---------------------------------------------------------------------------
-- 4. CARGA
-- ---------------------------------------------------------------------------
-- Es el detalle de bultos y fragilidad. La clave para no duplicar es
-- (viaje, descripción, posición): la posición ordena la carga dentro del viaje.
-- ---------------------------------------------------------------------------
WITH datos (codigo, descripcion, cantidad, fragil, nota, posicion) AS (
    VALUES
    ('FEX-1001', 'Heladera', 1, false, NULL, 0),
    ('FEX-1001', 'Sofá de 2 cuerpos, desmontable', 1, false, NULL, 1),
    ('FEX-1001', 'Cajas', 10, false, NULL, 2),
    ('FEX-1002', 'Escritorios y sillas de oficina', 6, false, NULL, 0),
    ('FEX-1003', 'Muebles de living', 5, false, NULL, 0),
    ('FEX-1004', 'Heladera y cajas', 7, true, 'Embalar la heladera.', 0),
    ('FEX-1005', 'Cajas y bolsos', 9, false, NULL, 0),
    ('FEX-1006', 'Muebles de comedor', 4, false, 'Entregado sin daños.', 0)
)
INSERT INTO items_carga (solicitud_id, descripcion, cantidad, fragil, nota, posicion)
SELECT s.id, d.descripcion, d.cantidad, d.fragil, d.nota, d.posicion
FROM datos d
JOIN solicitudes s ON s.codigo = d.codigo
WHERE NOT EXISTS (
    SELECT 1
      FROM items_carga i
     WHERE i.solicitud_id = s.id
       AND i.descripcion = d.descripcion
       AND i.posicion = d.posicion
);


-- ---------------------------------------------------------------------------
-- 5. PAGOS
-- ---------------------------------------------------------------------------
-- Respetan fn_validar_pago: la suma por viaje no supera precio_final.
--   FEX-1002: 162.500 de 325.000 (solo seña, por transferencia)
--   FEX-1003: 120.000 + 60.000 = 180.000 de 240.000. El saldo es en efectivo y
--             el viaje sigue 'confirmada': es válido y por eso aparece en
--             v_remitos_pendientes (falta la foto del remito).
--   FEX-1006:  90.000 + 90.000 = 180.000 de 180.000. El saldo en efectivo se
--             cobró en destino y el remito R-0001 ya estaba cargado.
-- El que cobra es una persona (usuarios), no un texto libre.
-- ---------------------------------------------------------------------------
WITH datos (codigo, concepto, metodo, monto, fecha, receptor_email, notas) AS (
    VALUES
    ('FEX-1002', 'sena',  'transferencia', 162500, '2026-09-23',
     'admin@fletesexpress.com.ar', 'Seña 50% de la reserva.'),
    ('FEX-1003', 'sena',  'transferencia', 120000, '2026-09-22',
     'admin@fletesexpress.com.ar', 'Seña 50%.'),
    ('FEX-1003', 'saldo', 'efectivo',       60000, '2026-09-24',
     'marcelo@fletesexpress.com.ar', 'Cobro parcial en destino.'),
    ('FEX-1006', 'sena',  'transferencia',  90000, '2026-09-21',
     'admin@fletesexpress.com.ar', 'Seña 50%.'),
    ('FEX-1006', 'saldo', 'efectivo',       90000, '2026-09-22',
     'jorge@fletesexpress.com.ar', 'Cobrado en destino contra remito R-0001.')
)
INSERT INTO pagos (solicitud_id, concepto, metodo, monto, fecha, recibido_por_id, notas)
SELECT
    s.id, d.concepto, d.metodo, d.monto::numeric(12,2), d.fecha::date, u.id, d.notas
FROM datos d
JOIN solicitudes s ON s.codigo = d.codigo
JOIN usuarios u ON lower(u.email) = lower(d.receptor_email)
WHERE NOT EXISTS (
    SELECT 1
      FROM pagos p
     WHERE p.solicitud_id = s.id
       AND p.concepto = d.concepto
       AND p.metodo = d.metodo
       AND p.monto = d.monto::numeric(12,2)
);


-- ---------------------------------------------------------------------------
-- 6. AJUSTE DE LA SECUENCIA DE CÓDIGOS
-- ---------------------------------------------------------------------------
-- Los viajes de la demo se insertaron con código explícito, así que la
-- secuencia no avanzó. Sin este ajuste, el próximo viaje creado por la API
-- intentaría usar FEX-1001 y chocaría con uq_solicitudes_codigo.
-- GREATEST evita retroceder si la secuencia ya venía más adelante (por
-- ejemplo, después de varios INSERT fallidos que consumieron nextval).
-- ---------------------------------------------------------------------------
SELECT setval(
    'solicitudes_codigo_seq',
    GREATEST((SELECT last_value FROM solicitudes_codigo_seq), 1006)
);
