FROM oven/bun:1.2-slim AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/export/package.json packages/export/
COPY packages/shared/package.json packages/shared/

RUN bun install --frozen-lockfile --filter "@team-dashboard/api" --production

COPY packages packages
COPY apps/api apps/api

# bun may hoist pdfkit under /app/node_modules; the PDF entry imports the
# browser build via apps/api/node_modules/pdfkit so compile can embed fonts.
RUN set -e; \
  PDFKIT_PKG="$(bun -e "console.log(Bun.resolveSync('pdfkit/package.json', process.cwd() + '/apps/api/src'))")"; \
  PDFKIT_DIR="$(dirname "$PDFKIT_PKG")"; \
  mkdir -p apps/api/node_modules; \
  ln -sfn "$PDFKIT_DIR" apps/api/node_modules/pdfkit; \
  test -f apps/api/node_modules/pdfkit/js/pdfkit.browser.mjs

RUN set -e; \
  EXTRAS=""; \
  for pkg in mysql2 oracledb mariadb tedious sqlite3 mysql better-sqlite3; do \
    EXTRAS="$EXTRAS --external $pkg"; \
  done; \
  bun build apps/api/src/index.ts --compile --target=bun --minify --outfile /app/team-dashboard-api $EXTRAS; \
  bun build apps/api/src/worker/index.ts --compile --target=bun --minify --outfile /app/team-dashboard-worker $EXTRAS

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/team-dashboard-api /usr/local/bin/team-dashboard-api
COPY --from=build /app/team-dashboard-worker /usr/local/bin/team-dashboard-worker
COPY packages/shared/config/teams /app/packages/shared/config/teams

WORKDIR /app
ENV NODE_ENV=production
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8090}/health" || exit 1

CMD ["/usr/local/bin/team-dashboard-api"]
