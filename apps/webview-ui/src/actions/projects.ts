'use server';

import type {
  CreateProject,
  ListProjectsOptions,
  OffsetPaginatedResponse,
  Project,
  UpdateProject,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get projects with pagination.
 *
 * @param options - Optional pagination options
 * @returns Paginated list of projects
 * @throws AuthenticationError if not authenticated
 */
export async function getProjects(
  options?: ListProjectsOptions,
): Promise<OffsetPaginatedResponse<Project>> {
  const client = await createClient();
  return client.projects.list(options);
}

/**
 * Get a single project by ID.
 *
 * @param id - Project ID
 * @returns The project
 * @throws NotFoundError if project doesn't exist
 * @throws AuthenticationError if not authenticated
 */
export async function getProject(id: number): Promise<Project> {
  const client = await createClient();
  return client.projects.get(id);
}

/**
 * Create a new project.
 *
 * @param input - Project data (name, optional slug)
 * @returns The created project
 * @throws BadRequestError if validation fails
 * @throws AuthenticationError if not authenticated
 */
export async function createProject(input: CreateProject): Promise<Project> {
  const client = await createClient();
  return client.projects.create(input);
}

/**
 * Update an existing project.
 *
 * @param id - Project ID
 * @param input - Fields to update (name)
 * @returns The updated project
 * @throws NotFoundError if project doesn't exist
 * @throws BadRequestError if validation fails
 * @throws AuthenticationError if not authenticated
 */
export async function updateProject(
  id: number,
  input: UpdateProject,
): Promise<Project> {
  const client = await createClient();
  return client.projects.update(id, input);
}

/**
 * Delete a project.
 *
 * @param id - Project ID
 * @throws NotFoundError if project doesn't exist
 * @throws AuthenticationError if not authenticated
 */
export async function deleteProject(id: number): Promise<void> {
  const client = await createClient();
  return client.projects.delete(id);
}
