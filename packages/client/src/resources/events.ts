import {
  eventDetailSchema,
  eventSchema,
  paginatedResponseSchema,
} from '../schemas/index.js';
import type {
  Event,
  EventDetail,
  ListEventsOptions,
  PaginatedResponse,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Events API resource
 */
export class EventsResource extends BaseResource {
  /**
   * List events for an issue with pagination
   */
  async list(
    projectId: number,
    issueId: string,
    options?: ListEventsOptions,
  ): Promise<PaginatedResponse<Event>> {
    const searchParams: Record<string, string> = {};

    if (options?.order) {
      searchParams.order = options.order;
    }
    if (options?.cursor) {
      searchParams.cursor = options.cursor;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/events`, {
        searchParams,
      })
      .json();

    return this.validate(data, paginatedResponseSchema(eventSchema));
  }

  /**
   * Get a single event by ID with full details
   */
  async get(
    projectId: number,
    issueId: string,
    eventId: string,
  ): Promise<EventDetail> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/events/${eventId}`)
      .json();

    return this.validate(data, eventDetailSchema);
  }
}
