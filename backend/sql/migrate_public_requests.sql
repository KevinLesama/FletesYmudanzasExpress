-- Permite solicitudes publicas sin crear una cuenta de cliente.
ALTER TABLE solicitudes
    ALTER COLUMN cliente_id DROP NOT NULL;

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS solicitante_nombre text,
    ADD COLUMN IF NOT EXISTS solicitante_telefono text;