# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json packages/sdk/
COPY apps/app-web/package.json apps/app-web/
RUN pnpm install --frozen-lockfile --filter @adrop/app-web... --filter adrop-sdk...
COPY packages packages
COPY apps/app-web apps/app-web
# Public env is baked into the Next build.
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_HOST_ATA
ARG NEXT_PUBLIC_APP_URL=https://app.adrop.sh
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL NEXT_PUBLIC_HOST_ATA=$NEXT_PUBLIC_HOST_ATA NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# The CI runner caps jobs at 2 GB (operator ADR-0008) and kaniko shares it: keep Next's heap small, one worker.
ENV NODE_OPTIONS=--max-old-space-size=768 NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter adrop-sdk build && pnpm --filter @adrop/app-web build
WORKDIR /app/apps/app-web
ENV NODE_ENV=production
EXPOSE 3002
CMD ["pnpm", "start"]
