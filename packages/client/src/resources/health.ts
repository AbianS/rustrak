import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import type { ServerVersion } from '../schemas/version.js';
import { serverVersionSchema } from '../schemas/version.js';
import { BaseResource } from './base.js';

export class HealthResource extends BaseResource {
  async getVersion(): Promise<Result<ServerVersion, RustrakError>> {
    return this.request(
      () => this.http.get('health/version'),
      serverVersionSchema,
    );
  }
}
