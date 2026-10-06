import type { z } from 'zod';

/** Keep malformed JSON on the same 400 response path as schema validation failures. */
export async function parseJsonRequest<T extends z.ZodType>(request: Request, schema: T) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false as const,
      error: { issues: [{ message: 'Request body must be valid JSON' }] }
    };
  }
  return schema.safeParse(body);
}

/** Multipart validation uses the same schema that documents the upload form. */
export async function parseFormRequest<T extends z.ZodType>(request: Request, schema: T) {
  let body: Record<string, FormDataEntryValue>;
  try {
    body = Object.fromEntries(await request.formData());
  } catch {
    return {
      success: false as const,
      error: { issues: [{ message: 'Request body must be valid form data' }] }
    };
  }
  return schema.safeParse(body);
}
