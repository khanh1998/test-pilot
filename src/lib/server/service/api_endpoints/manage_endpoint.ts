import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apiEndpoints, apis, testFlows } from '$lib/server/db/schema';
import { EndpointSearchIndexService } from './search_index';
import {
  parseOpenApiSource,
  putOperation,
  removeOperation,
  serializeOpenApiSource,
  type EndpointDefinition
} from './openapi_operation';

export class EndpointManagementError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'IN_USE' | 'INVALID'
  ) {
    super(message);
  }
}

export interface ManagedEndpointInput extends EndpointDefinition {
  apiId: number;
}

export async function createManagedEndpoint(input: ManagedEndpointInput, userId: number) {
  validateEndpoint(input);

  const endpoint = await db.transaction(async (tx) => {
    const [api] = await tx
      .select()
      .from(apis)
      .where(and(eq(apis.id, input.apiId), eq(apis.userId, userId)));
    if (!api) throw new EndpointManagementError('API not found or access denied', 'NOT_FOUND');

    const [duplicate] = await tx
      .select({ id: apiEndpoints.id })
      .from(apiEndpoints)
      .where(
        and(
          eq(apiEndpoints.apiId, input.apiId),
          eq(apiEndpoints.path, input.path),
          eq(apiEndpoints.method, input.method)
        )
      );
    if (duplicate) {
      throw new EndpointManagementError(
        `${input.method} ${input.path} already exists in this API`,
        'CONFLICT'
      );
    }

    const document = parseOpenApiSource(api.specContent, api.specFormat as 'yaml' | 'json');
    putOperation(document, input);
    const [created] = await tx.insert(apiEndpoints).values(toDatabaseValues(input)).returning();
    await tx
      .update(apis)
      .set({
        specContent: serializeOpenApiSource(document, api.specFormat as 'yaml' | 'json'),
        updatedAt: new Date()
      })
      .where(eq(apis.id, api.id));
    return { endpoint: created, api };
  });

  await indexEndpoint(endpoint.endpoint, endpoint.api, userId);
  return endpoint.endpoint;
}

export async function updateManagedEndpoint(
  endpointId: number,
  input: Omit<ManagedEndpointInput, 'apiId'>,
  userId: number
) {
  validateEndpoint(input);

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ endpoint: apiEndpoints, api: apis })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(and(eq(apiEndpoints.id, endpointId), eq(apis.userId, userId)));
    if (!current) {
      throw new EndpointManagementError('Endpoint not found or access denied', 'NOT_FOUND');
    }

    const [duplicate] = await tx
      .select({ id: apiEndpoints.id })
      .from(apiEndpoints)
      .where(
        and(
          eq(apiEndpoints.apiId, current.endpoint.apiId),
          eq(apiEndpoints.path, input.path),
          eq(apiEndpoints.method, input.method),
          ne(apiEndpoints.id, endpointId)
        )
      );
    if (duplicate) {
      throw new EndpointManagementError(
        `${input.method} ${input.path} already exists in this API`,
        'CONFLICT'
      );
    }

    const document = parseOpenApiSource(
      current.api.specContent,
      current.api.specFormat as 'yaml' | 'json'
    );
    putOperation(document, input, {
      path: current.endpoint.path,
      method: current.endpoint.method
    });
    const [updated] = await tx
      .update(apiEndpoints)
      .set(toDatabaseValues({ ...input, apiId: current.endpoint.apiId }))
      .where(eq(apiEndpoints.id, endpointId))
      .returning();
    await tx
      .update(apis)
      .set({
        specContent: serializeOpenApiSource(document, current.api.specFormat as 'yaml' | 'json'),
        updatedAt: new Date()
      })
      .where(eq(apis.id, current.api.id));
    return { endpoint: updated, api: current.api };
  });

  await indexEndpoint(result.endpoint, result.api, userId);
  return result.endpoint;
}

