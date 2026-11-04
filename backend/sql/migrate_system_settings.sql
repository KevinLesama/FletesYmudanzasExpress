-- Fletes Express - Migración: ajustes operativos y margen de ganancia
--
-- Agrega una fila singleton para los valores globales administrables.
-- No modifica solicitudes, cotizaciones históricas ni datos de usuarios.

BEGIN;

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id                      integer PRIMARY KEY DEFAULT 1,
    margen_operativo_min    integer NOT NULL DEFAULT 30,
    margen_ganancia_pct     integer NOT NULL DEFAULT 50,
    CONSTRAINT ck_configuracion_sistema_singleton CHECK (id = 1),
    CONSTRAINT ck_configuracion_sistema_margen_operativo
        CHECK (margen_operativo_min BETWEEN 30 AND 1440),
    CONSTRAINT ck_configuracion_sistema_margen_ganancia
        CHECK (margen_ganancia_pct BETWEEN 0 AND 500)
);

INSERT INTO configuracion_sistema (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE configuracion_sistema FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE configuracion_sistema FROM authenticated;
    END IF;
END $$;

COMMIT;
