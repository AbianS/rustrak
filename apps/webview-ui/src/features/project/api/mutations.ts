'use server';

import type {
  CreateProject,
  Project,
  Result,
  RustrakError,
  UpdateProject,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

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