export async function deleteManagedEndpoint(endpointId: number, userId: number, force = false) {
  const references = await findEndpointReferences(endpointId, userId);
  if (references.length > 0 && !force) {
    throw new EndpointManagementError(
      `Endpoint is used by ${references.length} test flow${references.length === 1 ? '' : 's'}`,
      'IN_USE'
    );
  }

  const deleted = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ endpoint: apiEndpoints, api: apis })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(and(eq(apiEndpoints.id, endpointId), eq(apis.userId, userId)));
    if (!current) {
      throw new EndpointManagementError('Endpoint not found or access denied', 'NOT_FOUND');
    }

    const document = parseOpenApiSource(
      current.api.specContent,
      current.api.specFormat as 'yaml' | 'json'
    );
    removeOperation(document, current.endpoint.path, current.endpoint.method);
    await tx.delete(apiEndpoints).where(eq(apiEndpoints.id, endpointId));
    await tx
      .update(apis)
      .set({
        specContent: serializeOpenApiSource(document, current.api.specFormat as 'yaml' | 'json'),
        updatedAt: new Date()
      })
      .where(eq(apis.id, current.api.id));
    return current.endpoint;
  });

  return { endpoint: deleted, affectedFlows: references };
}

export async function findEndpointReferences(endpointId: number, userId: number) {
  const flows = await db
    .select({ id: testFlows.id, name: testFlows.name, flowJson: testFlows.flowJson })
    .from(testFlows)
    .where(eq(testFlows.userId, userId));

  return flows
    .filter((flow) => flowReferencesEndpoint(flow.flowJson, endpointId))
    .map(({ id, name }) => ({ id, name }));
}

function flowReferencesEndpoint(flowJson: unknown, endpointId: number): boolean {
  if (!flowJson || typeof flowJson !== 'object') return false;
  const steps = (flowJson as { steps?: unknown[] }).steps;
  if (!Array.isArray(steps)) return false;
  return steps.some((step) => {
    if (!step || typeof step !== 'object') return false;
    const endpoints = (step as { endpoints?: unknown[] }).endpoints;
    return (
      Array.isArray(endpoints) &&
      endpoints.some((endpoint) => {
        if (!endpoint || typeof endpoint !== 'object') return false;
        return Number((endpoint as { endpoint_id?: unknown }).endpoint_id) === endpointId;
      })
    );
  });
}

function validateEndpoint(endpoint: Omit<ManagedEndpointInput, 'apiId'>) {
  if (!endpoint.path.startsWith('/')) {
    throw new EndpointManagementError('Endpoint path must start with /', 'INVALID');
  }
  const pathParameters = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  const declared = new Set(
    (endpoint.parameters ?? [])
      .filter((parameter): parameter is Record<string, unknown> =>
        Boolean(parameter && typeof parameter === 'object' && !Array.isArray(parameter))
      )
      .filter((parameter) => parameter.in === 'path')
      .map((parameter) => String(parameter.name))
  );
  const missing = pathParameters.filter((name) => !declared.has(name));
  if (missing.length > 0) {
    throw new EndpointManagementError(
      `Missing path parameter definitions: ${missing.join(', ')}`,
      'INVALID'
    );
  }
}

function toDatabaseValues(input: ManagedEndpointInput) {
  return {
    apiId: input.apiId,
    path: input.path,
    method: input.method,
    operationId: input.operationId || null,
    summary: input.summary || null,
    description: input.description || null,
    requestSchema: input.requestSchema ?? null,
    responseSchema: input.responseSchema ?? null,
    parameters: input.parameters ?? [],
    tags: input.tags ?? []
  };
}

async function indexEndpoint(
  endpoint: typeof apiEndpoints.$inferSelect,
  api: typeof apis.$inferSelect,
  userId: number
) {
  const service = new EndpointSearchIndexService();
  await service.processEndpoint(endpoint, api.name, api.description || undefined, userId);
}
