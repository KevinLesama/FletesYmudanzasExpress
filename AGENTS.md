# Repository Guide

## Project Shape

Fletes Express is a fleet and moving-services management application. It is a multi-page React frontend backed by a FastAPI service and PostgreSQL. Supabase provides authentication and can host the PostgreSQL database.

The main runtime path is:

1. A root HTML file loads one React entry under `src/entries/`.
2. The entry applies the role guard when the page is protected, then mounts its page component.
3. Pages call the shared HTTP adapter in `src/api.ts`.
4. Vite proxies `/api` during development; Nginx proxies `/api/` in the container deployment.
5. FastAPI validates authentication and endpoint roles, uses SQLAlchemy entities and Pydantic schemas, then reads or writes PostgreSQL.

This is not a single-page app with a client-side router. Keep route mappings, HTML files, and entry modules aligned.

## Frontend

- Root `*.html` files are Vite multi-page build inputs. `src/entries/` contains their React entry points.
- `vite.config.ts` defines extensionless development/preview routes, proxy settings, and build inputs. `nginx.conf` has a separate production route map; update both when adding or renaming a page.
- `src/pages/` owns page-level workflows. `src/components/` contains shared shells and reusable UI. Admin pages use `AppShell`; driver-facing pages use `ChoferShell`.
- `src/api.ts` is the HTTP boundary. It adds the Supabase bearer token, handles expired sessions, and maps backend snake_case/domain values to frontend types. Keep payload and response translation here rather than scattering backend field names through UI components.
- `src/types.ts` defines frontend domain types. When changing a required type property, update API mappers, mock fixtures, and every consumer.
- `src/supabase.ts` owns the browser Supabase client and session/user state. `src/guard.ts` calls `/api/me` before mounting protected pages and redirects by role.
- `src/useAsync.ts` and `src/usePagedList.ts` provide common loading/reload and in-memory pagination behavior. Reuse these patterns where they fit.
- `src/design/tokens.ts` and `DESIGN.md` are the design-token and UI convention references. Preserve the existing MUI-based visual system.

### Frontend Commands

```bash
npm run dev
npx tsc --noEmit
npm run build
npm run preview
```

`npm run build` runs TypeScript checking followed by the Vite production build. Vite-injected `VITE_*` values are build-time values, including in Docker.

## Backend

- `backend/app/main.py` creates the FastAPI app, installs CORS, and mounts routers under `/api`; `/health` is unprefixed.
- `backend/app/routers/api.py` owns REST endpoint behavior. Keep request handling and HTTP status semantics here; move reusable domain rules to `backend/app/services/business.py`.
- `backend/app/core/security.py` validates Supabase JWTs, resolves the live role from `usuarios`/`v_personal`, and exposes `get_current_user` and `require_role` dependencies. Backend authorization is the security boundary; frontend route guards are UX only.
- `backend/app/core/config.py` reads environment settings. `backend/app/db/session.py` creates the SQLAlchemy engine lazily, allowing the app to start without a configured database for documentation/health use.
- `backend/app/db/base.py` defines SQLAlchemy's declarative base. Current domain entities are in `backend/app/models/entities.py` and re-exported from `backend/app/models/__init__.py`.
- `backend/app/schemas/__init__.py` defines Pydantic v2 request and response contracts. `backend/app/services/serializers.py` maps ORM records to API output.
- Current entities map the shared-role `usuarios` table, `vehiculos`, `solicitudes`, `items_carga`, and `pagos`. Keep their Spanish database names and values consistent across the ORM, schemas, serializers, SQL, and frontend adapter.
- Routes include clients, drivers, vehicles, requests, payments, availability, and identity (`/api/me`). Authentication and authorization can differ by endpoint; check each dependency before changing access behavior.

### Backend Commands

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
python -m pytest -v
```

The README documents pytest, but the currently checked-in `backend/tests/conftest.py` imports legacy model names (`Client`, `Driver`, and others) that are not exported by the current model package. Treat backend test collection as known-broken until the fixtures and tests are migrated to the current entities; do not infer that the suite passed from the README instructions.

## Database and SQL

- `backend/sql/schema.sql` is the source for business tables, constraints, indexes, triggers, and views.
- `backend/sql/auth.sql` contains Supabase Auth integration, including the user linkage and personal-user view.
- `backend/sql/install.sql` is generated from those two files. Do not edit it directly; after changing either source, run:

  ```bash
  python backend/sql/build_install.py
  ```

- `backend/sql/seed.sql` is optional demo data. `backend/sql/futuraBD.sql` is a commented decision/notes file, not active schema.
- SQLAlchemy metadata describes database behavior but is not a migration system. A SQL change may require an explicit database migration/reinstall; `CREATE TABLE IF NOT EXISTS` does not add new columns or constraints to existing tables.
- Preserve database constraints as the final enforcement of domain invariants. Align ORM `server_default`, nullability, constraints, and generated values with the SQL definitions.
- Never run destructive database instructions against a user database without explicit authorization and a verified backup. Keep credentials in environment files that are not committed; the Supabase service-role key must never be exposed to the frontend.

## Domain and Security Invariants

- `usuarios.rol` distinguishes administrators, drivers, and clients. Clients are contacts, not authenticated staff accounts.
- Roles are read from the database, not trusted from frontend input or JWT role claims. Authenticated endpoints must still apply the appropriate backend role dependency.
- The schema requires email for non-client personnel. Preserve this contract in driver creation and editing unless the business/schema requirement is explicitly changed.
- Only confirmed requests reserve a driver or vehicle time slot. Keep scheduling checks consistent between service logic and PostgreSQL constraints/triggers.
- Request state transitions and closeout requirements are database-backed rules; do not bypass them in endpoint code.
- Known access-control gap: request listing is authenticated but is not scoped to the current driver. Do not claim that drivers can only see their own requests; any fix must add server-side row filtering.

## Deployment and Routing

- `Dockerfile` builds the Vite app and serves `dist/` with Nginx. `backend/Dockerfile` packages FastAPI.
- `docker-compose.yaml` starts the frontend and backend; PostgreSQL is external (typically Supabase), not a Compose service.
- The browser calls relative `/api` URLs. Vite proxies them to `VITE_PROXY_TARGET` (default `http://localhost:8000`); Nginx proxies `/api/` to the Compose backend service.
- Keep `vite.config.ts` and `nginx.conf` extensionless route maps synchronized. The current Nginx map omits `/ajustes` although Vite has it; direct production navigation to that path is a known mismatch.

## Change Workflow

- First identify the owner of the behavior: page/component for UI, `src/api.ts` for API translation, router/service for backend behavior, schema/model for contracts, and SQL source files for persisted rules.
- For a request/response change, update both Pydantic contracts and the frontend adapter/types, then check every page and mock fixture using the affected type.
- For a database behavior change, update SQL sources and corresponding ORM metadata together; regenerate `install.sql` when its inputs change. Do not treat generated SQL as the source of truth.
- For a new page, coordinate the HTML input, entry component, route constants, Vite mapping, Nginx mapping, and role guard.
- Run the narrowest applicable check first, then `npx tsc --noEmit` or `npm run build` for frontend changes. For backend changes, run focused pytest tests when usable and at least `python -m py_compile` on changed Python modules. Report unavailable or known-broken checks rather than implying success.
- Preserve unrelated working-tree changes. Do not commit unless explicitly requested.