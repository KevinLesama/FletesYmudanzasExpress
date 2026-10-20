-- ===========================================================================
-- Fletes Express - Datos iniciales (OPCIONAL)
-- ---------------------------------------------------------------------------
-- PARA QUE SIRVE
--   Carga la misma información que veías en la demo (choferes, vehículos,
--   clientes, solicitudes, incidentes y pagos) para que la app se vea igual
--   apenas conectás la base real.
--
-- COMO USARLO
--   Ejecutar DESPUES de schema.sql, en Supabase > SQL Editor.
--
-- SEGURIDAD
--   Es IDEMPOTENTE: usa ON CONFLICT DO NOTHING. Se puede ejecutar más de una
--   vez sin duplicar filas ni romper datos existentes.
-- ===========================================================================

INSERT INTO clients (name, phone) VALUES
    ('Lucía Benítez', '11 4500-1287'),
    ('Martín Acosta', '11 3988-6201'),
    ('Estudio Norte SRL', '11 4702-3344'),
    ('Kevin', '11 3291-5140'),
    ('Estudio Sur', '11 4811-5560'),
    ('Marta Ríos', '11 6112-7789'),
    ('Tomás Vidal', '11 6103-4422'),
    ('Paula Sosa', '11 5120-9913')
ON CONFLICT (name, phone) DO NOTHING;

INSERT INTO drivers (id, initials, name, phone, status, base_rate, rate_per_km, rate_per_hour) VALUES
    ('MR', 'MR', 'Marcelo Rodríguez', '11 5551-9001', 'Activo', 65000, 900, 12000),
    ('HP', 'HP', 'Hernán Pérez',       '11 5558-1230', 'Activo', 62000, 850, 11000),
    ('JA', 'JA', 'Jorge Almada',       '11 5550-6612', 'Activo', 58000, 800, 10000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO driver_factors (driver_id, label, amount, position) VALUES
    ('MR', 'Espera por ascensor', 3500, 0),
    ('MR', 'Carga frágil', 6000, 1),
    ('HP', 'Estacionamiento', 2500, 0),
    ('HP', 'Subida de pisos sin ascensor', 4000, 1),
    ('JA', 'Espera por ascensor', 3000, 0),
    ('JA', 'Objetos frágiles', 5000, 1);

INSERT INTO vehicles (id, type, capacity_kg, status, assigned_note) VALUES
    ('MOV-01', 'Furgón grande',     1500, 'Disponible', NULL),
    ('MOV-04', 'Furgón chico',       500, 'Asignado',   'FEX-1047 · hasta 14:00'),
    ('MOV-05', 'Camión mudancero',  3500, 'Disponible', NULL),
    ('MOV-07', 'Camión mediano',    2000, 'En taller',  'En taller · no asignable')
ON CONFLICT (id) DO NOTHING;

INSERT INTO requests (
    id, client_id, client_name, phone, status, date,
    arrival_from, arrival_to, service_from, service_to,
    origin_address, origin_barrio, origin_floor, origin_elevator,
    destination_address, destination_barrio, destination_floor, destination_elevator,
    cargo_approx_units, cargo_fragile, cargo_notes,
    driver_id, vehicle_id, price, deposit_required, confirmed, estimated_km, estimated_hours,
    arrived_at, finished_at
) VALUES
    ('FEX-1048', (SELECT id FROM clients WHERE name='Kevin' AND phone='11 3291-5140'),
     'Kevin', '11 3291-5140', 'Pendiente de seña', '2026-09-24',
     '09:00', '11:00', '11:00', '13:00',
     'Armenia 1450', 'Palermo', 'Piso 3', true,
     'Ruiz Huidobro 2500', 'Saavedra', 'Piso 1', false,
     12, true, 'Coordinar estacionamiento; sillón desmontable.',
     'JA', 'MOV-05', 185000, 92500, false, 18, 2,
     '2026-09-24T11:02', NULL),
    ('FEX-1047', (SELECT id FROM clients WHERE name='Estudio Sur' AND phone='11 4811-5560'),
     'Estudio Sur', '11 4811-5560', 'Confirmada', '2026-09-24',
     '12:00', '14:00', '12:00', '14:00',
     'Av. Cabildo 1800', 'Belgrano', 'Planta baja', true,
     'Uruguay 300', 'Recoleta', 'Piso 2', true,
     8, true, 'Retirar llaves en administración.',
     'HP', 'MOV-04', 325000, 162500, true, NULL, NULL,
     NULL, NULL),
    ('FEX-1046', (SELECT id FROM clients WHERE name='Marta Ríos' AND phone='11 6112-7789'),
     'Marta Ríos', '11 6112-7789', 'Confirmada', '2026-09-24',
     '08:00', '10:00', '10:00', '12:00',
     'Av. Corrientes 5200', 'Villa Crespo', 'Piso 2', true,
     'Fitz Roy 2100', 'Caballito', 'Piso 1', false,
     6, false, 'Disponer de lugar para estacionar frente al edificio.',
     'MR', 'MOV-01', 240000, 120000, true, NULL, NULL,
     NULL, NULL),
    ('FEX-1049', (SELECT id FROM clients WHERE name='Tomás Vidal' AND phone='11 6103-4422'),
     'Tomás Vidal', '11 6103-4422', 'Pendiente de revisión', '2026-09-26',
     '09:00', '11:00', '10:00', '12:00',
     'Av. Medrano 700', 'Almagro', 'Piso 5', true,
     'Av. San Martín 5900', 'Villa Devoto', 'Piso 1', true,
     8, true, 'Ingreso por el pasillo lateral.',
     NULL, NULL, 0, 0, false, NULL, NULL,
     NULL, NULL),
    ('FEX-1044', (SELECT id FROM clients WHERE name='Paula Sosa' AND phone='11 5120-9913'),
     'Paula Sosa', '11 5120-9913', 'Cancelada', '2026-09-20',
     '14:00', '16:00', '14:00', '16:00',
     'Quesada 3300', 'Núñez', 'Piso 3', true,
     'Av. Cabildo 980', 'Colegiales', 'Piso 1', true,
     9, false, 'Cancelada por el cliente.',
     NULL, NULL, 0, 0, false, NULL, NULL,
     NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO request_cargo_items (request_id, name, units, note, position) VALUES
    ('FEX-1048', 'Heladera', 1, NULL, 0),
    ('FEX-1048', 'Sofá de 2 cuerpos, desmontable', 1, NULL, 1),
    ('FEX-1048', 'Cajas', 10, NULL, 2),
    ('FEX-1047', 'Escritorios y sillas de oficina', 6, NULL, 0),
    ('FEX-1046', 'Muebles de living', 5, NULL, 0),
    ('FEX-1049', 'Heladera y cajas', 7, NULL, 0),
    ('FEX-1044', 'Cajas y bolsos', 9, NULL, 0);

INSERT INTO incidents (id, request_id, type, description, time) VALUES
    ('INC-1001', 'FEX-1048', 'Demora',
     'El cliente retiraba las llaves en administración; esperé unos minutos.',
     '2026-09-24T11:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (request_id, concept, method, received_by, amount, date, notes) VALUES
    ('FEX-1046', 'Seña',  'Transferencia', 'Administración', 120000, '2026-09-22', 'Seña 50%'),
    ('FEX-1046', 'Saldo', 'Transferencia', 'Chofer',          60000, '2026-09-23', 'Pago parcial en destino'),
    ('FEX-1047', 'Seña',  'Efectivo',      'Administración', 162500, '2026-09-23', 'Seña 50% reserva');
