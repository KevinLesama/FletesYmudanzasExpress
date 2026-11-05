# SQL de la base

Todo el SQL vive acá. `schema.sql` y `auth.sql` son las **fuentes**; `install.sql`
es un archivo **generado**.

## Archivos

| Archivo | Qué es |
|---|---|
| `schema.sql` | Esquema de negocio: `usuarios` (3 roles), `vehiculos`, `solicitudes`, `items_carga`, `pagos`, `configuracion_sistema`. Incluye restricciones, triggers de agenda y de cierre, y las vistas de lectura. |
| `auth.sql` | Vínculo con Supabase Auth (`usuarios.auth_user_id`), FK a `auth.users` y la vista `v_personal` (fuente del login). |
| `install.sql` | **Generado.** `schema.sql` + `auth.sql`. No editar a mano. |
| `seed.sql` | Datos de demostración. Opcional. |
| `diagnostico_estado.sql` | Consulta de **solo lectura** que reporta el estado real del esquema. |
| `migrate_*.sql` | Cambios incrementales para bases que ya existen. |
| `seed_operational_availability_test.sql` | Datos de prueba del motor de disponibilidad. Opcional. |
| `futuraBD.sql` | Registro de decisiones y pendientes. Todo el DDL está comentado: no crea nada. |

> Antes de tocar una base que ya existe, correr `diagnostico_estado.sql` y
> comparar con lo que reporta. El export de Supabase ("schema for context only")
> no lista vistas, triggers, índices ni restricciones `EXCLUDE`.

## Regenerar `install.sql`

Después de tocar `schema.sql` o `auth.sql`:

```bash
python backend/sql/build_install.py
```

## Base nueva (vacía)

En el SQL Editor de Supabase, en este orden:

1. `install.sql`
2. `seed.sql` (opcional)

## Base existente: qué se puede y qué no

`schema.sql` usa `CREATE TABLE IF NOT EXISTS`. En una base que ya tiene las
tablas, **no agrega columnas ni restricciones**. Pero el resto del archivo sí se
ejecuta en cada corrida:

| Se repara al re-correr `install.sql` | NO se repara |
|---|---|
| Vistas (`CREATE OR REPLACE VIEW`), incluida `v_personal` | `CHECK` |
| Funciones (`CREATE OR REPLACE FUNCTION`) | `UNIQUE` de tabla |
| Triggers (`DROP` + `CREATE`) | `FOREIGN KEY` |
| Índices únicos (`CREATE UNIQUE INDEX IF NOT EXISTS`) | `EXCLUDE` de agenda |
| RLS y revokes | |

Los cuatro de la derecha viven dentro del `CREATE TABLE` y quedan afuera. Para
esos hace falta una migración con `ALTER TABLE`.

## Orden de migraciones

`migrate_public_requests` → `migrate_route_pricing` → `migrate_driver_closeout` →
`migrate_load_time` → `migrate_operational_availability` →
`migrate_custom_download_minutes` → `migrate_explicit_planning_times` →
`migrate_system_settings` → `migrate_configuracion_sistema_fix` →
`migrate_drop_legacy_mock`

El orden importa: `migrate_operational_availability` deja `descarga_min` como
`NOT NULL DEFAULT 60`, `migrate_custom_download_minutes` reemplaza su CHECK por
un rango y `migrate_explicit_planning_times` la vuelve nullable. Corridas en otro
orden dejan la base distinta.

## Pendiente de decisión

`migrate_cancellation_details.sql` **no se aplicó** y no debería aplicarse
todavía. Agrega `solicitudes.cancelado_por` y `solicitudes.sena_devuelta`, pero
`schema.sql`, el ORM y los schemas de la API no las conocen. El frontend
(`src/pages/PagosResumen.tsx`) espera esos datos y muestra un aviso de que
faltan. Es una feature a medio hacer: se completa de punta a punta o se borra el
archivo.
