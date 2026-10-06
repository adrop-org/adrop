# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json packages/sdk/
COPY apps/server/package.json apps/server/
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile --filter @adrop/server... --filter @adrop/shared...
COPY packages/shared packages/shared
COPY apps/server apps/server
WORKDIR /app/apps/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
