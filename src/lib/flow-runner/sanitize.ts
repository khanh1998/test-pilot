import type { ExecutionState } from '$lib/components/test-flows/types';

const REDACTED_VALUE = '[redacted]';
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization'
]);

type JsonRecord = Record<string, unknown>;

export function sanitizeExecutionState(executionState: ExecutionState): ExecutionState {
  return sanitizeValue(executionState, { parentKey: 'executionState' }) as ExecutionState;
}

export function sanitizeValue(
  value: unknown,
  context: { parentKey?: string; key?: string } = {}
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, context));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: JsonRecord = {};
  for (const [key, childValue] of Object.entries(value)) {
    const isHeadersObject = key === 'headers' && isPlainObject(childValue);
    if (isHeadersObject) {
      sanitized[key] = sanitizeHeaders(childValue as Record<string, unknown>);
    } else if (isSensitiveHeaderName(context.parentKey, key)) {
      sanitized[key] = REDACTED_VALUE;
    } else {
      sanitized[key] = sanitizeValue(childValue, { parentKey: key, key });
    }
  }

  return sanitized;
}

export function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitizedHeaders: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    sanitizedHeaders[name] = isSensitiveHeaderName('headers', name) ? REDACTED_VALUE : value;
  }

  return sanitizedHeaders;
}

function isSensitiveHeaderName(parentKey: string | undefined, key: string): boolean {
  return parentKey === 'headers' && SENSITIVE_HEADER_NAMES.has(key.toLowerCase());
}

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
