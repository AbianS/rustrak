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

COPY . .

# Genera workspace aislado (json + package.json de subworkspaces)
RUN pnpm dlx turbo prune webview-ui --docker

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

# Next.js standalone reads HOSTNAME and PORT at runtime.
# HOSTNAME controls the bind address; 0.0.0.0 is correct for Docker.
# HOST is also accepted as alias via startup shell (HOST -> HOSTNAME fallback).
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
EXPOSE 3000

# Copia sólo lo necesario para producción (standalone, static y public)
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/.next/static ./apps/webview-ui/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/public ./apps/webview-ui/public

# HOST is an alias for HOSTNAME (common convention). Next.js standalone only
# reads HOSTNAME, so map HOST -> HOSTNAME when HOSTNAME is not explicitly set.
# This allows `HOST=0.0.0.0` or reverse-proxy setups without exposing a port.
CMD ["sh", "-c", "HOSTNAME=${HOSTNAME:-${HOST:-0.0.0.0}} PORT=${PORT:-3000} node apps/webview-ui/server.js"]
