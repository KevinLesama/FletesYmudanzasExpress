-- ===========================================================================
-- Fletes Express - instalador de la base (esquema + auth)
-- ---------------------------------------------------------------------------
-- QUÉ ES ESTE ARCHIVO
--   Un solo archivo con todo lo que hay que correr para dejar la base lista:
--     1) backend/sql/schema.sql -> esquema de negocio: usuarios (3 roles),
--        vehiculos, solicitudes (4 estados + remito), items_carga y pagos;
--        más las restricciones de agenda, la máquina de estados, los
--        disparadores, las vistas y el cierre de RLS.
--     2) backend/sql/auth.sql   -> usuarios.auth_user_id + indice unico y FK
--        a auth.users (solo si el proyecto es Supabase) + vista v_personal.
--   Es IDEMPOTENTE: se puede volver a correr sin romper nada.
--
-- CÓMO SE USA
--   - Supabase: SQL Editor > New query > pegar todo el archivo > Run.
--   - PostgreSQL local: psql -d <base> -f backend/sql/install.sql
--
--   Requiere la extensión btree_gist (viene con postgresql-contrib y con
--   Supabase). Sin ella no se crean las restricciones de agenda.
--
-- OPCIONAL (después o aparte)
--   backend/sql/seed.sql        -> datos de demostración (también idempotente)
--
-- OJO
--   Los datos que había antes eran de simulación, así que la forma de migrar es
--   recrear la base: DROP SCHEMA public CASCADE y correr este archivo.
--   Recordá volver a crear el esquema si lo borraste:
--     CREATE SCHEMA public;
--
-- NOTA
--   backend/sql/futuraBD.sql NO va acá: es el registro de decisiones y
--   pendientes (todo su DDL está comentado, no crea nada).
--
--   Archivo GENERADO: si modificás schema.sql o auth.sql, regeneralo con
--     python backend/sql/build_install.py
-- ===========================================================================


-- ===========================================================================
-- Fletes Express - Esquema de negocio para PostgreSQL / Supabase
-- ---------------------------------------------------------------------------
-- CÓMO USARLO
--   1. Supabase > SQL Editor > New query.
--   2. Pegar TODO este archivo y ejecutarlo.
--   3. Después correr backend/sql/auth.sql (vincula las cuentas de Supabase
--      Auth con la tabla usuarios) y, si querés datos de ejemplo,
--      backend/sql/seed.sql.
--
-- ALCANCE
--   - Pensado para una base VACÍA (proyecto de Supabase nuevo).
--   - Es IDEMPOTENTE: se puede ejecutar más de una vez sin romper nada.
--   - Todo está en español: tablas, columnas, índices, restricciones,
--     funciones, disparadores y vistas.
--
-- OJO CON LOS CAMBIOS DE ESTRUCTURA
--   Las restricciones se declaran DENTRO del CREATE TABLE para que el archivo
--   sea idempotente. Si una tabla ya existe, PostgreSQL la saltea completa y
--   NO agrega restricciones nuevas. Para cambiar la estructura de una tabla
--   que ya tiene datos de prueba, la vía es recrear el esquema:
--       DROP SCHEMA public CASCADE;
--       CREATE SCHEMA public;
--   y volver a correr este archivo.
--
-- MODELO (5 tablas)
--   usuarios     -> administradores, choferes y clientes (discriminados por rol)
--   vehiculos    -> flota, independiente de los choferes
--   solicitudes  -> viajes: estados pendiente | confirmada | finalizada |
--                   cancelada; incluye el remito digitalizado
--   items_carga  -> detalle de la carga de un viaje
--   pagos        -> cobros de un viaje (seña / saldo)
--
-- REGLAS DE NEGOCIO QUE ESTA BASE HACE CUMPLIR SOLA
--   1. El conflicto de agenda SOLO aplica a viajes en estado 'confirmada'.
--      Dos viajes pendientes pueden solaparse; al confirmar uno que choque
--      con otro confirmado, PostgreSQL rechaza la operación (código 23P01).
--   2. Un viaje no se puede confirmar ni finalizar sin chofer y vehículo.
--   3. Un cliente no puede figurar como chofer (ni al revés): las claves
--      foráneas están atadas al rol.
--   4. No se permite DELETE de usuarios, vehículos, viajes ni pagos.
--      La baja es lógica: usuarios.activo = false, solicitudes.estado =
--      'cancelada'. Los ítems de carga SÍ se pueden borrar: son líneas
--      editables de un viaje, no entidades.
--   5. Un pago no puede superar el precio final del viaje.
--   6. Un viaje cobrado en efectivo no se puede finalizar sin la foto del
--      remito. Si el cobro es por transferencia, no se exige.
--   7. Los estados solo avanzan: pendiente -> confirmada -> finalizada, o
--      pendiente/confirmada -> cancelada. 'finalizada' y 'cancelada' son
--      terminales.
--   8. Los totales (cobrado, saldo, bultos, disponibilidad) NO se guardan:
--      se calculan en las vistas del final del archivo.
--
-- ORDEN: respeta las dependencias (primero las tablas sin claves foráneas).
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 0. Requisitos
-- ---------------------------------------------------------------------------
-- btree_gist le da a GiST los operadores de igualdad que necesitan las
-- restricciones EXCLUDE de agenda. Viene con postgresql-contrib y Supabase
-- ya lo tiene disponible.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Correlativo de los códigos visibles (FEX-1001, FEX-1002, ...).
CREATE SEQUENCE IF NOT EXISTS solicitudes_codigo_seq START WITH 1001;


