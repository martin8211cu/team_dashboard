# Migrations/seeds only — smaller than the full API image.
FROM oven/bun:1.2-slim
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/export/package.json packages/export/
COPY packages/shared/package.json packages/shared/

RUN bun install --frozen-lockfile --filter "@team-dashboard/db" --production

COPY packages/db packages/db
