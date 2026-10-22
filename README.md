# Fletes PPP

Sistema de gestión de fletes (demo) con frontend MPA en React + TypeScript + Vite + MUI y backend FastAPI + SQLAlchemy + PostgreSQL.

## Arquitectura
- **Frontend**: MPA multi-HTML (`*.html` en raíz) con entradas en `src/entries/`. Rutas sin extensión vía plugin en `vite.config.ts`. Todas las llamadas al backend usan rutas relativas `/api` (proxy en desarrollo/nginx en Docker).
- **Backend**: FastAPI en `backend/app/`. Endpoints REST bajo `/api` (19 rutas) + `/health`. ORM SQLAlchemy 2.x, esquemas Pydantic v2. Soporta arranque sin base de datos (devuelve 503 con mensaje claro).
- **Autenticación**: Supabase Auth (JWT). El frontend inicia sesión con email y contraseña y manda el token en `Authorization: Bearer`; el backend valida el JWT y resuelve el rol desde la tabla `usuarios`.
- **Base de datos**: PostgreSQL. Soporta Supabase con **Session pooler IPv4 (puerto 5432)** y `sslmode=require`. La base está **en español** (tablas, columnas, índices y restricciones). SQL de esquema, auth, seed e instalador en `backend/sql/`.

## Requisitos
- Node.js 18+ / npm
- Python 3.12+
- (Opcional) Docker + Docker Compose
- Base PostgreSQL (o proyecto Supabase) + proyecto Supabase Auth

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

Editar `.env` (raíz):
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: Supabase → Project Settings → API (Project URL y *anon public* key).

Editar `backend/.env`:
- `DATABASE_URL`: usar cadena de **Session pooler** de Supabase (IPv4). Ejemplo:
  `postgresql+psycopg://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`
  (codificar caracteres especiales de la contraseña, p. ej. `@` → `%40`).
- `CORS_ORIGINS`: incluir `http://localhost:5173` y/o `http://localhost:8080`.
- `SUPABASE_URL` y `SUPABASE_ANON_KEY`: mismas credenciales que el frontend (el backend valida los JWT).
- `SUPABASE_SERVICE_ROLE_KEY`: opcional, solo para tareas administrativas de usuarios.

> El host directo `db.<ref>.supabase.co` resuelve a IPv6 y suele fallar en redes sin IPv6. Usar siempre Session pooler (puerto 5432).

### 3) Inicializar la base de datos (Supabase)
Abrir el **SQL Editor** de Supabase y ejecutar en orden:
1. `backend/sql/schema.sql` (idempotente: `CREATE TABLE IF NOT EXISTS`, sin datos)
2. `backend/sql/auth.sql` (vínculo con Supabase Auth: columna `usuarios.auth_user_id` e índice único)
3. `backend/sql/seed.sql` (datos demo, idempotente con `ON CONFLICT DO NOTHING`)

O bien, en un solo paso, `backend/sql/install.sql` = `schema.sql` + `auth.sql` (generado con `python backend/sql/build_install.py`).

> La base está en español: `usuarios`, `solicitudes`, `pagos`, `vehiculos`, `factores_tarifa`, `items_carga`. El backend mantiene los atributos de Python y el JSON de la API en inglés, así que la interfaz no cambia.

> Si la base ya tenía el esquema anterior (`clients` / `drivers` / `incidents`), como los datos eran de simulación la forma de migrar es recrearla: `DROP SCHEMA public CASCADE` y correr `backend/sql/install.sql`.

> `backend/sql/futuraBD.sql` **no** se ejecuta: es la propuesta de cambios que hay que validar con el equipo (ver "Propuestas pendientes").

### 4) Crear las cuentas de login
Las cuentas se crean a mano en Supabase (Authentication → Users → *Add user*), con el mismo email que figura en el panel:
1. Crear el usuario en Supabase Auth y definirle la contraseña.
2. Cargar el chofer o administrador en el panel (`Flota` → *Agregar chofer*) con ese mismo email.
3. En el primer ingreso el backend vincula la cuenta (`usuarios.auth_user_id` se completa sola) y aplica el rol de `usuarios.rol`.