-- ===========================================================================
-- 1. USUARIOS
-- ---------------------------------------------------------------------------
-- Una sola tabla para las tres figuras del negocio, separadas por `rol`:
--   administrador -> accede a todo el panel
--   chofer        -> sus viajes, sus cobros y sus tarifas
--   cliente       -> contacto de la empresa, NO inicia sesión
--
-- El login NO vive acá: las cuentas se crean en Supabase Auth y se vinculan
-- por `auth_user_id` (lo agrega backend/sql/auth.sql).
--
-- Las tarifas y la licencia solo tienen sentido para un chofer. Como los tres
-- roles comparten tabla, las restricciones ck_usuarios_* impiden que un
-- administrador o un cliente tenga tarifas o licencia cargadas. El login
-- (auth.sql) SIEMPRE debe filtrar por rol: un cliente con email no es una
-- cuenta del sistema.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id              bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    rol             text          NOT NULL,
    nombre          text          NOT NULL,
    telefono        text          NOT NULL,
    email           text,           -- obligatorio para administradores y choferes
    licencia        text,           -- solo choferes
    tarifa_base     numeric(12,2) NOT NULL DEFAULT 0,
    tarifa_por_km   numeric(12,2) NOT NULL DEFAULT 0,
    tarifa_por_hora numeric(12,2) NOT NULL DEFAULT 0,
    notas           text,
    activo          boolean       NOT NULL DEFAULT true,
    creado_en       timestamptz   NOT NULL DEFAULT now(),
    actualizado_en  timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT ck_usuarios_rol CHECK (rol IN ('administrador', 'chofer', 'cliente')),
    CONSTRAINT ck_usuarios_nombre CHECK (length(btrim(nombre)) > 0),
    CONSTRAINT ck_usuarios_telefono CHECK (
        length(regexp_replace(telefono, '\D', '', 'g')) >= 6),
    CONSTRAINT ck_usuarios_email CHECK (
        email IS NULL OR (position('@' IN email) > 1 AND email = btrim(email))),

    -- Solo un chofer puede tener tarifas o licencia.
    CONSTRAINT ck_usuarios_tarifas CHECK (
        rol = 'chofer'
        OR (tarifa_base = 0 AND tarifa_por_km = 0 AND tarifa_por_hora = 0)),
    CONSTRAINT ck_usuarios_licencia CHECK (rol = 'chofer' OR licencia IS NULL),

    -- Administradores y choferes necesitan email para el login; el cliente no.
    CONSTRAINT ck_usuarios_email_personal CHECK (rol = 'cliente' OR email IS NOT NULL),

    -- Habilita las claves foráneas compuestas que atan los roles de un viaje.
    -- Es un índice redundante con la PK, pero PostgreSQL exige un UNIQUE
    -- exacto sobre las columnas referenciadas.
    CONSTRAINT uq_usuarios_id_rol UNIQUE (id, rol)
);

-- Un email no puede repetirse, sin importar mayúsculas. El cliente puede no
-- tener email, y los NULL no compiten, pero el índice es parcial para dejar
-- la intención explícita.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email
    ON usuarios (lower(email))
    WHERE email IS NOT NULL;

-- El mismo teléfono no se repite dentro del mismo rol. Se comparan solo los
-- dígitos, así "11 5551-9001" y "1155519001" son la misma persona.
-- El mismo número puede existir como chofer y como cliente: son dos roles
-- distintos del negocio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_rol_telefono
    ON usuarios (rol, regexp_replace(telefono, '\D', '', 'g'));

CREATE INDEX IF NOT EXISTS ix_usuarios_rol ON usuarios (rol) WHERE activo;

COMMENT ON TABLE usuarios IS
    'Administradores, choferes y clientes. El cliente es un contacto, no una cuenta.';
COMMENT ON COLUMN usuarios.activo IS
    'Baja lógica. En el personal deshabilita el acceso; en clientes, la reutilización.';


-- ===========================================================================
-- 2. VEHÍCULOS
-- ---------------------------------------------------------------------------
-- La flota es INDEPENDIENTE de los choferes: el admin asigna vehículo por
-- viaje, de forma flexible.
--
-- `estado` describe la condición operativa del vehículo, no su uso:
--   disponible | en_taller | fuera_de_servicio
-- "Está asignado a un viaje" NO se guarda: eso se deriva de `solicitudes`
-- (v_agenda_confirmada). Guardarlo obligaba a mantener a mano un dato que ya
-- existía en otra tabla y generaba las inconsistencias del esquema anterior.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS vehiculos (
    id              bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    patente         text          NOT NULL,
    tipo            text          NOT NULL,
    capacidad_kg    integer       NOT NULL,
    estado          text          NOT NULL DEFAULT 'disponible',
    notas           text,
    activo          boolean       NOT NULL DEFAULT true,
    creado_en       timestamptz   NOT NULL DEFAULT now(),
    actualizado_en  timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT ck_vehiculos_estado CHECK (
        estado IN ('disponible', 'en_taller', 'fuera_de_servicio')),
    CONSTRAINT ck_vehiculos_capacidad CHECK (capacidad_kg > 0),
    CONSTRAINT ck_vehiculos_patente CHECK (length(btrim(patente)) > 0),
    CONSTRAINT ck_vehiculos_tipo CHECK (length(btrim(tipo)) > 0)
);

