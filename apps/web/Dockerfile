FROM oven/bun:1.2-slim AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/export/package.json packages/export/
COPY packages/shared/package.json packages/shared/

RUN bun install --frozen-lockfile --filter "@team-dashboard/web"

COPY packages/shared packages/shared
COPY apps/web apps/web

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN bun run --filter @team-dashboard/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1
