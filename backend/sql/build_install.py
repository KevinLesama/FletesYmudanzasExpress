"""Genera backend/sql/install.sql a partir de schema.sql + auth.sql.

install.sql es un archivo GENERADO: no se edita a mano. Se corre este script
después de tocar schema.sql o auth.sql.

    python backend/sql/build_install.py

El resultado es idempotente (lo garantizan los IF NOT EXISTS de los archivos
fuente) y determinista: mismos insumos, mismos bytes.
"""
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent
SALIDA = SQL_DIR / "install.sql"

HEADER = """\
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


"""


def leer(nombre: str) -> str:
    """Lee un fuente normalizando el fin de línea a \\n."""
    texto = (SQL_DIR / nombre).read_text(encoding="utf-8")
    return texto.replace("\r\n", "\n").rstrip("\n") + "\n"


def main() -> None:
    partes = [HEADER, leer("schema.sql"), "\n\n", leer("auth.sql")]
    contenido = "".join(partes)
    SALIDA.write_text(contenido, encoding="utf-8", newline="\n")
    print(f"install.sql generado ({len(contenido.encode('utf-8'))} bytes)")


if __name__ == "__main__":
    main()
