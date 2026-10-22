-- ===========================================================================
-- Fletes Express - Datos iniciales (OPCIONAL)
-- ---------------------------------------------------------------------------
-- PARA QUE SIRVE
--   Carga la misma información que veías en la demo (choferes, vehículos,
--   clientes, solicitudes y pagos) para que la app se vea igual
--   apenas conectás la base real.
--
-- COMO USARLO
--   Ejecutar DESPUES de schema.sql, en Supabase > SQL Editor.
--
-- SEGURIDAD
--   Es IDEMPOTENTE: usa ON CONFLICT DO NOTHING. Se puede ejecutar más de una
--   vez sin duplicar filas ni romper datos existentes.
-- ===========================================================================

-- ------------------------------- USUARIOS ---------------------------------
-- rol = 'chofer': iniciales + tarifas (las edita el chofer en su perfil).
INSERT INTO usuarios (id, rol, nombre, telefono, email, iniciales, estado, tarifa_base, tarifa_por_km, tarifa_por_hora) VALUES
    ('MR', 'chofer', 'Marcelo Rodríguez', '11 5551-9001', 'marcelo@fletesexpress.com.ar', 'MR', 'Activo', 65000, 900, 12000),
    ('HP', 'chofer', 'Hernán Pérez',       '11 5558-1230', 'hernan@fletesexpress.com.ar', 'HP', 'Activo', 62000, 850, 11000),
    ('JA', 'chofer', 'Jorge Almada',       '11 5550-6612', 'jorge@fletesexpress.com.ar',  'JA', 'Activo', 58000, 800, 10000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, rol, nombre, telefono, email, iniciales, estado) VALUES
    ('ADM-01', 'admin', 'María Rodríguez', '11 5000-0001', 'admin@fletesexpress.com.ar', 'MR', 'Activo')
ON CONFLICT (id) DO NOTHING;

-- rol = 'cliente': sin login, solo datos de contacto.
INSERT INTO usuarios (id, rol, nombre, telefono) VALUES
    ('CLI-001', 'cliente', 'Lucía Benítez',      '11 4500-1287'),
    ('CLI-002', 'cliente', 'Martín Acosta',      '11 3988-6201'),
    ('CLI-003', 'cliente', 'Estudio Norte SRL',  '11 4702-3344'),
    ('CLI-004', 'cliente', 'Kevin',              '11 3291-5140'),
    ('CLI-005', 'cliente', 'Estudio Sur',        '11 4811-5560'),
    ('CLI-006', 'cliente', 'Marta Ríos',         '11 6112-7789'),
    ('CLI-007', 'cliente', 'Tomás Vidal',        '11 6103-4422'),
    ('CLI-008', 'cliente', 'Paula Sosa',         '11 5120-9913')
ON CONFLICT (id) DO NOTHING;

INSERT INTO factores_tarifa (usuario_id, etiqueta, monto, posicion)
SELECT v.usuario_id, v.etiqueta, v.monto, v.posicion
FROM (VALUES
    ('MR', 'Espera por ascensor', 3500, 0),
    ('MR', 'Carga frágil', 6000, 1),
    ('HP', 'Estacionamiento', 2500, 0),
    ('HP', 'Subida de pisos sin ascensor', 4000, 1),
    ('JA', 'Espera por ascensor', 3000, 0),
    ('JA', 'Objetos frágiles', 5000, 1)
) AS v(usuario_id, etiqueta, monto, posicion)
WHERE NOT EXISTS (
    SELECT 1 FROM factores_tarifa f
    WHERE f.usuario_id = v.usuario_id AND f.etiqueta = v.etiqueta AND f.posicion = v.posicion
);

INSERT INTO vehiculos (id, tipo, capacidad_kg, estado, nota_asignacion) VALUES
    ('MOV-01', 'Furgón grande',     1500, 'Disponible', NULL),
    ('MOV-04', 'Furgón chico',       500, 'Asignado',   'FEX-1047 · hasta 14:00'),
    ('MOV-05', 'Camión mudancero',  3500, 'Disponible', NULL),
    ('MOV-07', 'Camión mediano',    2000, 'En taller',  'En taller · no asignable')
ON CONFLICT (id) DO NOTHING;

