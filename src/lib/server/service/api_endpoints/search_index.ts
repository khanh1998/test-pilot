import { EndpointSearchIndexRepository } from '$lib/server/repository/db/endpoint-search-index';
import type { NewEndpointSearchIndex } from '$lib/server/db/types';
import type { ApiEndpoint } from '$lib/types/api';

export class EndpointSearchIndexService {
  private repository: EndpointSearchIndexRepository;

  constructor() {
    this.repository = new EndpointSearchIndexRepository();
  }

  async processEndpoint(
    endpoint: ApiEndpoint,
    apiName: string,
    apiDescription?: string,
    userId?: number
  ) {
    const processedText = createEndpointSearchText(endpoint, apiName, apiDescription);
    const searchIndex: NewEndpointSearchIndex = {
      endpointId: endpoint.id,
      userId,
      apiId: endpoint.apiId,
      processedText
    };

    return this.repository.createOrUpdate(searchIndex);
  }

  async batchProcessEndpoints(
    endpoints: ApiEndpoint[],
    apiName: string,
    apiDescription?: string,
    userId?: number,
    batchSize = 10
  ) {
    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      await Promise.all(
        batch.map((endpoint) => this.processEndpoint(endpoint, apiName, apiDescription, userId))
      );
    }
  }

  async deleteEndpointSearchIndex(endpointId: number) {
    return this.repository.delete(endpointId);
  }

  async getSearchIndexesByApiId(apiId: number) {
    return this.repository.getByApiId(apiId);
  }

  async getSearchIndexByEndpointId(endpointId: number) {
    return this.repository.getByEndpointId(endpointId);
  }

  async verifyEndpointAccess(endpointId: number, userId: number) {
    return this.repository.verifyEndpointAccess(endpointId, userId);
  }

  async getEndpointWithApi(endpointId: number, userId: number) {
    return this.repository.getEndpointWithApi(endpointId, userId);
  }
}

export function createEndpointSearchText(
  endpoint: ApiEndpoint,
  apiName: string,
  apiDescription?: string
): string {
  const parts = [`${endpoint.method.toUpperCase()} ${endpoint.path}`, `API: ${apiName}`];

  if (apiDescription) parts.push(`API Description: ${apiDescription}`);
  if (endpoint.summary) parts.push(`Summary: ${endpoint.summary}`);
  if (endpoint.description) parts.push(`Description: ${endpoint.description}`);
  if (endpoint.operationId) parts.push(`Operation: ${endpoint.operationId}`);
  if (endpoint.tags?.length) parts.push(`Tags: ${endpoint.tags.join(', ')}`);

  const resource = inferResourceFromPath(endpoint.path);
  if (resource) parts.push(`Resource: ${resource}`);

  const alternatives = generateAlternativePhrasings(resource, endpoint.method, endpoint.path);
  if (alternatives) parts.push(alternatives);

  return parts.join('\n');
}

function inferResourceFromPath(path: string): string | null {
  const parts = path.replace(/^\//, '').split('/');
  const resource = parts[0];

  if (['api', 'v1', 'v2', 'v3', 'docs', 'swagger', 'health'].includes(resource)) {
    return parts.length > 1 ? parts[1] : null;
  }

  return resource || null;
}

function generateAlternativePhrasings(
  resource: string | null,
  method: string,
  path: string
): string {
  if (!resource) return '';

  const operation = methodToOperation(method, path);
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  const plural = resource.endsWith('s') ? resource : `${resource}s`;

  switch (operation) {
    case 'list':
      return `Alternatives: get all ${plural}, retrieve ${plural}, list ${plural}, fetch ${plural}`;
    case 'get':
      return `Alternatives: get a ${singular}, get ${singular} details, retrieve a ${singular}, fetch a ${singular}`;
    case 'create':
      return `Alternatives: create a new ${singular}, add a ${singular}, register a ${singular}`;
    case 'update':
      return `Alternatives: update a ${singular}, modify a ${singular}, edit a ${singular}, change a ${singular}`;
    case 'delete':
      return `Alternatives: delete a ${singular}, remove a ${singular}`;
    default:
      return '';
  }
}

function methodToOperation(method: string, path: string): string {
  const normalizedMethod = method.toLowerCase();
  const hasIdParam = path.match(/\{.+\}|:.+?($|\/)/);

  switch (normalizedMethod) {
    case 'get':
      return hasIdParam ? 'get' : 'list';
    case 'post':
      return 'create';
    case 'put':
    case 'patch':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return normalizedMethod;
  }
}
