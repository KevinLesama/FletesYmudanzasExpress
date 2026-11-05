# Fletes Y Mudanzas Express

Sistema integral para gestionar fletes, mudanzas y coordinación operativa entre clientes, conductores y administración. La plataforma centraliza la agenda, solicitudes, planificación, flota y pagos para optimizar la operación diaria y mejorar la trazabilidad del servicio.

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Supabase-Auth-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
</p>

---

## Capturas de pantalla

<p align="center">
  <img src="./docs/screenshots/01-agenda.png" alt="Agenda semanal con los viajes del día" width="100%" />
</p>

<p align="center">
  <img src="./docs/screenshots/02-solicitudes.png" alt="Listado de solicitudes con su estado" width="100%" />
</p>

<p align="center">
  <img src="./docs/screenshots/03-planificacion.png" alt="Planificación de un viaje con chofer y vehículo asignados" width="100%" />
</p>

<p align="center">
  <img src="./docs/screenshots/04-flota.png" alt="Administración de choferes y vehículos" width="100%" />
</p>

<p align="center">
  <img src="./docs/screenshots/05-pagos.png" alt="Pagos registrados y resumen de cobros" width="100%" />
</p>

> Las imágenes se guardan en [`docs/screenshots/`](./docs/screenshots/). Ahí están los nombres y el formato recomendado.

---

## Sobre el proyecto

Fletes Y Mudanzas Express es una solución diseñada para empresas de transporte y mudanzas que necesitan controlar la operación de principio a fin. La app permite:

- gestionar clientes y solicitudes de servicio;
- organizar la agenda diaria de viajes y choferes;
- planificar rutas, tiempos y disponibilidad;
- supervisar la flota y los vehículos activos;
- registrar pagos y seguimiento del estado de cada operación;
- separar accesos por rol para administrador y chofer.

La idea es mantener toda la operación en una misma plataforma con flujo claro, visualización simple y control de permisos para cada tipo de usuario.

---

## Funcionalidades principales

| Módulo | Descripción |
|---|---|
| Agenda | Visualización semanal o diaria de viajes, turnos y disponibilidad. |
| Solicitudes | Registro, seguimiento y estado de cada pedido o servicio solicitado. |
| Planificación | Coordinación de rutas, tiempos y asignación de recursos. |
| Flota | Administración de vehículos, estado operativo y disponibilidad. |
| Pagos | Control de cobros, liquidaciones y movimientos financieros. |
| Roles y permisos | Acceso diferenciado para administración y conductores. |
| Autenticación | Login con Supabase Auth y validación de sesión por backend. |

### Funcionalidades adicionales

- Portal multi-página con frontend en React + TypeScript.
- API REST con FastAPI para lógica de negocio y validaciones.
- Persistencia con PostgreSQL y modelos de datos SQLAlchemy.
- Seguridad basada en roles y autenticación real del usuario.
- Arquitectura lista para despliegue con Docker y Nginx.
- Base preparada para crecimiento de módulos y nuevos procesos de operación.

---

## Stack tecnológico

### Frontend
- React
- TypeScript
- Vite
- MUI
- Leaflet / mapas interactivos

### Backend
- Python
- FastAPI
- SQLAlchemy
- Pydantic
- PostgreSQL

### Autenticación y datos
- Supabase Auth
- Supabase PostgreSQL
- Variables de entorno para configuración segura

### Infraestructura
- Docker
- Docker Compose
- Nginx

---

## Arquitectura

La aplicación está dividida en dos capas principales:

- Frontend: aplicación web multi-página construida en React + TypeScript con Vite.
- Backend: API REST en FastAPI con validaciones de negocio y conexión a PostgreSQL.

La comunicación entre ambas capas se realiza a través de rutas de API bajo /api, con proxy en desarrollo y nginx en producción. La autenticación y autorización se gestionan con Supabase y validación de rol del backend.

---

## Estructura del proyecto

