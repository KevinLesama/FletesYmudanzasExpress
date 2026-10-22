# Fletes PPP

Sistema de gestión de fletes (demo) con frontend MPA en React + TypeScript + Vite + MUI y backend FastAPI + SQLAlchemy + PostgreSQL.

## Arquitectura
- **Frontend**: MPA multi-HTML (`*.html` en raíz) con entradas en `src/entries/`. Rutas sin extensión vía plugin en `vite.config.ts`. Todas las llamadas al backend usan rutas relativas `/api` (proxy en desarrollo/nginx en Docker).
- **Backend**: FastAPI en `backend/app/`. Endpoints REST bajo `/api` + `/health`. ORM SQLAlchemy 2.x, esquemas Pydantic v2. Soporta arranque sin base de datos (devuelve 503 con mensaje claro). **Autenticación**: valida los JWT de Supabase Auth (`Authorization: Bearer`) y aplica roles por endpoint.
- **Base de datos**: PostgreSQL. Soporta Supabase con **Session pooler IPv4 (puerto 5432)** y `sslmode=require`. SQL de esquema y seed en `backend/sql/`.
- **Auth**: Supabase Auth (email + password). El frontend guarda la sesión en `localStorage` y manda el access token al backend; no se usan cookies. La autorización vive en FastAPI (el backend conecta como `postgres` y bypasea RLS).

## Requisitos
- Node.js 18+ / npm
- Python 3.12+
- (Opcional) Docker + Docker Compose
- Base PostgreSQL (o proyecto Supabase)

## Puesta en marcha (desarrollo)

### 1) Clonar e instalar
```bash
# Frontend
npm install

# Backend
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configurar variables de entorno
Copiar los archivos `.env.example` y completar con credenciales (nunca commitear `.env`).

```bash
# Raíz del frontend
cp .env.example .env  # opcional; por defecto usa /api

# Backend
cp backend/.env.example backend/.env
```

Editar `backend/.env`:
- `DATABASE_URL`: usar cadena de **Session pooler** de Supabase (IPv4). Ejemplo:
  `postgresql+psycopg://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`
  (codificar caracteres especiales de la contraseña, p. ej. `@` → `%40`).
- `CORS_ORIGINS`: incluir `http://localhost:5173` y/o `http://localhost:8080`.
- `SUPABASE_URL` y `SUPABASE_ANON_KEY`: **Project Settings → API** del proyecto de Supabase. Con estas dos el backend valida los JWT.
- `SUPABASE_SERVICE_ROLE_KEY`: opcional, solo si el backend necesita operar con privilegios de servicio. Nunca va al frontend.

Editar `.env` (raíz, para Vite):
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: mismos valores que el backend. Vite los inyecta en build-time.

> El host directo `db.<ref>.supabase.co` resuelve a IPv6 y suele fallar en redes sin IPv6. Usar siempre Session pooler (puerto 5432).

### 3) Inicializar la base de datos (Supabase)
Abrir el **SQL Editor** de Supabase y ejecutar en orden:
1. `backend/sql/schema.sql` (idempotente: `CREATE TABLE IF NOT EXISTS`, sin datos)
2. `backend/sql/auth.sql` (vincula `drivers.auth_user_id` con `auth.users` y crea el rol por defecto)
3. `backend/sql/seed.sql` (datos demo, idempotente con `ON CONFLICT DO NOTHING`)

`auth.sql` va **después** de `schema.sql` y **antes** de `seed.sql`. Usa el schema `auth` de Supabase, que no existe en un Postgres local sin Supabase.

