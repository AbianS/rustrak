# Deferred Work

Deferred from: bmad-quick-dev session 2026-05-20 (Uptime Monitoring)

## Goal 2 — Alert routing para errores existentes de Sentry
Canales globales reutilizables + routing por proyecto para eventos Sentry (FR-C1, FR-C3).
Mejora al sistema de alertas existente, independiente del scheduler de uptime.
**Depends on:** Goal 1 (backend core) para la tabla `alert_channels`.

## Goal 3 — Frontend UI (Uptime section)
Sección "Uptime" top-level en Next.js: lista de monitores, página de detalle, histórico de checks, incident log, uptime % charts.
**Depends on:** Goal 1 (API REST de monitores operativa).

## Goal 4 — MCP tools para uptime
Añadir tools `create_monitor`, `list_monitors`, `get_monitor`, `update_monitor`, `delete_monitor`, `get_monitor_status` al paquete `@rustrak/mcp` existente.
**Depends on:** Goal 1 (API REST de monitores operativa).
