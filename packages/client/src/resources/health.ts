import type { ServerVersion } from '../schemas/version.js';
import { serverVersionSchema } from '../schemas/version.js';
import { BaseResource } from './base.js';

export class HealthResource extends BaseResource {
  async getVersion(): Promise<ServerVersion> {
    const data = await this.http.get('health/version').json();
    return this.validate(data, serverVersionSchema);
  }
}
