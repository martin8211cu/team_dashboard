# Team Dashboard

Monorepo para visualizar KPIs del equipo de desarrollo.

## Stack

| Capa | Tecnología |
| --- | --- |
| Runtime | [Bun](https://bun.sh) |
| API | [Hono](https://hono.dev) + PostgreSQL + [Knex](https://knexjs.org) |
| Web | [React](https://react.dev) + [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query) |
| Build (web) | [Vite](https://vite.dev) |

## Estructura

```text
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

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) (setup local, PRs, qué no commitear).

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

# Config de equipo: ajusta TEAM_* en .env (ver tabla más abajo)

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
| --- | --- | --- |
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
| --- | --- | --- |
| GET | `/health` | Health check (público) |
| POST | `/api/auth/login` | Login email + password (público) |
| GET | `/api/auth/me` | Usuario de la sesión actual |
| POST | `/api/auth/logout` | Cerrar sesión |
| PATCH | `/api/members/:id/password` | Cambiar password de un member (admin) |
| GET | `/api/kpis` | KPIs de ejemplo |
| GET | `/api/jira/config` | Config del equipo |
| GET | `/api/jira/tasks` | Tareas del equipo (JQL) |
| GET | `/api/jira/sprint/current` | Sprint abierto |
| GET | `/api/jira/sprints/:n/metrics` | Métricas ágiles del sprint |
| GET | `/api/jira/sprints/:n/metrics?all=true` | Métricas de todos los tickets del sprint |
| GET | `/api/jira/epics/status-times` | Tiempo en status por epic |

Las rutas `/api/*` (excepto `/api/auth/*`) requieren sesión. Los métodos de escritura (no GET) requieren además rol admin.

## Variables de entorno (API)

| Variable | Default | Descripción |
| --- | --- | --- |
| `PORT` | `8090` | Puerto del servidor |
| `LOG_LEVEL` | `info` | Nivel de log: `debug`, `info`, `warn`, `error` |
| `GRACEFUL_SHUTDOWN_TIMEOUT_MS` | `30000` | Tiempo máx. para cerrar API/worker (requests, sync, DB) |
| `DEV_SHUTDOWN_GRACE_MS` | `8000` | Espera antes de forzar cierre en `bun run dev` |
| `DATABASE_URL` | — (**requerido**) | Conexión PostgreSQL (`postgresql://…`) |
| `WEB_ORIGIN` | `http://localhost:5173` | URL pública del **frontend** (CORS, sin `/` final) |
| `AUTH_COOKIE_SECURE` | `true` en prod si `NODE_ENV=production` | Cookie de sesión solo HTTPS |
| `AUTH_COOKIE_SAME_SITE` | `lax` | Usar `none` si web y API están en dominios distintos (con HTTPS) |
| `AUTH_ADMIN_EMAIL` | — | Email del usuario admin (resto: `user`); se crea en members si falta |
| `AUTH_DEFAULT_PASSWORD` | — (**requerido**) | Password inicial de members / admin |
| `AUTH_SESSION_DAYS` | `7` | Duración de la sesión |
| `JIRA_BASE_URL` | — | URL de Jira Cloud |
| `JIRA_EMAIL` | — | Email Atlassian |
| `JIRA_API_TOKEN` | — | API token |
| `TEAM_PROJECT` | — (o JSON) | Clave Jira del proyecto; si está definida, la config viene de env |
| `TEAM_MIN_SPRINT_NUMBER` | — | Sprints visibles/sync desde este número |
| `TEAM_EPICS_SUMMARY_CONTAINS` | — | Filtro de epics en JQL |
| `TEAM_BOARD_ID` | — | Board Scrum (opcional; si falta, se resuelve por proyecto) |
| `TEAM_CYCLE_START_STATUS` | defaults en `example.json` | Inicio de ciclo (métricas ágiles) |
| `TEAM_BLOCKED_STATUS` | — | Estado “bloqueado” |
| `TEAM_REFINEMENT_STATUS` | — | Estado de refinamiento |
| `TEAM_CONFIG_PATH` | `example.json` | Solo si **no** usas `TEAM_PROJECT` (JSON en disco) |

### Worker (sync de sprints)

| Variable | Default | Descripción |
| --- | --- | --- |
| `WORKER_PORT` | `8091` | Puerto health del worker |
| `SYNC_CRON` | `0 3 * * *` | Cron diario (hora local del proceso) |
| `SYNC_SPRINT_DELAY_MS` | `60000` | Pausa entre sprints |
| `SYNC_CHANGELOG_CONCURRENCY` | `3` | Concurrencia de changelogs en worker |
| `SYNC_MAX_CLOSED_PER_RUN` | _(vacío)_ | Máx. sprints cerrados por ejecución |
| `SYNC_RUN_ON_START` | `false` | Ejecutar sync al iniciar el worker |

### Web (build de `apps/web`)

| Variable | Cuándo | Descripción |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Build (Coolify) | URL pública de la API. **Vacío** si nginx/Coolify sirve web + `/api` en el mismo dominio |
| `VITE_DEV_API_URL` | Solo `dev:web` | Target del proxy Vite (default `http://localhost:8090`) |

## Despliegue (prod)

Dos patrones habituales:

**1. Mismo dominio (recomendado)** — p. ej. `https://dashboard.example.com` sirve el static de Vite y el proxy envía `/api` y `/health` al contenedor API.

- API: `WEB_ORIGIN=https://dashboard.example.com`, resto de secretos en runtime.
- Web build: **no** definas `VITE_API_BASE_URL` (el browser usa rutas relativas `/api/...`).
- Cookies: `AUTH_COOKIE_SAME_SITE=lax` (default), `AUTH_COOKIE_SECURE=true`.

**2. Dominios separados** — web `https://app.example.com`, API `https://api.example.com`.

- API: `WEB_ORIGIN=https://app.example.com` (debe coincidir exactamente con el origen del navegador).
- Web build: `VITE_API_BASE_URL=https://api.example.com`.
- Cookies: `AUTH_COOKIE_SAME_SITE=none` y `AUTH_COOKIE_SECURE=true` (obligatorio con HTTPS).

En Coolify: variables de **runtime** en el servicio API/worker; `VITE_*` en el **build** del servicio web (se hornean en el bundle).

## Docker (sin PostgreSQL en el stack)

Postgres va **fuera** (Coolify, RDS, etc.): define `DATABASE_URL` en `.env`.

```bash
cp .env.example .env
# Editar DATABASE_URL, AUTH_*, JIRA_*, WEB_ORIGIN=http://localhost:8080

docker compose --profile setup run --rm migrate
docker compose --profile setup run --rm seed
docker compose up -d --build
```

- **web** (nginx + static): puerto `WEB_PORT` (default **8080**). Proxy `/api` y `/health` → contenedor **api**.
- **api** / **worker**: binarios compilados con Bun (`team-dashboard-api`, `team-dashboard-worker`); Hono en 8090 (solo red interna).
- **migrate** / **seed**: imagen ligera [`packages/db/Dockerfile`](packages/db/Dockerfile) (solo Knex + scripts).

Build args del servicio web: `VITE_API_BASE_URL` vacío = mismo origen (patrón recomendado con nginx). Imágenes: [`apps/api/Dockerfile`](apps/api/Dockerfile), [`apps/web/Dockerfile`](apps/web/Dockerfile), [`packages/db/Dockerfile`](packages/db/Dockerfile) (setup DB).

### Coolify

Usa [`docker-compose.coolify.yml`](docker-compose.coolify.yml) como Compose file en el recurso **Docker Compose** (no incluye Postgres).

1. Postgres en Coolify → variable `DATABASE_URL` en el stack (host interno, p. ej. `postgres://…@coolify-db:5432/…`).
2. Rellena en la UI las variables con `:?` (`WEB_ORIGIN`, `AUTH_*`, `JIRA_*`, …). Coolify las detecta del compose.
3. **Dominio público** solo en el servicio **`web`** (escucha en 80). `api` y `worker` quedan en la red interna.
4. `WEB_ORIGIN` = URL HTTPS del dashboard (misma que el dominio de `web`).
5. **migrate** y **seed** van en el compose (one-shot); `api` arranca cuando ambos terminan bien.
6. `VITE_API_BASE_URL` vacío en build de `web` (nginx hace proxy `/api` → `api:8090`).

Local dev del compose de Coolify: `docker compose -f docker-compose.coolify.yml config`

## Scripts

| Script | Descripción |
| --- | --- |
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
Proyecto Jira y métricas ágiles: define `TEAM_*` en `.env` (recomendado en Docker/Coolify). Alternativa legacy: `TEAM_CONFIG_PATH` a un JSON (`example.json` en repo, `local.json` gitignored).

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/members` | Lista miembros |
| POST | `/api/members` | `{ "name": "...", "email": "..." }` |
| PATCH | `/api/members/:id` | Actualizar `{ "name", "email" }` |
| POST | `/api/members/:id/resolve-jira` | Vincular email → Jira accountId |
| PATCH | `/api/members/:id/deactivate` | Desactivar (no borra) |
| DELETE | `/api/members/:id` | Eliminar definitivamente |

Jira usa los miembros **activos** de la DB para los filtros JQL.

## Frontend

| Ruta | Descripción |
| --- | --- |
| `/` | Overview |
| `/members` | Gestión de miembros del equipo |
| `/tasks` | Tabla de tareas del equipo |
| `/sprint` | Métricas ágiles (carga manual) |
