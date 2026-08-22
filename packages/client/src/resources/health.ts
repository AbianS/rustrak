import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import type { ServerVersion } from '../schemas/version.js';
import { serverVersionSchema } from '../schemas/version.js';
import { BaseResource } from './base.js';

export class HealthResource extends BaseResource {
  /**
   * The version the server reports for itself.
   *
   * Authenticated: the server answers this one to a session or a Bearer token
   * only, and returns 401 to anonymous callers. `/health` and `/health/ready`
   * stay open for probes; a version number is what tells a stranger which
   * advisories apply to your instance, so it is not probe material.
   */
  async getVersion(): Promise<Result<ServerVersion, RustrakError>> {
    return this.request(
      () => this.http.get('health/version'),
      serverVersionSchema,
    );
  }
}
