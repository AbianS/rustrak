import { offsetPaginatedResponseSchema, spanSchema } from '../schemas/index.js';
import type {
  ListSpansOptions,
  OffsetPaginatedResponse,
  Span,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Spans API resource — the shared `spans` table (standalone "span" envelope
 * items AND transaction-embedded spans both live here and share this
 * response shape).
 */
export class SpansResource extends BaseResource {
  /**
   * List spans for a project with offset-based pagination (newest first),
   * optionally filtered by op/status/trace_id/operation_type.
   */
  async list(
    projectId: number,
    options?: ListSpansOptions,
  ): Promise<OffsetPaginatedResponse<Span>> {
    const searchParams: Record<string, string> = {};

    if (options?.page) {
      searchParams.page = String(options.page);
    }
    if (options?.per_page) {
      searchParams.per_page = String(options.per_page);
    }
    if (options?.op) {
      searchParams.op = options.op;
    }
    if (options?.status) {
      searchParams.status = options.status;
    }
    if (options?.trace_id) {
      searchParams.trace_id = options.trace_id;
    }
    if (options?.operation_type) {
      searchParams.operation_type = options.operation_type;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/spans`, { searchParams })
      .json();

    return this.validate(data, offsetPaginatedResponseSchema(spanSchema));
  }
}
