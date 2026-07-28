import 'server-only';

/**
 * Reads for the alert feature: the rules a project has, and the integrations
 * they route to. A rule without an integration does nothing, which is why the
 * two live in one slice.
 */
import type {
  AlertIntegration,
  AlertRule,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

// ============================================================================
// Alert Integrations (Global Credential Destinations)
// ============================================================================

export async function listIntegrations(): Promise<
  Result<AlertIntegration[], RustrakError>
> {
  const client = await createClient();
  return client.alertIntegrations.list();
}

export async function listAlertRules(
  projectId: number,
): Promise<Result<AlertRule[], RustrakError>> {
  const client = await createClient();
  return client.alertRules.list(projectId);
}
