import { json } from '@sveltejs/kit';

const STATUS_BY_CODE: Record<string, number> = {
  INVALID: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  IN_USE: 409
};

/**
 * Turn a typed service error (one carrying a `code`) into a JSON error response.
 * Returns null for anything else so the caller can fall through to its own 500 handling.
 */
export function serviceErrorResponse(error: unknown, extra: Record<string, unknown> = {}) {
  const code = (error as { code?: unknown } | null)?.code;
  if (!(error instanceof Error) || typeof code !== 'string' || !(code in STATUS_BY_CODE)) {
    return null;
  }
  return json({ error: error.message, code, ...extra }, { status: STATUS_BY_CODE[code] });
}
