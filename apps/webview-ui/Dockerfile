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

# Next.js standalone binds to whatever HOSTNAME holds, and Docker fills that
# variable with the container id whenever the image leaves it unset. The server
# then listens on that one interface: reachable through a published port by
# accident, unreachable anywhere the name does not resolve. Pinning it is what
# lets a reverse proxy on the same network reach the container with no host
# port published, and it is what the upstream `with-docker` example does.
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
EXPOSE 3000

# Copia sólo lo necesario para producción (standalone, static y public)
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/.next/static ./apps/webview-ui/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/webview-ui/public ./apps/webview-ui/public

CMD ["node", "apps/webview-ui/server.js"]