```bash
FletesYmudanzasExpress/
├── src/                     # Frontend React + TypeScript
│   ├── components/         # Componentes reutilizables
│   ├── pages/              # Páginas y workflows del producto
│   ├── entries/            # Entradas de cada HTML multi-page
│   ├── api.ts              # Capa HTTP del frontend
│   ├── guard.ts            # Protección de rutas por rol
│   ├── types.ts            # Tipos del dominio
│   └── ...
├── backend/                 # API FastAPI
│   ├── app/                # Código principal de la aplicación
│   ├── sql/                # SQL del esquema, auth y migraciones
│   ├── tests/              # Tests del backend
│   └── ...
├── public/                  # Assets públicos
├── docs/
│   └── screenshots/         # Capturas usadas en este README
├── tests/                   # Tests frontend / utilitarios
├── Dockerfile               # Build frontend + nginx
├── Dockerfile.dev           # Configuración de desarrollo
├── docker-compose.yaml      # Infraestructura de producción
├── docker-compose.dev.yaml  # Infraestructura de desarrollo
├── nginx.conf              # Proxy de rutas en producción
├── package.json             # Scripts y dependencias frontend
├── vite.config.ts          # Configuración de Vite y rutas
├── README.md               # Documentación principal
├── DESIGN.md               # Referencias de diseño
├── AGENTS.md               # Reglas y contexto del proyecto
├── CONTRIBUTING.md         # Guía de contribución
└── ...
```

---

## Requisitos

Antes de comenzar, asegurate de tener instalado:

- Node.js 18+
- npm
- Python 3.12+
- PostgreSQL o acceso a Supabase
- Docker y Docker Compose (opcional, pero recomendado)

---

## Instalación y puesta en marcha

### 1) Clonar el repositorio

```bash
git clone https://github.com/KevinLesama/FletesYmudanzasExpress.git
cd FletesYmudanzasExpress
```

### 2) Instalar dependencias del frontend

```bash
npm install
```

### 3) Configurar el backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
```

### 4) Configurar variables de entorno

Copiar los ejemplos y completar los valores correspondientes:

```bash
# En la raíz del proyecto
cp .env.example .env

# En backend
cp backend/.env.example backend/.env
```

Ajusta variables como:

- DATABASE_URL
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- CORS_ORIGINS
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

> Nunca subas archivos .env al repositorio. Mantener estas credenciales fuera del control de versiones.

### 5) Ejecutar en desarrollo

Terminal 1 - Backend:

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 - Frontend:

```bash
npm run dev
```

Abre la app en:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Documentación API: http://localhost:8000/docs

---

## Ejecutar con Docker

### Desarrollo

```bash
docker compose -f docker-compose.dev.yaml up --build
```

### Producción local

```bash
docker compose up --build
```

El proyecto está preparado para trabajar con Vite y Nginx en contenedores, junto con la API FastAPI y PostgreSQL/Supabase como backend persistente.

---

## Casos de uso

El sistema está pensado para empresas de transporte de carga y mudanzas que necesitan:

- atender pedidos de clientes en tiempo real;
- distribuir viajes según disponibilidad y calendario;
- controlar la asignación de recursos y conductores;
- llevar un registro claro de pagos y operación;
- reducir la carga administrativa del día a día.

---

## Estado del proyecto

Este repositorio está en evolución continua. Se recomienda revisar la documentación técnica adicional en:

- [DESIGN.md](./DESIGN.md)
- [AGENTS.md](./AGENTS.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Contribución

Las contribuciones son bienvenidas. Antes de enviar cambios:

1. crea una rama de trabajo;
2. mantén cambios enfocados;
3. valida que el frontend y el backend sigan funcionando;
4. documenta cambios relevantes en el código o en este README.

---

## Licencia

Este proyecto se distribuye con fines de desarrollo y operación interna del negocio. Ajustar la licencia según el uso final del producto antes de publicarlo o distribuirlo externamente.
