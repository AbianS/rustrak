import type { z } from 'zod';
import type {
  createProjectSchema,
  projectSchema,
  updateProjectSchema,
} from '../schemas/project.js';

/**
 * Project resource from the API
 */
export type Project = z.infer<typeof projectSchema>;

/**
 * Request payload for creating a project
 */
export type CreateProject = z.infer<typeof createProjectSchema>;

/**
 * Request payload for updating a project
 */
export type UpdateProject = z.infer<typeof updateProjectSchema>;
