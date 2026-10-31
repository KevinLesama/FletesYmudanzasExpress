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
1. `backend/sql/install.sql` (esquema + auth en un solo archivo, idempotente)
2. `backend/sql/seed.sql` (datos demo, idempotente con `ON CONFLICT DO NOTHING`)

`install.sql` es **generado**: combina `schema.sql` + `auth.sql`. Si tocás alguno de los dos, regeneralo con `python backend/sql/build_install.py`. Requiere la extensión `btree_gist` (viene con Supabase y con `postgresql-contrib`).

> **Migrar una base con el esquema viejo**: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` y correr `install.sql` otra vez. Es destructivo: borra los datos existentes (eran de simulación).

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

El login usa **Supabase Auth** (email + contraseña). El backend valida el JWT y resuelve el rol contra la base.

**El rol NO viaja en el token**: sale de `usuarios.rol`, así un cambio de permisos aplica al instante (no hay que esperar a que venza el JWT). La resolución por email usa la vista `v_personal`, que solo trae `administrador` y `chofer`: los clientes son contactos de la empresa, no cuentas del sistema, aunque tengan email cargado.

- `administrador` → operación diaria (agenda, solicitudes, flota, pagos).
- `chofer` → solo `chofer` (sus viajes).

**Primer ingreso**: si `usuarios.auth_user_id` está vacío, el backend vincula la cuenta de Auth por email (el mismo email en el panel y en Authentication) y completa el vínculo solo. Si el rol no es de personal o el usuario está inactivo, responde 403 y el frontend cierra la sesión.

**Alta de cuentas** (Supabase Dashboard):
1. Cargá a la persona en `usuarios` con su email y `rol` (`administrador` o `chofer`).
2. Authentication → Users → **Add user** con el **mismo email**.
3. Al primer ingreso el vínculo se completa solo. También se puede forzar:
   ```sql
   UPDATE usuarios SET auth_user_id = '<uuid-del-usuario>' WHERE email = 'persona@empresa.com';
   ```

**Mapa de rutas del frontend** (`src/guard.ts`): `ingreso` es pública; `agenda`, `solicitudes`, `nueva-solicitud`, `planificacion`, `flota`, `pagos` y `chofer-config` requieren `administrador`; `chofer` requiere `chofer`. El guard consulta `GET /api/me` (no el JWT) y, si el rol no corresponde, redirige al home del rol.

**Deuda conocida (fase 1)**: se protege el acceso pero **no se scopean filas**. Un `chofer` autenticado puede listar todas las `solicitudes` vía API. Cerrarlo requiere filtrar por el usuario vinculado a `auth_user_id` en los endpoints de lectura.

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

## Enriquecimiento geográfico opcional

El backend expone el autocomplete y las rutas a través de `services/scraping/`,
pero no realiza scraping del DOM de Google Maps. El proveedor principal reutiliza
la integración oficial de Places API y Routes API de `services/geo.py`.

Opcionalmente se puede habilitar un fallback HTTP a Nominatim y OSRM:

```env
GEO_ENRICHMENT_ENABLED=true
GEO_FALLBACK_ENABLED=true
NOMINATIM_URL=https://nominatim.openstreetmap.org/search
ROUTING_URL=https://router.project-osrm.org
GEO_USER_AGENT=fletes-express/1.0
GEO_TIMEOUT_SECONDS=6
```

El fallback debe habilitarse sólo después de revisar las políticas y límites
vigentes de cada servicio. Nominatim exige un `User-Agent` identificable y
limita el uso intensivo; OSRM público no ofrece garantías de disponibilidad ni
de capacidad para producción. Photon no se activa por defecto porque requiere
un endpoint concreto y sus límites dependen de la instancia elegida.

La capa devuelve `ok`, `not_found` o `unavailable`. Cuando no hay resultado,
el formulario conserva la entrada manual; los kilómetros manuales se guardan
como datos pendientes de cálculo y nunca se convierten en una distancia
automática ficticia.

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
│   ├── sql/            # install.sql (generado), schema.sql, auth.sql y seed.sql
│   └── tests/          # Tests (pytest)
├── Dockerfile          # Frontend (multi-stage + nginx)
├── docker-compose.yaml
└── nginx.conf
```
