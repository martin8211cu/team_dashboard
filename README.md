# Team Dashboard

Monorepo para visualizar KPIs del equipo de desarrollo.

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | [Bun](https://bun.sh) |
| API | [Hono](https://hono.dev) + PostgreSQL + [Knex](https://knexjs.org) |
| Web | [React](https://react.dev) + [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query) |
| Build (web) | [Vite](https://vite.dev) |

## Estructura

```
team-dashboard/
├── apps/
│   ├── api/          # Backend Bun + Hono + PostgreSQL + Jira API
│   ├── web/          # Frontend React + TanStack
│   └── cli/          # Exports Excel (migrado de Status)
└── packages/
    └── shared/       # Core Jira + métricas + tipos compartidos
        ├── src/jira/       # Cliente Jira, JQL, mappers
        ├── src/metrics/    # statusTime, agileMetrics
        ├── src/config/     # Carga de config de equipo
        └── config/teams/   # example.json (+ local.json gitignored)
```

## License

[MIT](LICENSE)

## Requisitos

- [Bun 1.2+](https://bun.sh)

## Inicio rápido

```bash
# Instalar dependencias
bun install

# Configurar secretos locales (nunca commitear .env)
cp .env.example .env
# Editar DATABASE_URL, AUTH_ADMIN_EMAIL, AUTH_DEFAULT_PASSWORD y JIRA_*

# Aplicar esquema (crea la base del DATABASE_URL si no existe) y seeds de demo
bun run db:setup

# Opcional: config de equipo privada
cp packages/shared/config/teams/example.json packages/shared/config/teams/local.json
# Editar local.json y apuntar TEAM_CONFIG_PATH en .env

# Terminal 1 — API (http://localhost:8090)
bun run dev:api

# Terminal 2 — Web (http://localhost:5173)
bun run dev:web
```

O ejecutar api, web y worker en paralelo (con manejo correcto de Ctrl+C en Windows):

```bash
bun run dev
```

> **Nota:** No uses `bun run --filter '*' dev` directamente en Git Bash/Windows:
> Ctrl+C puede detener la terminal pero dejar huérfanos procesos `bun --watch`.
> El script `scripts/dev.ts` reenvía la señal a api + web + worker para un cierre graceful.

## Integración Jira

Core migrado desde el proyecto `Status`:

| Módulo | Origen Status | Destino |
|--------|---------------|---------|
| Cliente Jira + JQL | `src/jiraClient.js` | `packages/shared/src/jira/` |
| Tiempo en status | `src/statusTime.js` | `packages/shared/src/metrics/statusTime.ts` |
| Métricas ágiles | `src/agileMetrics.js` | `packages/shared/src/metrics/agileMetrics.ts` |
| Config equipo | `config/alten_team.json` | `packages/shared/config/teams/example.json` |

Los exports Excel viven en `apps/cli` y reutilizan el mismo core de `packages/shared`.

### Configurar Jira y auth

```bash
cp .env.example .env
# Obligatorio: AUTH_ADMIN_EMAIL, AUTH_DEFAULT_PASSWORD, JIRA_*
```

Login con email + password. Solo miembros activos del roster. `AUTH_DEFAULT_PASSWORD` es **obligatorio** (no hay fallback en código). Al arrancar la API, si `AUTH_ADMIN_EMAIL` no está en members se crea con esa password. Members nuevos también la reciben hasta que el admin la cambie.

El email en `AUTH_ADMIN_EMAIL` recibe rol `admin`; el resto de usuarios autenticados tienen rol `user`.

- **Lectura** (GET de KPIs, Jira, exports, listado de members): cualquier usuario autenticado.
- **Escritura** (POST/PATCH/DELETE: sync/load de sprints, gestión del roster, cambio de password): solo admin.
- Auth (`/api/auth/*`) queda fuera de esa regla (login/logout).

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check (público) |
| POST | `/api/auth/login` | Login email + password (público) |
| GET | `/api/auth/me` | Usuario de la sesión actual |
| POST | `/api/auth/logout` | Cerrar sesión |
| PATCH | `/api/members/:id/password` | Cambiar password de un member (admin) |
| GET | `/api/kpis` | KPIs de ejemplo (SQLite) |
| GET | `/api/jira/config` | Config del equipo |
| GET | `/api/jira/tasks` | Tareas del equipo (JQL) |
| GET | `/api/jira/sprint/current` | Sprint abierto |
| GET | `/api/jira/sprints/:n/metrics` | Métricas ágiles del sprint |
| GET | `/api/jira/sprints/:n/metrics?all=true` | Métricas de todos los tickets del sprint |
| GET | `/api/jira/epics/status-times` | Tiempo en status por epic |

Las rutas `/api/*` (excepto `/api/auth/*`) requieren sesión. Los métodos de escritura (no GET) requieren además rol admin.

## Variables de entorno (API)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `8090` | Puerto del servidor |
| `LOG_LEVEL` | `info` | Nivel de log: `debug`, `info`, `warn`, `error` |
| `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | `30000` | Tiempo máx. para cerrar API/worker (requests, sync, DB) |
| `DEV_SHUTDOWN_GRACE_MS` | `8000` | Espera antes de forzar cierre en `bun run dev` |
| `DATABASE_URL` | — (**requerido**) | Conexión PostgreSQL (`postgresql://…`) |
| `WEB_ORIGIN` | `http://localhost:5173` | Origen CORS permitido (con credentials) |
| `AUTH_ADMIN_EMAIL` | — | Email del usuario admin (resto: `user`); se crea en members si falta |
| `AUTH_DEFAULT_PASSWORD` | — (**requerido**) | Password inicial de members / admin |
| `AUTH_SESSION_DAYS` | `7` | Duración de la sesión |
| `JIRA_BASE_URL` | — | URL de Jira Cloud |
| `JIRA_EMAIL` | — | Email Atlassian |
| `JIRA_API_TOKEN` | — | API token |
| `TEAM_CONFIG_PATH` | `packages/shared/config/teams/example.json` | Config del equipo (usa `local.json` gitignored en privado) |

### Worker (sync de sprints)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `WORKER_PORT` | `8091` | Puerto health del worker |
| `SYNC_CRON` | `0 3 * * *` | Cron diario (hora local del proceso) |
| `SYNC_SPRINT_DELAY_MS` | `60000` | Pausa entre sprints |
| `SYNC_CHANGELOG_CONCURRENCY` | `3` | Concurrencia de changelogs en worker |
| `SYNC_MAX_CLOSED_PER_RUN` | _(vacío)_ | Máx. sprints cerrados por ejecución |
| `SYNC_RUN_ON_START` | `false` | Ejecutar sync al iniciar el worker |

## Scripts

| Script | Descripción |
|--------|-------------|
| `bun run dev` | Dev en api + web + worker |
| `bun run dev:api` | Solo API |
| `bun run dev:web` | Solo web |
| `bun run build` | Build de todos los paquetes |
| `bun run typecheck` | Typecheck en todo el monorepo |
| `bun run export:tasks` | Excel de tareas + epics → `output/` |
| `bun run export:sprint -- 74` | Excel métricas sprint 74 |
| `bun run export:sprint -- 74 --all` | Métricas de todos los tickets del sprint |
| `bun run worker` | Worker con cron interno (proceso aparte de la API) |
| `bun run worker:sync` | Sync manual de sprints (Task Scheduler / debug) |
| `bun run db:migrate` | Aplicar migraciones Knex |
| `bun run db:seed` | Seeds (KPIs demo + miembro admin desde `AUTH_*`) |
| `bun run db:setup` | `db:migrate` + `db:seed` |

## Miembros del equipo

Los miembros viven en PostgreSQL (`team_members`) y empiezan **vacíos** — se añaden desde `/members` o la API.
`packages/shared/config/teams/example.json` define proyecto Jira y métricas ágiles de ejemplo. Para datos reales usa `local.json` (gitignored) vía `TEAM_CONFIG_PATH`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/members` | Lista miembros |
| POST | `/api/members` | `{ "name": "...", "email": "..." }` |
| PATCH | `/api/members/:id` | Actualizar `{ "name", "email" }` |
| POST | `/api/members/:id/resolve-jira` | Vincular email → Jira accountId |
| PATCH | `/api/members/:id/deactivate` | Desactivar (no borra) |
| DELETE | `/api/members/:id` | Eliminar definitivamente |

Jira usa los miembros **activos** de la DB para los filtros JQL.

## Frontend

| Ruta | Descripción |
|------|-------------|
| `/` | Overview |
| `/members` | Gestión de miembros del equipo |
| `/tasks` | Tabla de tareas del equipo |
| `/sprint` | Métricas ágiles (carga manual) |
