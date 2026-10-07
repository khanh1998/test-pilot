import { uploadSwagger } from './upload_swagger';

interface CreateBlankApiParams {
  name: string;
  description?: string;
  host?: string;
  userId: number;
  projectId?: number;
}

/**
 * Create an API without an uploaded spec, so endpoints can be added by hand.
 * The API starts with a minimal OpenAPI document that endpoint management extends.
 */
export async function createBlankApi(params: CreateBlankApiParams) {
  const { name, description, host, userId, projectId } = params;

  const document = {
    openapi: '3.0.3',
    info: { title: name, version: '1.0.0', ...(description ? { description } : {}) },
    paths: {}
  };

  return uploadSwagger({
    name,
    description,
    content: JSON.stringify(document, null, 2),
    format: 'json',
    userProvidedHost: host,
    userId,
    projectId
  });
}