INSERT INTO solicitudes (
    id, cliente_id, cliente_nombre, telefono, estado, fecha,
    llegada_desde, llegada_hasta, servicio_desde, servicio_hasta,
    origen_direccion, origen_barrio, origen_piso, origen_ascensor,
    destino_direccion, destino_barrio, destino_piso, destino_ascensor,
    carga_unidades, carga_fragil, carga_notas,
    chofer_id, vehiculo_id, precio, sena_requerida, km_estimados, horas_estimadas
) VALUES
    ('FEX-1048', 'CLI-004',
     'Kevin', '11 3291-5140', 'Pendiente de seña', '2026-09-24',
     '09:00', '11:00', '11:00', '13:00',
     'Armenia 1450', 'Palermo', 'Piso 3', true,
     'Ruiz Huidobro 2500', 'Saavedra', 'Piso 1', false,
     12, true, 'Coordinar estacionamiento; sillón desmontable.',
     'JA', 'MOV-05', 185000, 92500, 18, 2),
    ('FEX-1047', 'CLI-005',
     'Estudio Sur', '11 4811-5560', 'Confirmada', '2026-09-24',
     '12:00', '14:00', '12:00', '14:00',
     'Av. Cabildo 1800', 'Belgrano', 'Planta baja', true,
     'Uruguay 300', 'Recoleta', 'Piso 2', true,
     8, true, 'Retirar llaves en administración.',
     'HP', 'MOV-04', 325000, 162500, NULL, NULL),
    ('FEX-1046', 'CLI-006',
     'Marta Ríos', '11 6112-7789', 'Confirmada', '2026-09-24',
     '08:00', '10:00', '10:00', '12:00',
     'Av. Corrientes 5200', 'Villa Crespo', 'Piso 2', true,
     'Fitz Roy 2100', 'Caballito', 'Piso 1', false,
     6, false, 'Disponer de lugar para estacionar frente al edificio.',
     'MR', 'MOV-01', 240000, 120000, NULL, NULL),
    ('FEX-1049', 'CLI-007',
     'Tomás Vidal', '11 6103-4422', 'Pendiente de revisión', '2026-09-26',
     '09:00', '11:00', '10:00', '12:00',
     'Av. Medrano 700', 'Almagro', 'Piso 5', true,
     'Av. San Martín 5900', 'Villa Devoto', 'Piso 1', true,
     8, true, 'Ingreso por el pasillo lateral.',
     NULL, NULL, 0, 0, NULL, NULL),
    ('FEX-1044', 'CLI-008',
     'Paula Sosa', '11 5120-9913', 'Cancelada', '2026-09-20',
     '14:00', '16:00', '14:00', '16:00',
     'Quesada 3300', 'Núñez', 'Piso 3', true,
     'Av. Cabildo 980', 'Colegiales', 'Piso 1', true,
     9, false, 'Cancelada por el cliente.',
     NULL, NULL, 0, 0, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO items_carga (solicitud_id, nombre, unidades, nota, posicion)
SELECT v.solicitud_id, v.nombre, v.unidades, v.nota, v.posicion
FROM (VALUES
    ('FEX-1048', 'Heladera', 1, NULL, 0),
    ('FEX-1048', 'Sofá de 2 cuerpos, desmontable', 1, NULL, 1),
    ('FEX-1048', 'Cajas', 10, NULL, 2),
    ('FEX-1047', 'Escritorios y sillas de oficina', 6, NULL, 0),
    ('FEX-1046', 'Muebles de living', 5, NULL, 0),
    ('FEX-1049', 'Heladera y cajas', 7, NULL, 0),
    ('FEX-1044', 'Cajas y bolsos', 9, NULL, 0)
) AS v(solicitud_id, nombre, unidades, nota, posicion)
WHERE NOT EXISTS (
    SELECT 1 FROM items_carga i
    WHERE i.solicitud_id = v.solicitud_id AND i.nombre = v.nombre AND i.posicion = v.posicion
);

INSERT INTO pagos (solicitud_id, concepto, metodo, recibido_por, monto, fecha, notas)
SELECT v.solicitud_id, v.concepto, v.metodo, v.recibido_por, v.monto, v.fecha::date, v.notas
FROM (VALUES
    ('FEX-1046', 'Seña',  'Transferencia',    'Administración', 120000, '2026-09-22', 'Seña 50%'),
    ('FEX-1046', 'Saldo', 'Efectivo',         'Chofer',          60000, '2026-09-23', 'Pago parcial en destino'),
    ('FEX-1047', 'Seña',  'Cuenta corriente', 'Administración', 162500, '2026-09-23', 'Seña 50% reserva')
) AS v(solicitud_id, concepto, metodo, recibido_por, monto, fecha, notas)
WHERE NOT EXISTS (
    SELECT 1 FROM pagos p
    WHERE p.solicitud_id = v.solicitud_id
      AND p.concepto = v.concepto
      AND p.monto = v.monto
      AND p.fecha = v.fecha::date
);
