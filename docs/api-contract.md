# REST API contract

Test-Pilot documents its own REST API in the root `openapi.json` (OpenAPI 3.0). This is separate from the Swagger files users import to describe APIs they want to test. The document covers all routes under `src/routes/api`; the MCP transport is described in [mcp-v1-design.md](mcp-v1-design.md).

## Generate and verify

```sh
npm run swagger:generate
npm run swagger:check
npm run test
```

Generation validates the resulting specification before writing it. `swagger:check` validates it and exits unsuccessfully if the checked-in artifact is missing or differs from the schemas. Neither command needs a database, credentials, or a running application. Generation writes to the repository root even when invoked from another directory.

The test suite checks route/method coverage, path parameters, authentication requirements, unique operation IDs, request compatibility, and selected actual service responses. Regenerate `openapi.json` whenever its schemas change and include the updated artifact with the code change.

## Use the specification

Import `openapi.json` into Test-Pilot, Postman, or an OpenAPI viewer. Set the base URL to your running Test-Pilot instance (for local web development, normally `http://localhost:5173`). The spec's relative `/` server URL is deliberately portable; a file import needs an explicit host. An embedded Swagger UI is not required or included.

1. Call `POST /api/auth/sign-in` with an email and password (or sign up).
2. Use the response's `token` as `Authorization: Bearer <token>` for protected endpoints. In a viewer's bearer authorization field, enter the token alone.
3. Agent tokens also work for `POST /api/test-flows/{id}/runs`. Other REST endpoints, including sequence runs and agent-token management, require the sign-in JWT. MCP authentication is separate.

There is no session-cookie authentication on the REST API. Authentication failures from the SvelteKit hook use `{ "message": "..." }`; route validation typically uses `{ "error": "..." }`. The error schema describes both. The proxy endpoint wraps its own errors with status, headers, body and cookies, but hook-level authentication failures still use the standard error envelope.

## Maintaining schemas

- Define request schemas and register endpoint documentation in `src/lib/schemas/`. Reuse the same schemas in controllers instead of duplicating validation.
- Use `parseJsonRequest` from `src/lib/server/http/parse-json-request.ts` for ordinary JSON requests. It puts malformed JSON on the normal 400 validation path. Run routes additionally support their existing empty-body semantics.
- Keep controllers responsible for parsing and services responsible for business rules and authorization. Response schemas document serialized JSON; dates are strings and database nullable fields must allow null.
- Flow schemas describe steps, parameters, outputs, assertions and settings. Flows preserve extension fields and endpoint snapshots. Older default flows may omit parameters. Loop definitions support nested children and preserve legacy loop configuration fields.
- Arbitrary API payloads, schema documents, template values and execution-state maps intentionally remain open JSON values. They are not restricted to one target API's structure.
- Query validation rejects invalid supplied filters and pagination with 400 instead of dropping the filter or silently substituting defaults. Endpoint search supports repeated `apiIds` query parameters.
- To unlink an environment through the plural compatibility endpoint, use `DELETE /api/projects/{id}/environments?environmentId=...`. The separate environment-mappings endpoint retains its path parameter.

The generated spec is a development artifact, not a runtime response validator. Structural OpenAPI validation alone cannot prove service behavior; add contract/regression tests when changing response shapes or accepted request data.
