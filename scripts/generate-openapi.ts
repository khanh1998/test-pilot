import { readFileSync, writeFileSync } from 'node:fs';
import SwaggerParser from 'swagger-parser';
import { generateOpenApiDocument } from '../src/lib/schemas/openapi';

// swagger-parser 10's CommonJS type re-export does not expose its static API
// under bundler module resolution (same compatibility issue as server/swagger/parser.ts).
const parser = SwaggerParser as unknown as { validate(document: unknown): Promise<unknown> };

const document = generateOpenApiDocument();
// Validate a separate copy because the parser dereferences/mutates its argument.
await parser.validate(JSON.parse(JSON.stringify(document)));
const output = new URL('../openapi.json', import.meta.url);
const serialized = JSON.stringify(document, null, 2) + '\n';
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(output, 'utf8');
  } catch {
    /* Missing artifact is stale. */
  }
  if (current !== serialized) {
    console.error('openapi.json is missing or stale. Run npm run swagger:generate.');
    process.exitCode = 1;
  } else {
    console.log('OpenAPI specification is valid and up to date.');
  }
} else {
  writeFileSync(output, serialized);
  console.log('Generated and validated openapi.json.');
}