### 4) Levantar los servicios
**Terminal 1 — Backend:**
```bash
cd backend
# activar venv
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend (con proxy a /api):**
```bash
npm run dev
```
Abrir [http://localhost:5173](http://localhost:5173).

Endpoints útiles:
- Salud: [http://localhost:8000/health](http://localhost:8000/health)
- Documentación: [http://localhost:8000/docs](http://localhost:8000/docs)
- OpenAPI: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

## Autenticación y roles

El login usa **Supabase Auth** (email + contraseña). El backend valida el JWT y autoriza por rol.

**Roles** (`app_metadata.role` del usuario en Supabase; **nunca** `user_metadata`, que el usuario puede editar):
- `admin` → acceso total.
- `coordinator` → operación diaria (agenda, solicitudes, flota, pagos).
- `driver` → solo `chofer` (sus viajes).
- Si el claim falta o es desconocido, se asume `driver` (mínimo privilegio).

**Crear el primer admin** (Supabase Dashboard):
1. Authentication → Users → **Add user** (email + password).
2. Editá el usuario y en `raw_app_meta_data` poné `{"role":"admin"}`.
3. Para un chofer: creá el usuario igual, dejá `raw_app_meta_data` en `{"role":"driver"}` (lo setea el trigger de `auth.sql`) y vinculalo:
   ```sql
   UPDATE drivers SET auth_user_id = '<uuid-del-usuario>' WHERE id = 'JA';
   ```

**Mapa de rutas del frontend** (`src/guard.ts`): `ingreso` es pública; `agenda`, `solicitudes`, `nueva-solicitud`, `planificacion`, `flota`, `pagos` y `chofer-config` requieren `admin`/`coordinator`; `chofer` requiere `driver`. Si el rol no corresponde, redirige al home del rol.

**Deuda conocida (fase 1)**: se protege el acceso pero **no se scopean filas**. Un `driver` autenticado puede listar todos los `requests` vía API. Cerrarlo requiere filtrar por el `driver` vinculado a `auth_user_id` en los endpoints de lectura.

## Docker (desarrollo/producción local)
1. Copiar `backend/.env.example` → `backend/.env` y completar `DATABASE_URL` + `CORS_ORIGINS`.
2. Levantar:
```bash
docker compose up --build
```
- Frontend: [http://localhost:8080](http://localhost:8080)
- Backend: [http://localhost:8000](http://localhost:8000)
- Nginx hace proxy de `/api/` hacia el backend. El frontend usa `VITE_API_URL=/api` por defecto.
- `docker compose` toma `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del `.env` de la raíz (o del entorno) y las pasa como build args: Vite las necesita en build-time. `backend/.env` llega al backend vía `env_file`.

## Pruebas
**Backend (SQLite en memoria, sin tocar la DB real):**
```bash
cd backend
pytest -v
```
Los tests validan reglas de negocio (generación de IDs, conflictos de chofer/vehículo, cálculos derivados).

**Frontend:**
```bash
npm run build  # typecheck + build de producción
npm run preview
```

## Notas importantes
- **Sin DELETE de entidades** (la UI no lo ofrece). Solo se permite `DELETE /api/requests/{id}/remito` y la cancelación de viajes (`PATCH /requests/{id}` con estado `Cancelada`).
- **Foto de remito**: se guarda como `data URL` en columna `text`.
- **Viajes generados**: IDs `FEX-####` / `INC-####` los genera el backend.
- **Conflictos**: solo cuentan viajes con estado `Confirmada` para la verificación de chofer/vehículo.
- **Login**: real, contra Supabase Auth. El ingreso usa email + contraseña; la sesión persiste en `localStorage` y se refresca sola. Logout desde el sidebar.
- **Seguridad**: nunca subir `.env` al repositorio. Usar los `.env.example` provistos. La `service_role_key` es solo del backend.

## Estructura relevante
```
fletes_ppp/
├── src/                # Frontend React/TS
├── backend/            # API FastAPI
│   ├── app/            # Código de la API
│   ├── sql/            # schema.sql, auth.sql y seed.sql
│   └── tests/          # Tests (pytest)
├── Dockerfile          # Frontend (multi-stage + nginx)
├── docker-compose.yaml
└── nginx.conf
```
