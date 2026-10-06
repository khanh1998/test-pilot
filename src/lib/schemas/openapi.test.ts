import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import SwaggerParser from 'swagger-parser';
import { generateOpenApiDocument } from './openapi';

// swagger-parser 10's CommonJS type re-export does not expose its static API
// under bundler module resolution (same compatibility issue as server/swagger/parser.ts).
const parser = SwaggerParser as unknown as { validate(document: unknown): Promise<unknown> };

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(directory, entry.name))
      : entry.name === '+server.ts'
        ? [join(directory, entry.name)]
        : []
  );
}

describe('generated REST API contract', () => {
  it('is valid OpenAPI and the checked-in artifact is current', async () => {
    const document = generateOpenApiDocument();
    await expect(parser.validate(JSON.parse(JSON.stringify(document)))).resolves.toBeDefined();
    expect(JSON.parse(readFileSync('openapi.json', 'utf8'))).toEqual(document);
  });

  it('documents every REST route/method with matching path parameters', () => {
    const document = generateOpenApiDocument();
    const actual: string[] = [];
    for (const file of routeFiles('src/routes/api')) {
      const path =
        '/api/' +
        relative('src/routes/api', file)
          .replace(/\/?\+server\.ts$/, '')
          .replace(/\[([^\]]+)\]/g, '{$1}');
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(
        /export (?:async function|const) (GET|POST|PUT|DELETE)\b/g
      )) {
        actual.push(`${match[1].toLowerCase()} ${path}`);
      }
    }
    const documented: string[] = [];
    const operationIds: string[] = [];
    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of ['get', 'post', 'put', 'delete'] as const) {
        const operation = item?.[method];
        if (!operation) continue;
        documented.push(`${method} ${path}`);
        operationIds.push(operation.operationId!);
        const placeholders = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
        const params = operation.parameters?.filter((p) => !('$ref' in p) && p.in === 'path') ?? [];
        expect(params.map((p) => ('name' in p ? p.name : '')).sort()).toEqual(placeholders.sort());
        for (const p of params) expect('required' in p && p.required).toBe(true);
        const publicRoute = path === '/api/auth/sign-in' || path === '/api/auth/sign-up';
        expect(operation.security?.some((s) => 'bearerAuth' in s) ?? false).toBe(!publicRoute);
        const agentAllowed = method === 'post' && path === '/api/test-flows/{id}/runs';
        expect(operation.security?.some((s) => 'agentTokenAuth' in s) ?? false).toBe(agentAllowed);
      }
    }
    expect(documented.sort()).toEqual(actual.sort());
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(document.components?.securitySchemes).not.toHaveProperty('cookieAuth');
  });
});