-- La patente se compara sin espacios ni guiones y en mayúsculas:
-- "AF 123 BC", "af-123-bc" y "AF123BC" son el mismo vehículo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehiculos_patente
    ON vehiculos (upper(regexp_replace(patente, '[\s-]', '', 'g')));

CREATE INDEX IF NOT EXISTS ix_vehiculos_estado ON vehiculos (estado) WHERE activo;

COMMENT ON TABLE vehiculos IS
    'Flota de la empresa. El uso en un viaje se deriva de solicitudes.';
COMMENT ON COLUMN vehiculos.estado IS
    'Condición operativa: disponible | en_taller | fuera_de_servicio.';


-- ===========================================================================
-- 3. SOLICITUDES (viajes)
-- ---------------------------------------------------------------------------
-- Estados del negocio, y nada más:
--   pendiente  -> cargada, sin confirmar (puede solaparse con otras)
--   confirmada -> aceptada, con chofer y vehículo asignados (NO puede solapar)
--   finalizada -> entregada y cerrada; sale de la agenda. Es TERMINAL.
--   cancelada  -> anulada; conserva la asignación como historial. Es TERMINAL.
--
-- El avance entre estados NO es libre: lo controla fn_validar_transicion_estado.
--     pendiente  -> confirmada | cancelada
--     confirmada -> finalizada | cancelada
--     finalizada -> (nada)
--     cancelada  -> (nada)
--
-- Reglas que aplica la base:
--   * ck_solicitudes_con_chofer_y_vehiculo: no hay confirmación ni cierre sin
--     chofer y vehículo.
--   * ex_solicitudes_*_sin_solape: dos viajes confirmados del mismo chofer (o
--     del mismo vehículo) no pueden superponerse en fecha y horario. Se
--     implementa con EXCLUDE + GiST y SOLO mira las filas confirmadas, así
--     que pendientes, finalizados y cancelados quedan fuera del control.
--   * fn_validar_cierre_viaje: un viaje con plata en efectivo no se finaliza
--     sin la foto del remito.
--
-- REMITO
--   Es un papel físico, uno por viaje, que el chofer completa al terminar la
--   entrega. Se guarda digitalizado: `remito_ruta` es la ruta del archivo en
--   Supabase Storage (nunca el archivo ni un data URL dentro de la base).
--   `receptor_nombre` y `receptor_documento` son quienes firmaron la
--   conformidad; no viven en `usuarios` porque el receptor no es cliente de
--   la empresa.
--   Si el viaje se cobra por transferencia la foto no es obligatoria (el
--   movimiento bancario es la prueba); si hay efectivo, sí.
--
-- `cliente_rol` y `chofer_rol` son columnas constantes ('cliente' y 'chofer').
-- Existen únicamente para atar las claves foráneas al rol en `usuarios` y que
-- la base impida, por ejemplo, asignar un cliente como chofer de un viaje.
-- Este patrón además impide cambiar el rol de una persona que ya tiene viajes.
--
-- Dinero:
--   precio_calculado -> lo que dio la fórmula (base + km + hora)
--   precio_final     -> lo que se cobra; si el admin lo edita, queda auditado
--   precio_editado   -> NO se guarda: es precio_final <> precio_calculado y se
--                       expone en v_solicitudes
-- ===========================================================================
CREATE TABLE IF NOT EXISTS solicitudes (
    id                     bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    codigo                 text          NOT NULL
        DEFAULT ('FEX-' || lpad(nextval('solicitudes_codigo_seq')::text, 4, '0')),
    cliente_id             bigint        NOT NULL,
    cliente_rol            text          NOT NULL DEFAULT 'cliente',
    estado                 text          NOT NULL DEFAULT 'pendiente',
    fecha                  date          NOT NULL,
    hora_desde             time          NOT NULL,
    hora_hasta             time          NOT NULL,

    -- Origen
    origen_direccion       text          NOT NULL,
    origen_barrio          text,
    origen_piso            text,
    origen_ascensor        boolean       NOT NULL DEFAULT false,
    origen_notas           text,

    -- Destino
    destino_direccion      text          NOT NULL,
    destino_barrio         text,
    destino_piso           text,
    destino_ascensor       boolean       NOT NULL DEFAULT false,
    destino_notas          text,

    -- Asignación (flexible, la decide el admin al confirmar)
    chofer_id              bigint,
    chofer_rol             text          NOT NULL DEFAULT 'chofer',
    vehiculo_id            bigint,

    -- Cotización
    km_estimados           numeric(10,2),
    horas_estimadas        numeric(6,2),
    precio_calculado       numeric(12,2),
    precio_final           numeric(12,2) NOT NULL DEFAULT 0,
    precio_modificado_por  bigint,
    precio_modificado_en   timestamptz,

    -- Remito (papel físico digitalizado; uno por viaje)
    remito_numero          text,
    remito_ruta            text,
    remito_nombre          text,
    remito_subido_por_id   bigint,
    receptor_nombre        text,
    receptor_documento     text,

    -- Cierre
    finalizada_en          timestamptz,
    motivo_cancelacion     text,
    notas                  text,

    creado_en              timestamptz   NOT NULL DEFAULT now(),
    actualizado_en         timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT ck_solicitudes_codigo CHECK (codigo ~ '^FEX-[0-9]+$'),
    CONSTRAINT ck_solicitudes_estado CHECK (
        estado IN ('pendiente', 'confirmada', 'finalizada', 'cancelada')),
    CONSTRAINT ck_solicitudes_ventana CHECK (hora_hasta > hora_desde),
    CONSTRAINT ck_solicitudes_direcciones CHECK (
        length(btrim(origen_direccion)) > 0 AND length(btrim(destino_direccion)) > 0),
    CONSTRAINT ck_solicitudes_km CHECK (km_estimados IS NULL OR km_estimados >= 0),
    CONSTRAINT ck_solicitudes_horas CHECK (horas_estimadas IS NULL OR horas_estimadas > 0),
    CONSTRAINT ck_solicitudes_precios CHECK (
        (precio_calculado IS NULL OR precio_calculado >= 0) AND precio_final >= 0),
    CONSTRAINT ck_solicitudes_cliente_rol CHECK (cliente_rol = 'cliente'),
    CONSTRAINT ck_solicitudes_chofer_rol CHECK (chofer_rol = 'chofer'),
    CONSTRAINT ck_solicitudes_ajuste_auditado CHECK (
        precio_modificado_por IS NULL OR precio_modificado_en IS NOT NULL),

    -- No se confirma ni se finaliza un viaje sin chofer y vehículo.
    CONSTRAINT ck_solicitudes_con_chofer_y_vehiculo CHECK (
        estado NOT IN ('confirmada', 'finalizada')
        OR (chofer_id IS NOT NULL AND vehiculo_id IS NOT NULL)),

    -- Una finalizada tiene fecha de cierre; ninguna otra la tiene. Así el
    -- historial del panel no depende del estado solo.
    CONSTRAINT ck_solicitudes_finalizada_en CHECK (
        (estado = 'finalizada') = (finalizada_en IS NOT NULL)),

    -- Si hay nombre de archivo, tiene que haber ruta en Storage.
    CONSTRAINT ck_solicitudes_remito CHECK (
        remito_nombre IS NULL OR remito_ruta IS NOT NULL),

    -- Roles atados: un cliente no puede ser chofer y un chofer no puede ser el
    -- cliente del viaje. MATCH SIMPLE: con chofer_id NULL la FK no se controla.
    CONSTRAINT fk_solicitudes_cliente FOREIGN KEY (cliente_id, cliente_rol)
        REFERENCES usuarios (id, rol) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_chofer FOREIGN KEY (chofer_id, chofer_rol)
        REFERENCES usuarios (id, rol) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_vehiculo FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_precio_modificado_por FOREIGN KEY (precio_modificado_por)
        REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_remito_subido_por FOREIGN KEY (remito_subido_por_id)
        REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE RESTRICT,

    -- Agenda: solo los viajes confirmados reservan chofer.
    CONSTRAINT ex_solicitudes_chofer_sin_solape EXCLUDE USING gist (
        chofer_id WITH =,
        tsrange(fecha + hora_desde, fecha + hora_hasta, '[)') WITH &&
    ) WHERE (estado = 'confirmada'),

    -- Agenda: solo los viajes confirmados reservan vehículo.
    CONSTRAINT ex_solicitudes_vehiculo_sin_solape EXCLUDE USING gist (
        vehiculo_id WITH =,
        tsrange(fecha + hora_desde, fecha + hora_hasta, '[)') WITH &&
    ) WHERE (estado = 'confirmada')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_codigo ON solicitudes (codigo);

-- El talonario de remitos no repite número. NULL (viaje sin remito todavía)
-- no compite: por eso el índice es parcial.
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_remito_numero
    ON solicitudes (remito_numero) WHERE remito_numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_solicitudes_fecha         ON solicitudes (fecha);
CREATE INDEX IF NOT EXISTS ix_solicitudes_estado_fecha  ON solicitudes (estado, fecha);
CREATE INDEX IF NOT EXISTS ix_solicitudes_cliente_id    ON solicitudes (cliente_id);
CREATE INDEX IF NOT EXISTS ix_solicitudes_chofer_id     ON solicitudes (chofer_id);
CREATE INDEX IF NOT EXISTS ix_solicitudes_vehiculo_id   ON solicitudes (vehiculo_id);

COMMENT ON TABLE solicitudes IS
    'Viajes. Estados: pendiente | confirmada | finalizada | cancelada.';
COMMENT ON COLUMN solicitudes.codigo IS
    'Identificador visible (FEX-####). Se genera solo con solicitudes_codigo_seq.';
COMMENT ON COLUMN solicitudes.cliente_rol IS
    'Constante "cliente". Solo existe para que la FK verifique el rol en usuarios.';
COMMENT ON COLUMN solicitudes.chofer_rol IS
    'Constante "chofer". Solo existe para que la FK verifique el rol en usuarios.';
COMMENT ON COLUMN solicitudes.precio_final IS
    'Importe que se cobra. Puede diferir de precio_calculado por ajuste manual.';
COMMENT ON COLUMN solicitudes.finalizada_en IS
    'Momento del cierre. Obligatorio si y solo si estado = ''finalizada''.';
COMMENT ON COLUMN solicitudes.remito_numero IS
    'Número del talonario físico. Único; NULL mientras el remito no se cargó.';
COMMENT ON COLUMN solicitudes.remito_ruta IS
    'Ruta de la foto del remito en Supabase Storage (nunca el archivo embebido).';
COMMENT ON COLUMN solicitudes.remito_subido_por_id IS
    'Quién subió la foto del remito (normalmente el chofer del viaje).';
COMMENT ON COLUMN solicitudes.receptor_nombre IS
    'Quien firmó la conformidad en el remito (no es un usuario del sistema).';
COMMENT ON COLUMN solicitudes.motivo_cancelacion IS
    'Motivo de la baja del viaje. El viaje no se borra: estado = cancelada.';


-- ===========================================================================
-- 4. ITEMS DE CARGA
-- ---------------------------------------------------------------------------
-- Es el detalle de la carga. Reemplaza a las columnas carga_unidades,
-- carga_fragil y carga_notas del esquema anterior, que duplicaban esta
-- información en el encabezado del viaje.
--
-- Es una línea editable: SÍ admite DELETE (no es una entidad del negocio).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS items_carga (
    id              bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    solicitud_id    bigint        NOT NULL,
    descripcion     text          NOT NULL,
    cantidad        integer       NOT NULL DEFAULT 1,
    fragil          boolean       NOT NULL DEFAULT false,
    nota            text,
    posicion        integer       NOT NULL DEFAULT 0,
    creado_en       timestamptz   NOT NULL DEFAULT now(),
    actualizado_en  timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT ck_items_carga_descripcion CHECK (length(btrim(descripcion)) > 0),
    CONSTRAINT ck_items_carga_cantidad CHECK (cantidad > 0),
    CONSTRAINT fk_items_carga_solicitud FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_items_carga_solicitud_id ON items_carga (solicitud_id);

COMMENT ON TABLE items_carga IS
    'Detalle de la carga de un viaje. Fuente única de bultos y fragilidad.';


-- ===========================================================================
-- 5. PAGOS
-- ---------------------------------------------------------------------------
-- Un pago por cobro. La seña requerida NO se guarda en el viaje: es el 50 %
-- de precio_final para mostrarla, y lo efectivamente cobrado sale de acá.
--
--   metodo   -> efectivo | transferencia
--   concepto -> sena | saldo
--
-- `recibido_por_id` es QUIÉN cobró (administración o el chofer): es una
-- persona, no un texto. `comprobante_ruta` guarda la ruta del archivo en
-- Supabase Storage; nunca se guarda el archivo ni un data URL en la base.
--
-- El disparador fn_validar_pago impide cobrar más que precio_final, cobrar
-- sobre un viaje cancelado, y (en un viaje ya finalizado) registrar efectivo
-- sin la foto del remito.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS pagos (
    id                 bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    solicitud_id       bigint        NOT NULL,
    concepto           text          NOT NULL,
    metodo             text          NOT NULL,
    monto              numeric(12,2) NOT NULL,
    fecha              date          NOT NULL DEFAULT current_date,
    recibido_por_id    bigint        NOT NULL,
    comprobante_ruta   text,
    comprobante_nombre text,
    notas              text,
    creado_en          timestamptz   NOT NULL DEFAULT now(),
    actualizado_en     timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT ck_pagos_concepto CHECK (concepto IN ('sena', 'saldo')),
    CONSTRAINT ck_pagos_metodo CHECK (metodo IN ('efectivo', 'transferencia')),
    CONSTRAINT ck_pagos_monto CHECK (monto > 0),
    CONSTRAINT ck_pagos_comprobante CHECK (
        comprobante_nombre IS NULL OR comprobante_ruta IS NOT NULL),
    CONSTRAINT fk_pagos_solicitud FOREIGN KEY (solicitud_id)
        REFERENCES solicitudes (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pagos_recibido_por FOREIGN KEY (recibido_por_id)
        REFERENCES usuarios (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_pagos_solicitud_id     ON pagos (solicitud_id);
CREATE INDEX IF NOT EXISTS ix_pagos_fecha            ON pagos (fecha);
CREATE INDEX IF NOT EXISTS ix_pagos_recibido_por_id  ON pagos (recibido_por_id);

COMMENT ON TABLE pagos IS
    'Cobros de un viaje. No se borran: un error se corrige con UPDATE o una nota.';
COMMENT ON COLUMN pagos.comprobante_ruta IS
    'Ruta del comprobante en Supabase Storage (nunca el archivo embebido).';


-- ===========================================================================
-- 6. FUNCIONES Y DISPARADORES
-- ===========================================================================

-- 6.1 Sellar actualizado_en en cada UPDATE.
CREATE OR REPLACE FUNCTION fn_marcar_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

-- 6.2 Bloquear el DELETE de entidades (la baja es lógica).
CREATE OR REPLACE FUNCTION fn_prohibir_borrado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'La tabla % no admite DELETE: la baja es lógica.', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation',
              HINT = 'En usuarios y vehículos usá activo = false; en solicitudes usá estado = ''cancelada''.';
    RETURN NULL;
END;
$$;

-- 6.3 Los estados solo avanzan. Se valida únicamente en UPDATE: el INSERT
--     queda libre para cargar historial y para seed.sql.
CREATE OR REPLACE FUNCTION fn_validar_transicion_estado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.estado = OLD.estado THEN
        RETURN NEW;
    END IF;

    IF NOT (
           (OLD.estado = 'pendiente'  AND NEW.estado IN ('confirmada', 'cancelada'))
        OR (OLD.estado = 'confirmada' AND NEW.estado IN ('finalizada', 'cancelada'))
    ) THEN
        RAISE EXCEPTION
            'Transición de estado inválida: % -> %.', OLD.estado, NEW.estado
            USING ERRCODE = 'check_violation',
                  HINT = 'pendiente -> confirmada | cancelada; confirmada -> finalizada | cancelada. ''finalizada'' y ''cancelada'' son terminales.';
    END IF;

    RETURN NEW;
END;
$$;

-- 6.4 Un viaje con plata en efectivo no se finaliza sin la foto del remito.
--     El efectivo puede registrarse después del cierre: ese caso lo cubre
--     fn_validar_pago. Las dos puertas juntas cierran el circuito.
--     Además sella finalizada_en: el cierre es atómico y la API no puede
--     olvidarse de la columna que exige ck_solicitudes_finalizada_en.
--     Se dispara en TODO update para que nadie vacíe remito_ruta después.
CREATE OR REPLACE FUNCTION fn_validar_cierre_viaje()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sellar la marca de cierre acá evita que el llamador tenga que acordarse
    -- de mandar estado y finalizada_en juntos en el mismo UPDATE.
    IF NEW.estado = 'finalizada' AND NEW.finalizada_en IS NULL THEN
        NEW.finalizada_en := now();
    END IF;

    IF NEW.estado <> 'finalizada' OR NEW.remito_ruta IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pagos p
         WHERE p.solicitud_id = NEW.id
           AND p.metodo = 'efectivo'
    ) THEN
        RAISE EXCEPTION
            'El viaje % tiene cobros en efectivo y no tiene remito cargado.', NEW.codigo
            USING ERRCODE = 'check_violation',
                  HINT = 'Subí la foto del remito (remito_ruta) antes de finalizar el viaje.';
    END IF;

    RETURN NEW;
END;
$$;

-- 6.5 Un pago no puede superar el precio final del viaje, ni cobrarse sobre
--     un viaje cancelado, ni entrar en efectivo a un viaje ya finalizado sin
--     remito. Bloquea la fila del viaje con FOR UPDATE para que dos cobros
--     simultáneos no puedan pasar los dos: el segundo espera y recalcula.
CREATE OR REPLACE FUNCTION fn_validar_pago()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_precio  numeric(12,2);
    v_estado  text;
    v_remito  text;
    v_otros   numeric(12,2);
BEGIN
    SELECT precio_final, estado, remito_ruta
      INTO v_precio, v_estado, v_remito
      FROM solicitudes
     WHERE id = NEW.solicitud_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud % no existe.', NEW.solicitud_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_estado = 'cancelada' THEN
        RAISE EXCEPTION
            'No se puede registrar un cobro sobre el viaje cancelado %.',
            NEW.solicitud_id
            USING ERRCODE = 'check_violation',
                  HINT = 'Reactivá el viaje o cargá el cobro en el viaje correcto.';
    END IF;

    IF NEW.metodo = 'efectivo'
       AND v_estado = 'finalizada'
       AND v_remito IS NULL THEN
        RAISE EXCEPTION
            'El viaje % ya está finalizado y no tiene remito cargado.', NEW.solicitud_id
            USING ERRCODE = 'check_violation',
                  HINT = 'Cargá la foto del remito (remito_ruta) antes de registrar el efectivo.';
    END IF;

    SELECT COALESCE(sum(monto), 0)
      INTO v_otros
      FROM pagos
     WHERE solicitud_id = NEW.solicitud_id
       AND id IS DISTINCT FROM NEW.id;

    IF v_otros + NEW.monto > v_precio THEN
        RAISE EXCEPTION
            'El pago supera el precio del viaje (precio_final = %, cobrado = %, nuevo pago = %).',
            v_precio, v_otros, NEW.monto
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

-- 6.6 Disparadores.
--     Se recrean en cada corrida para que el archivo sea idempotente.
DO $$
DECLARE
    t text;
BEGIN
    -- actualizado_en en las 5 tablas
    FOREACH t IN ARRAY ARRAY[
        'usuarios', 'vehiculos', 'solicitudes', 'items_carga', 'pagos'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_actualizado_en ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER tr_%s_actualizado_en
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_marcar_actualizado_en()', t, t);
    END LOOP;

    -- DELETE prohibido en las entidades (no en items_carga)
    FOREACH t IN ARRAY ARRAY[
        'usuarios', 'vehiculos', 'solicitudes', 'pagos'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_%s_sin_borrar ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER tr_%s_sin_borrar
             BEFORE DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_prohibir_borrado()', t, t);
    END LOOP;

    -- Máquina de estados
    DROP TRIGGER IF EXISTS tr_solicitudes_transicion ON solicitudes;
    CREATE TRIGGER tr_solicitudes_transicion
        BEFORE UPDATE OF estado ON solicitudes
        FOR EACH ROW EXECUTE FUNCTION fn_validar_transicion_estado();

    -- Remito obligatorio al cerrar un viaje cobrado en efectivo
    DROP TRIGGER IF EXISTS tr_solicitudes_cierre ON solicitudes;
    CREATE TRIGGER tr_solicitudes_cierre
        BEFORE UPDATE ON solicitudes
        FOR EACH ROW EXECUTE FUNCTION fn_validar_cierre_viaje();

    -- Validación de montos y de estado del viaje al cobrar
    DROP TRIGGER IF EXISTS tr_pagos_validar_monto ON pagos;
    CREATE TRIGGER tr_pagos_validar_monto
        BEFORE INSERT OR UPDATE ON pagos
        FOR EACH ROW EXECUTE FUNCTION fn_validar_pago();
END;
$$;


-- ===========================================================================
-- 7. VISTAS (todo lo derivado vive acá, no en las tablas)
-- ===========================================================================

-- 7.1 Modelo de lectura del viaje: cliente, chofer, vehículo, totales y saldo.
--     Los agregados van en LATERAL para que los pagos y los ítems no se
--     multipliquen entre sí (el error clásico al sumar dos hijas en un join).
CREATE OR REPLACE VIEW v_solicitudes AS
SELECT
    s.id,
    s.codigo,
    s.estado,
    s.fecha,
    s.hora_desde,
    s.hora_hasta,

    cl.id       AS cliente_id,
    cl.nombre   AS cliente_nombre,
    cl.telefono AS cliente_telefono,

    ch.id       AS chofer_id,
    ch.nombre   AS chofer_nombre,
    ch.telefono AS chofer_telefono,

    ve.id       AS vehiculo_id,
    ve.patente  AS vehiculo_patente,
    ve.tipo     AS vehiculo_tipo,

    s.origen_direccion, s.origen_barrio, s.origen_piso, s.origen_ascensor, s.origen_notas,
    s.destino_direccion, s.destino_barrio, s.destino_piso, s.destino_ascensor, s.destino_notas,

    s.km_estimados,
    s.horas_estimadas,
    s.precio_calculado,
    s.precio_final,
    (s.precio_calculado IS NOT NULL
     AND s.precio_final IS DISTINCT FROM s.precio_calculado) AS precio_editado,
    s.precio_modificado_por,
    s.precio_modificado_en,

    COALESCE(it.cantidad_lineas, 0)   AS cantidad_lineas,
    COALESCE(it.total_unidades, 0)    AS total_unidades,
    COALESCE(it.tiene_fragil, false)  AS tiene_fragil,

    COALESCE(pg.total_pagado, 0)      AS total_pagado,
    s.precio_final - COALESCE(pg.total_pagado, 0) AS saldo,
    CASE
        WHEN COALESCE(pg.total_pagado, 0) = 0                                  THEN 'sin_pagos'
        WHEN COALESCE(pg.total_pagado, 0) < s.precio_final                     THEN 'parcial'
        WHEN COALESCE(pg.total_pagado, 0) = s.precio_final                     THEN 'cobrado'
        ELSE 'sobrepago'
    END AS estado_cobro,

    s.motivo_cancelacion,
    s.finalizada_en,
    s.remito_numero,
    s.remito_ruta,
    s.remito_nombre,
    s.remito_subido_por_id,
    s.receptor_nombre,
    s.receptor_documento,
    (s.remito_ruta IS NOT NULL) AS remito_cargado,
    s.notas,
    s.creado_en,
    s.actualizado_en
FROM solicitudes s
JOIN      usuarios  cl ON cl.id = s.cliente_id
LEFT JOIN usuarios  ch ON ch.id = s.chofer_id
LEFT JOIN vehiculos ve ON ve.id = s.vehiculo_id
LEFT JOIN LATERAL (
    SELECT count(*)                        AS cantidad_lineas,
           COALESCE(sum(i.cantidad), 0)    AS total_unidades,
           bool_or(i.fragil)               AS tiene_fragil
      FROM items_carga i
     WHERE i.solicitud_id = s.id
) it ON true
LEFT JOIN LATERAL (
    SELECT COALESCE(sum(p.monto), 0) AS total_pagado
      FROM pagos p
     WHERE p.solicitud_id = s.id
) pg ON true;

COMMENT ON VIEW v_solicitudes IS
    'Viaje con datos de cliente, chofer, vehículo, bultos, cobrado, saldo y remito.';


-- 7.2 Cola de trabajo del chofer: viajes con efectivo cobrado y todavía sin
--     la foto del remito. Es la pantalla donde sube el papel. La vista no sabe
--     quién está logueado: la API filtra por chofer_id.
--     Incluye 'finalizada' a propósito: ese caso no debería existir (lo
--     impiden los disparadores), pero si alguna vez aparece conviene verlo en
--     lugar de esconderlo. Se apoya en v_solicitudes para no repetir totales.
CREATE OR REPLACE VIEW v_remitos_pendientes AS
SELECT
    v.id,
    v.codigo,
    v.estado,
    v.fecha,
    v.hora_desde,
    v.hora_hasta,
    v.chofer_id,
    v.chofer_nombre,
    v.cliente_nombre,
    v.origen_direccion,
    v.destino_direccion,
    v.precio_final,
    v.total_pagado,
    v.saldo
FROM v_solicitudes v
WHERE v.estado IN ('confirmada', 'finalizada')
  AND v.remito_ruta IS NULL
  AND EXISTS (
      SELECT 1
        FROM pagos p
       WHERE p.solicitud_id = v.id
         AND p.metodo = 'efectivo'
  );

COMMENT ON VIEW v_remitos_pendientes IS
    'Viajes con efectivo cobrado y sin foto de remito. La API filtra por chofer_id.';


-- 7.3 Agenda: los viajes confirmados son la única fuente de disponibilidad.
CREATE OR REPLACE VIEW v_agenda_confirmada AS
SELECT
    s.id,
    s.codigo,
    s.fecha,
    s.hora_desde,
    s.hora_hasta,
    s.chofer_id,
    ch.nombre   AS chofer_nombre,
    s.vehiculo_id,
    ve.patente  AS vehiculo_patente,
    s.cliente_id,
    cl.nombre   AS cliente_nombre,
    s.origen_barrio,
    s.destino_barrio
FROM solicitudes s
JOIN      usuarios  ch ON ch.id = s.chofer_id
JOIN      usuarios  cl ON cl.id = s.cliente_id
JOIN      vehiculos ve ON ve.id = s.vehiculo_id
WHERE s.estado = 'confirmada';

COMMENT ON VIEW v_agenda_confirmada IS
    'Viajes confirmados con fecha y ventana horaria: base del control de disponibilidad.';


-- 7.4 Recaudación por persona y mes: cuánto cobró cada uno y por qué vía.
CREATE OR REPLACE VIEW v_recaudacion_usuario AS
SELECT
    u.id     AS usuario_id,
    u.rol,
    u.nombre,
    date_trunc('month', p.fecha)::date AS mes,
    count(*) AS cantidad_pagos,
    COALESCE(sum(p.monto) FILTER (WHERE p.metodo = 'efectivo'), 0)      AS efectivo,
    COALESCE(sum(p.monto) FILTER (WHERE p.metodo = 'transferencia'), 0) AS transferencia,
    COALESCE(sum(p.monto), 0) AS total
FROM pagos p
JOIN usuarios u ON u.id = p.recibido_por_id
GROUP BY u.id, u.rol, u.nombre, date_trunc('month', p.fecha);

COMMENT ON VIEW v_recaudacion_usuario IS
    'Cobros agrupados por persona y mes, separando efectivo de transferencia.';


-- ===========================================================================
-- 8. SEGURIDAD (Supabase)
-- ---------------------------------------------------------------------------
-- Supabase expone las tablas del esquema public por su API REST con las claves
-- anon/authenticated. Como este proyecto accede por conexión directa
-- (DATABASE_URL, rol que saltea RLS), la forma más segura es:
--   - activar RLS SIN políticas (nadie entra por REST), y
--   - revocar los permisos de anon y authenticated.
-- El acceso real queda en manos de la API, que es la que decide permisos.
--
-- Los bloques controlan la existencia de esos roles para que el archivo
-- también corra en un PostgreSQL local sin Supabase.
-- ===========================================================================
DO $$
DECLARE
    t text;
BEGIN
    -- Tablas: RLS + revoke.
    FOREACH t IN ARRAY ARRAY[
        'usuarios', 'vehiculos', 'solicitudes', 'items_carga', 'pagos'
    ]
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
        END IF;
    END LOOP;

    -- Vistas: no admiten RLS, pero se les quita el acceso público.
    FOREACH t IN ARRAY ARRAY[
        'v_solicitudes', 'v_remitos_pendientes', 'v_agenda_confirmada',
        'v_recaudacion_usuario'
    ]
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
        END IF;
    END LOOP;
END;
$$;


-- ===========================================================================
-- NOTAS
-- ---------------------------------------------------------------------------
--  * Los códigos FEX-#### salen de solicitudes_codigo_seq. Si se importan
--    viajes históricos con código explícito, hay que avanzar la secuencia:
--        SELECT setval('solicitudes_codigo_seq', <último número>);
--    seed.sql ya lo hace solo.
--  * La numeración puede tener HUECOS. El DEFAULT consume nextval() al
--    construir la fila, y PostgreSQL no devuelve ese número si el INSERT
--    falla después (por una restricción, un choque de agenda, etc.). Es
--    esperable: el código es un identificador visible, no un contador de
--    viajes. No intentes "rellenar" huecos ni reutilizar números.
--  * El estado de cobro (sin_pagos | parcial | cobrado | sobrepago) y el
--    saldo son derivados: no se guardan en solicitudes.
--  * La "seña requerida" es el 50 % de precio_final (regla de presentación).
--    Lo cobrado sale de pagos; no se duplica en el viaje.
--  * Un viaje cancelado conserva chofer y vehículo como historial: al no
--    estar 'confirmada', libera la agenda automáticamente. Lo mismo pasa al
--    finalizarlo: el chofer y el vehículo quedan libres sin tocar nada.
--  * 'finalizada' exige finalizada_en y, si hubo efectivo, la foto del remito.
--    Es terminal: no se reabre ni se cancela. Un reclamo posterior a la
--    entrega no es un cambio de estado (ver futuraBD.sql).
--  * El remito es uno por viaje y puede cargarse antes o después del cierre;
--    lo único que la base impide es cerrar un viaje con efectivo cobrado y
--    sin foto.
--  * Un vehículo en taller o fuera de servicio no se valida acá: es una
--    decisión del admin al asignar. El vehículo asignado a un viaje
--    confirmado no puede ser otro: lo garantiza la FK.
-- ===========================================================================


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
