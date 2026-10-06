import { describe, expect, it } from 'vitest';
import { parseFormRequest } from './parse-json-request';
import { SwaggerUploadForm } from '$lib/schemas/swagger';

describe('Swagger multipart request validation', () => {
  it('accepts a file and validates metadata using the documented form schema', async () => {
    const form = new FormData();
    form.set('name', 'My API');
    form.set('projectId', '3');
    form.set('swaggerFile', new Blob(['{"openapi":"3.0.0"}']), 'api.json');
    const result = await parseFormRequest(
      new Request('http://localhost/upload', { method: 'POST', body: form }),
      SwaggerUploadForm
    );
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data).toMatchObject({
        name: 'My API',
        projectId: 3,
        host: '',
        description: ''
      });
  });
  it('rejects a text field masquerading as a file', async () => {
    const form = new FormData();
    form.set('name', 'My API');
    form.set('swaggerFile', 'not a file');
    const result = await parseFormRequest(
      new Request('http://localhost/upload', { method: 'POST', body: form }),
      SwaggerUploadForm
    );
    expect(result.success).toBe(false);
  });
  it('rejects malformed multipart bodies', async () => {
    const result = await parseFormRequest(
      new Request('http://localhost/upload', { method: 'POST', body: 'bad' }),
      SwaggerUploadForm
    );
    expect(result.success).toBe(false);
  });
});
