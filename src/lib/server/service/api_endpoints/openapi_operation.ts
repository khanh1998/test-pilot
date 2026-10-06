import yaml from 'js-yaml';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface EndpointDefinition {
  path: string;
  method: HttpMethod;
  operationId?: string | null;
  summary?: string | null;
  description?: string | null;
  requestSchema?: unknown;
  responseSchema?: unknown;
  parameters?: unknown[];
  tags?: string[];
}

type OpenApiDocument = Record<string, unknown> & {
  openapi?: string;
  swagger?: string;
  paths?: Record<string, Record<string, unknown>>;
};

export function parseOpenApiSource(content: string, format: 'yaml' | 'json'): OpenApiDocument {
  const parsed = format === 'yaml' ? yaml.load(content) : JSON.parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The stored API specification is not an OpenAPI object');
  }
  return parsed as OpenApiDocument;
}

export function serializeOpenApiSource(document: OpenApiDocument, format: 'yaml' | 'json'): string {
  return format === 'yaml'
    ? yaml.dump(document, { noRefs: true, lineWidth: 120 })
    : JSON.stringify(document, null, 2);
}

export function putOperation(
  document: OpenApiDocument,
  endpoint: EndpointDefinition,
  previousIdentity?: { path: string; method: string }
): OpenApiDocument {
  const paths = (document.paths ??= {});
  const normalizedMethod = endpoint.method.toLowerCase();
  const oldMethod = previousIdentity?.method.toLowerCase();
  const existingOperation =
    previousIdentity && paths[previousIdentity.path]
      ? paths[previousIdentity.path][oldMethod!]
      : paths[endpoint.path]?.[normalizedMethod];

  if (
    previousIdentity &&
    (previousIdentity.path !== endpoint.path || oldMethod !== normalizedMethod)
  ) {
    removeOperation(document, previousIdentity.path, previousIdentity.method);
  }

  const pathItem = (paths[endpoint.path] ??= {});
  pathItem[normalizedMethod] = buildOperation(document, endpoint, existingOperation);
  return document;
}

export function removeOperation(
  document: OpenApiDocument,
  path: string,
  method: string
): OpenApiDocument {
  const pathItem = document.paths?.[path];
  if (!pathItem) return document;

  delete pathItem[method.toLowerCase()];
  const remainingKeys = Object.keys(pathItem);
  if (remainingKeys.length === 0 || remainingKeys.every((key) => key === 'parameters')) {
    delete document.paths?.[path];
  }
  return document;
}

function buildOperation(
  document: OpenApiDocument,
  endpoint: EndpointDefinition,
  existingOperation: unknown
): Record<string, unknown> {
  const existing =
    existingOperation && typeof existingOperation === 'object' && !Array.isArray(existingOperation)
      ? (existingOperation as Record<string, unknown>)
      : {};
  const operation: Record<string, unknown> = { ...existing };

  setOptional(operation, 'operationId', endpoint.operationId);
  setOptional(operation, 'summary', endpoint.summary);
  setOptional(operation, 'description', endpoint.description);
  operation.tags = endpoint.tags ?? [];

  if (document.swagger === '2.0') {
    const parameters = (endpoint.parameters ?? []).filter(
      (parameter) => !isRecord(parameter) || parameter.in !== 'body'
    );
    if (endpoint.requestSchema !== null && endpoint.requestSchema !== undefined) {
      const existingBodyParameter = Array.isArray(existing.parameters)
        ? existing.parameters.find((parameter) => isRecord(parameter) && parameter.in === 'body')
        : undefined;
      parameters.push({
        ...(isRecord(existingBodyParameter) ? existingBodyParameter : {}),
        name: 'body',
        in: 'body',
        required: true,
        schema: endpoint.requestSchema
      });
    }
    operation.parameters = parameters;
    operation.responses = updateResponses(existing.responses, endpoint.responseSchema, 'swagger2');
    delete operation.requestBody;
  } else {
    operation.parameters = endpoint.parameters ?? [];
    if (endpoint.requestSchema !== null && endpoint.requestSchema !== undefined) {
      const existingRequestBody = isRecord(existing.requestBody) ? existing.requestBody : {};
      const existingContent = isRecord(existingRequestBody.content)
        ? existingRequestBody.content
        : {};
      const existingJsonContent = isRecord(existingContent['application/json'])
        ? existingContent['application/json']
        : {};
      operation.requestBody = {
        ...existingRequestBody,
        required: true,
        content: {
          ...existingContent,
          'application/json': { ...existingJsonContent, schema: endpoint.requestSchema }
        }
      };
    } else if (!existingOperation) {
      delete operation.requestBody;
    }
    operation.responses = updateResponses(existing.responses, endpoint.responseSchema, 'openapi3');
  }

  return operation;
}

function updateResponses(
  existingResponses: unknown,
  responseSchema: unknown,
  format: 'swagger2' | 'openapi3'
): Record<string, unknown> {
  const responses = isRecord(existingResponses) ? { ...existingResponses } : {};
  const successKey = responses['200'] ? '200' : responses['201'] ? '201' : '200';
  const existingSuccess = isRecord(responses[successKey]) ? responses[successKey] : {};

  if (responseSchema === null || responseSchema === undefined) {
    if (!responses[successKey]) {
      responses[successKey] = { description: 'Successful response' };
    }
    return responses;
  }

  if (format === 'swagger2') {
    responses[successKey] = {
      ...existingSuccess,
      description: existingSuccess.description ?? 'Successful response',
      schema: responseSchema
    };
    return responses;
  }

  const existingContent = isRecord(existingSuccess.content) ? existingSuccess.content : {};
  const existingJsonContent = isRecord(existingContent['application/json'])
    ? existingContent['application/json']
    : {};
  responses[successKey] = {
    ...existingSuccess,
    description: existingSuccess.description ?? 'Successful response',
    content: {
      ...existingContent,
      'application/json': { ...existingJsonContent, schema: responseSchema }
    }
  };
  return responses;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function setOptional(
  target: Record<string, unknown>,
  key: string,
  value: string | null | undefined
) {
  if (value) target[key] = value;
  else delete target[key];
}
