import {
  createProjectSchema,
  offsetPaginatedResponseSchema,
  projectSchema,
  updateProjectSchema,
} from '../schemas/index.js';
import type {
  CreateProject,
  ListProjectsOptions,
  OffsetPaginatedResponse,
  Project,
  UpdateProject,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Projects API resource
 */
export class ProjectsResource extends BaseResource {
  /**
   * List projects with pagination
   */
  async list(
    options?: ListProjectsOptions,
  ): Promise<OffsetPaginatedResponse<Project>> {
    const searchParams = new URLSearchParams();

    if (options?.page !== undefined) {
      searchParams.set('page', options.page.toString());
    }
    if (options?.per_page !== undefined) {
      searchParams.set('per_page', options.per_page.toString());
    }
    if (options?.order) {
      searchParams.set('order', options.order);
    }

    const query = searchParams.toString();
    const url = query ? `api/projects?${query}` : 'api/projects';

    const data = await this.http.get(url).json();
    return this.validate(data, offsetPaginatedResponseSchema(projectSchema));
  }

  /**
   * Get a single project by ID
   */
  async get(id: number): Promise<Project> {
    const data = await this.http.get(`api/projects/${id}`).json();
    return this.validate(data, projectSchema);
  }

  /**
   * Create a new project
   */
  async create(input: CreateProject): Promise<Project> {
    // Validate input
    const validatedInput = this.validate(input, createProjectSchema);

    const data = await this.http
      .post('api/projects', { json: validatedInput })
      .json();

    return this.validate(data, projectSchema);
  }

  /**
   * Update an existing project
   */
  async update(id: number, input: UpdateProject): Promise<Project> {
    // Validate input
    const validatedInput = this.validate(input, updateProjectSchema);

    const data = await this.http
      .patch(`api/projects/${id}`, { json: validatedInput })
      .json();

    return this.validate(data, projectSchema);
  }

  /**
   * Delete a project
   */
  async delete(id: number): Promise<void> {
    await this.http.delete(`api/projects/${id}`);
  }
}
