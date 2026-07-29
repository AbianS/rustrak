import type { Project } from '@rustrak/client';
import type { CommandProject } from '@/shared/config/commands';

/**
 * Narrows a project to the three fields the command bar renders.
 *
 * This is the seam that keeps `shared` from knowing `@rustrak/client` exists:
 * the bar lives in `shared/ui`, so it cannot name `Project`, and the pages it
 * offers per project are a fixed template it already holds. All it needs from
 * this slice is which projects exist and what they are called.
 */
export function toCommandProjects(projects: Project[]): CommandProject[] {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    platform: project.platform,
  }));
}
