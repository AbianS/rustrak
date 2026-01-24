import { z } from 'zod';
import {
  createNotificationChannelSchema,
  notificationChannelSchema,
  testChannelResponseSchema,
  updateNotificationChannelSchema,
} from '../schemas/alert.js';
import type {
  CreateNotificationChannel,
  NotificationChannel,
  TestChannelResponse,
  UpdateNotificationChannel,
} from '../types/alert.js';
import { BaseResource } from './base.js';

/**
 * Alert Channels API resource (global notification destinations)
 */
export class AlertChannelsResource extends BaseResource {
  /**
   * List all notification channels
   */
  async list(): Promise<NotificationChannel[]> {
    const data = await this.http.get('api/alert-channels').json();
    return this.validate(data, z.array(notificationChannelSchema));
  }

  /**
   * Get a single notification channel by ID
   */
  async get(id: number): Promise<NotificationChannel> {
    const data = await this.http.get(`api/alert-channels/${id}`).json();
    return this.validate(data, notificationChannelSchema);
  }

  /**
   * Create a new notification channel
   */
  async create(input: CreateNotificationChannel): Promise<NotificationChannel> {
    const validatedInput = this.validate(
      input,
      createNotificationChannelSchema,
    );

    const data = await this.http
      .post('api/alert-channels', { json: validatedInput })
      .json();

    return this.validate(data, notificationChannelSchema);
  }

  /**
   * Update an existing notification channel
   */
  async update(
    id: number,
    input: UpdateNotificationChannel,
  ): Promise<NotificationChannel> {
    const validatedInput = this.validate(
      input,
      updateNotificationChannelSchema,
    );

    const data = await this.http
      .patch(`api/alert-channels/${id}`, { json: validatedInput })
      .json();

    return this.validate(data, notificationChannelSchema);
  }

  /**
   * Delete a notification channel
   */
  async delete(id: number): Promise<void> {
    await this.http.delete(`api/alert-channels/${id}`);
  }

  /**
   * Send a test notification to verify channel configuration
   */
  async test(id: number): Promise<TestChannelResponse> {
    const data = await this.http.post(`api/alert-channels/${id}/test`).json();
    return this.validate(data, testChannelResponseSchema);
  }
}
