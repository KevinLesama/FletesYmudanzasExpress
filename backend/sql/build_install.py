"""Regenera backend/sql/install.sql a partir de schema.sql y auth.sql.

install.sql es el archivo único que se sube para dejar la base lista
(esquema de negocio + vinculo con Supabase Auth). Se genera para no tener que
copiar el DDL a mano y que no se desincronice con los archivos de origen.

Uso (desde la raiz del repo):
    python backend/sql/build_install.py
"""

from __future__ import annotations

from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent

HEADER = """-- ===========================================================================
-- Fletes Express - instalador de la base (esquema + auth)
-- ---------------------------------------------------------------------------
-- QUÉ ES ESTE ARCHIVO
--   Un solo archivo con todo lo que hay que correr para dejar la base lista:
--     1) backend/sql/schema.sql -> esquema de negocio (usuarios, solicitudes,
--        pagos, vehiculos, factores_tarifa, items_carga)
--     2) backend/sql/auth.sql   -> usuarios.auth_user_id + indice unico y FK
--        a auth.users (solo si el proyecto es Supabase)
--   Es IDEMPOTENTE: se puede volver a correr sin romper nada.
--
-- CÓMO SE USA
--   - Supabase: SQL Editor > New query > pegar todo el archivo > Run.
--   - PostgreSQL local: psql -d <base> -f backend/sql/install.sql
--
-- OPCIONAL (después o aparte)
--   backend/sql/seed.sql        -> datos de demostración (también idempotente)
--
-- OJO
--   Los datos que había antes eran de simulación, así que la forma de migrar es
--   recrear la base: DROP SCHEMA public CASCADE y correr este archivo.
--
-- NOTA
--   backend/sql/futuraBD.sql NO va acá: es la propuesta de cambios que hay que
--   validar con el equipo (todo su DDL está comentado, no crea nada).
--
--   Archivo GENERADO: si modificás schema.sql o auth.sql, regeneralo con
--     python backend/sql/build_install.py
-- ===========================================================================


"""


def main() -> None:
    schema = (SQL_DIR / "schema.sql").read_text(encoding="utf-8")
    auth = (SQL_DIR / "auth.sql").read_text(encoding="utf-8")
    target = SQL_DIR / "install.sql"
    target.write_text(HEADER + schema.rstrip() + "\n\n\n" + auth.rstrip() + "\n", encoding="utf-8")
    print(f"install.sql generado ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
