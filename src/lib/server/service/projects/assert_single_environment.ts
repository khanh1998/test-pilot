import { ProjectEnvironmentRepository } from '../../repository/db/project_environment.js';

/**
 * A project has exactly one environment (its dev/staging/prod variants are sub-environments
 * inside that environment). The database would allow more links, but the UI only shows the
 * first one, so every way of linking an environment must go through this check.
 *
 * Linking the environment that is already linked is not a violation; callers handle that case.
 * Pass null for environmentId to require that the project has no environment at all.
 * The message contains "already linked" so route handlers map it to 409.
 */
export async function assertNoOtherEnvironmentLinked(
  projectId: number,
  environmentId: number | null,
  repo = new ProjectEnvironmentRepository()
): Promise<void> {
  const { environmentLinks } = await repo.listProjectEnvironments(projectId);
  const other = environmentLinks.find((link) => link.environmentId !== environmentId);
  if (other) {
    throw new Error(
      `Project already linked to environment ${other.environmentId}; a project can have only one environment. Unlink it first, or add a sub-environment to it instead.`
    );
  }
}
