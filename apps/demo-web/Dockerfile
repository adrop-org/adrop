# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json packages/sdk/
COPY apps/demo-web/package.json apps/demo-web/
RUN pnpm install --frozen-lockfile --filter @adrop/demo-web... --filter adrop-sdk...
COPY packages packages
COPY apps/demo-web apps/demo-web
# Public env is baked into the Next build.
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
ARG NEXT_PUBLIC_HOST_ATA
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL NEXT_PUBLIC_HOST_ATA=$NEXT_PUBLIC_HOST_ATA
RUN pnpm --filter adrop-sdk build && pnpm --filter @adrop/demo-web build
WORKDIR /app/apps/demo-web
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "start"]
