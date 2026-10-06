import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentService } from '../../../../../lib/server/service/projects/environment_service.js';
import { projectIdParam, LinkProjectEnvironmentRequest } from '$lib/schemas/projects';
import { z } from 'zod';

const environmentService = new ProjectEnvironmentService();

const projEnvDeleteParams = z.object({
  id: z.coerce.number().int().positive(),
  environmentId: z.coerce.number().int().positive()
});

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  try {
    const environmentsResponse = await environmentService.listProjectEnvironments(
      parsed.data.id,
      locals.user.userId
    );
    return json({ environments: environmentsResponse.environmentLinks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error listing project environments:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, LinkProjectEnvironmentRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const link = await environmentService.linkEnvironment(
      parsedParams.data.id,
      locals.user.userId,
      {
        environmentId: parsedBody.data.environment_id,
        variableMappings: parsedBody.data.variableMappings || {}
      }
    );
    return json({ link }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error linking environment:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Project or environment not found' }, { status: 404 });
    if (message.includes('already linked'))
      return json({ error: 'Environment is already linked to this project' }, { status: 409 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, LinkProjectEnvironmentRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const link = await environmentService.updateEnvironmentLink(
      parsedParams.data.id,
      parsedBody.data.environment_id,
      locals.user.userId,
      { variableMappings: parsedBody.data.variableMappings || {} }
    );
    return json({ link });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating environment mapping:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Project or environment not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ params, url, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projEnvDeleteParams.safeParse({
    ...params,
    environmentId: url.searchParams.get('environmentId')
  });
  if (!parsedParams.success)
    return json({ error: 'Invalid project or environment ID' }, { status: 400 });

  try {
    await environmentService.unlinkEnvironment(
      parsedParams.data.id,
      parsedParams.data.environmentId,
      locals.user.userId
    );
    return json({ message: 'Environment unlinked successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error unlinking environment:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Project, environment, or link not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
