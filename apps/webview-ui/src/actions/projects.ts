'use server';

import type {
  CreateProject,
  ListProjectsOptions,
  OffsetPaginatedResponse,
  Project,
  Result,
  RustrakError,
  UpdateProject,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get projects with pagination.
 *
 * @param options - Optional pagination options
 * @returns Paginated list of projects, or the failure that stopped it
 */
export async function getProjects(
  options?: ListProjectsOptions,
): Promise<Result<OffsetPaginatedResponse<Project>, RustrakError>> {
  const client = await createClient();
  return client.projects.list(options);
}

/**
 * Get a single project by ID.
 *
 * @param id - Project ID
 * @returns The project
 */
export async function getProject(
  id: number,
): Promise<Result<Project, RustrakError>> {
  const client = await createClient();
  return client.projects.get(id);
}

/**
 * Create a new project.
 *
 * @param input - Project data (name, optional slug)
 * @returns The created project
 */
export async function createProject(
  input: CreateProject,
): Promise<Result<Project, RustrakError>> {
  const client = await createClient();
  return client.projects.create(input);
}

/**
 * Update an existing project.
 *
 * @param id - Project ID
 * @param input - Fields to update (name)
 * @returns The updated project
 */
export async function updateProject(
  id: number,
  input: UpdateProject,
): Promise<Result<Project, RustrakError>> {
  const client = await createClient();
  return client.projects.update(id, input);
}

/**
 * Delete a project.
 *
 * @param id - Project ID
 */
export async function deleteProject(
  id: number,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.projects.delete(id);
}
