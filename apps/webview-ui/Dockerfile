FROM node:lts-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Instala pnpm usando corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instala dependencias del sistema necesarias
RUN apk update && apk add --no-cache libc6-compat

# --------- BUILDER ---------
FROM base AS builder
WORKDIR /app

RUN pnpm add -g turbo

COPY . .

# Genera workspace aislado (json + package.json de subworkspaces)
RUN turbo prune webview-ui --docker

# --------- INSTALLER ---------
FROM base AS installer
WORKDIR /app

# Copia sólo lo necesario para instalar dependencias
COPY --from=builder /app/out/json/ .

# Instala sólo dependencias de producción, aprovecha caché del store de pnpm
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Copia el código completo para el build
COPY --from=builder /app/out/full/ .

# Ejecuta el build
RUN pnpm run build

# --------- RUNNER ---------
FROM base AS runner
WORKDIR /app

# No ejecuta como root
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

# Copia sólo lo necesario para producción (standalone, static y public)
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/.next/static ./apps/webview-ui/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/public ./apps/webview-ui/public

CMD node apps/webview-ui/server.js