### 5) Levantar los servicios
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
Abrir [http://localhost:5173](http://localhost:5173) e ingresar con una cuenta de Supabase.

Endpoints útiles:
- Salud: [http://localhost:8000/health](http://localhost:8000/health)
- Documentación: [http://localhost:8000/docs](http://localhost:8000/docs)
- OpenAPI: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

## Autenticación y roles
- **Login**: Supabase Auth (email + contraseña). El token viaja en `Authorization: Bearer` y el backend valida la firma (JWKS de Supabase, con fallback a GoTrue).
- **Roles**: solo `admin` | `chofer` | `cliente`. La fuente de verdad es `usuarios.rol`, no el token.
- **Permisos**:
  - `admin`: todo (usuarios, flota, solicitudes, pagos, disponibilidad).
  - `chofer`: sus viajes, su perfil y sus tarifas; registra cobros y remitos de sus viajes.
  - `cliente`: sin acceso a la API (queda para el portal público futuro).
- **Vínculo de cuentas**: `usuarios.auth_user_id` (uuid de Supabase). Si está vacío, el backend busca el usuario por email (sin distinguir mayúsculas) y lo vincula en el primer ingreso. Si no hay coincidencia, el ingreso devuelve 403.

## Propuestas pendientes
`backend/sql/futuraBD.sql` reúne lo que **falta decidir con el equipo** (no se ejecuta):
- **A. Auth**: alta automática de usuarios con `SUPABASE_SERVICE_ROLE_KEY` (y su alternativa con invitaciones), rol de coordinación y envío de correos de bienvenida.
- **B. Portal público de clientes**: landing donde el cliente deja su solicitud y esta entra al panel para aceptar/rechazar. Requiere `solicitudes.origen`, `solicitudes.token_publico`, `solicitudes.motivo_rechazo`, endpoint público `POST /api/public/solicitudes`, moderación, avisos y adjuntos (el DDL está comentado en el archivo).

## Docker (desarrollo/producción local)
1. Copiar `backend/.env.example` → `backend/.env` y completar `DATABASE_URL` + `CORS_ORIGINS` (+ variables de Supabase).
2. Levantar:
```bash
docker compose up --build
```
- Frontend: [http://localhost:8080](http://localhost:8080)
- Backend: [http://localhost:8000](http://localhost:8000)
- Nginx hace proxy de `/api/` hacia el backend. El frontend usa `VITE_API_URL=/api` por defecto.

## Pruebas
**Backend (SQLite en memoria, sin tocar la DB real):**
```bash
cd backend
pytest -v
```
Los tests validan reglas de negocio (generación de IDs, conflictos de chofer/vehículo, cálculos derivados) y autenticación/permisos por rol.

**Frontend:**
```bash
npm run build  # typecheck + build de producción
npm run preview
```

## Notas importantes
- **Una sola tabla de personas**: `usuarios` con `rol` (`admin` | `chofer` | `cliente`). No hay contraseñas en la base: el login vive en Supabase Auth y `usuarios` guarda los datos de contacto y las tarifas.
- **Sin DELETE de entidades** (la UI no lo ofrece). Solo se permite `DELETE /api/payments/{id}/remito` y la cancelación de viajes (`PATCH /requests/{id}` con estado `Cancelada`).
- **Foto de remito**: se guarda como `data URL` en columna `text`, pero vive en el **pago** (`pagos.remito_*`), no en el viaje: un cobro en efectivo se remenda con su remito firmado.
- **Sin incidentes**: no hay tabla, endpoints ni pantallas de incidencias.
- **Sin hora real de llegada/fin**: `solicitudes` guarda la ventana estimada (`llegada_desde/hasta`, `servicio_desde/hasta`) y la confirmación se deduce de `estado = 'Confirmada'`.
- **Medios de pago**: `Transferencia`, `Cuenta corriente` (fin de mes) y `Efectivo`.
- **Viajes generados**: IDs `FEX-####` los genera el backend; los usuarios usan iniciales (choferes), `CLI-###` (clientes) y `ADM-01` (admins).
- **Conflictos**: solo cuentan viajes con estado `Confirmada` para la verificación de chofer/vehículo.
- **Guards del frontend**: `src/guard.ts` valida la sesión contra `/api/auth/me` y el rol antes de montar cada entrada (`STAFF_ROLES` para el panel, `['chofer']` para el portal del chofer).
- **Seguridad**: nunca subir `.env` al repositorio. Usar los `.env.example` provistos.

## Estructura relevante
```
fletes_ppp/
├── src/                # Frontend React/TS
├── backend/            # API FastAPI
│   ├── app/            # Código de la API
│   ├── sql/            # schema.sql, auth.sql, seed.sql, install.sql, futuraBD.sql
│   └── tests/          # Tests (pytest)
├── Dockerfile          # Frontend (multi-stage + nginx)
├── docker-compose.yaml
└── nginx.conf
```
