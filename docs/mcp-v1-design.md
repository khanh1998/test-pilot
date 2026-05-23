# Test-Pilot MCP V1 Design

## Goal

Build a first MCP surface that helps a coding assistant:

- find existing reusable test flows
- inspect API endpoints and flow definitions
- create or patch a valid Test-Pilot flow
- run the flow and report the result
- explain templates, transformations, and assertions in plain English

The MCP should preserve Test-Pilot's component model: each flow is self-contained, has primitive inputs and primitive outputs, and can run alone or be composed in a sequence. Environment values and previous flow outputs are supplied to flow parameters by execution/sequence mappings, not by direct templates inside the flow.

The assistant is expected to understand the business sequence from the codebase. The MCP is responsible for Test-Pilot-specific construction, validation, execution, and explanation.

## V1 Tools

### Discovery

#### `search_endpoints`

Purpose: find candidate endpoints for a feature or test plan.

Backed by:

- `src/lib/server/service/api_endpoints/search_endpoints.ts`

Suggested input:

```json
{
  "query": "create order and fetch order detail",
  "apiIds": [1],
  "limit": 10
}
```

Suggested output:

```json
{
  "endpoints": [
    {
      "id": 61,
      "apiId": 1,
      "method": "GET",
      "path": "/orders/{ref_id}",
      "summary": "Get order detail",
      "relevanceScore": 0.82
    }
  ]
}
```

#### `get_endpoint_details`

Purpose: return the request and response shape needed to configure a step.

Backed by:

- `src/lib/server/service/api_endpoints/get_endpoint_details.ts`

#### `list_test_flows`

Purpose: find reusable flows before building a new one.

Backed by:

- `src/lib/server/service/test_flows/list_test_flows.ts`

#### `get_test_flow`

Purpose: load full flow JSON and the endpoint definitions it references.

Backed by:

- `src/lib/server/service/test_flows/get_test_flow.ts`

### Flow Authoring

#### `create_flow_draft`

Purpose: create a draft flow shell with metadata, API hosts, and parameters.

Initial output shape should match the runtime flow model in:

- `src/lib/components/test-flows/types.ts`

#### `add_step`

Purpose: add a flow step with one or more endpoint references and optional initial request values.

#### `link_step_output`

Purpose: create a data binding from a previous step into a later field.

This tool should prefer structured input and generate canonical template syntax rather than letting the assistant write raw strings by hand.

Example input:

```json
{
  "target": {
    "stepId": "step4",
    "endpointIndex": 0,
    "fieldType": "pathParams",
    "fieldName": "ref_id"
  },
  "source": {
    "type": "response",
    "stepEndpointRef": "step3-0",
    "jsonPath": "$.ref_id"
  },
  "preserveType": false
}
```

Example output:

```json
{
  "expression": "{{res:step3-0.$.ref_id}}",
  "explanation": "Gets $.ref_id from the response body of step3-0."
}
```

#### `add_assertion`

Purpose: create a canonical assertion object from structured intent.

### Validation

#### `validate_flow`

Purpose: validate flow structure, endpoint references, template references, transformation syntax, and assertion compatibility.

The response should be educational, not just pass/fail.

Example output:

```json
{
  "valid": false,
  "errors": ["step4 path param ref_id references step5-0, which runs later"],
  "warnings": ["Double-brace expression in body field order_ids will be serialized as string"]
}
```

### Execution

#### `run_test_flow`

Purpose: execute the selected flow with environment and parameter overrides.

Primary execution logic already exists in:

- `src/lib/flow-runner/execution-engine.ts`

#### `get_flow_run_report`

Purpose: summarize execution for a backend engineer.

Recommended output:

- pass/fail summary
- failed step and endpoint
- assertion failures
- extracted outputs
- likely root-cause hints

### Explainability

#### `explain_expression`

Purpose: explain a template, transformation, or assertion in plain English.

Backed by:

- `src/lib/mcp/explain.ts`

Recommended output fields:

```json
{
  "kind": "template",
  "valid": true,
  "summary": "Response reference",
  "plainEnglish": "Gets $.ref_id from the response body of step3-0.",
  "outputType": "string",
  "dependencies": [{ "kind": "response", "reference": "step3-0" }],
  "warnings": []
}
```

#### `explain_flow`

Purpose: narrate a complete flow step-by-step, including:

- business sequence
- step dependencies
- parameters used
- transformations used
- assertions used
- risky or fragile spots

#### `suggest_expression`

Purpose: generate canonical template syntax from structured intent and pair it with a readable explanation.

Backed by:

- `src/lib/mcp/explain.ts`

## Why Explainability Is In V1

Templates, transformations, and assertions are powerful but hard to read:

- template syntax lives in `src/lib/template`
- transformation syntax lives in `src/lib/transform`
- assertion definitions live in `src/lib/assertions`

If the MCP only validates expressions, the assistant will still produce brittle flow edits. V1 should instead help the assistant and the engineer understand exactly what a dynamic reference means.

Valid flow template sources are `param`, `res`, `proc`, and `func`. Direct `env` templates are invalid; use a flow parameter mapped to an environment variable instead.

## Example V1 Assistant Workflow

1. Assistant inspects changed backend code and infers a feature-level sequence.
2. Assistant calls `list_test_flows` to look for reuse.
3. If no good match exists, assistant calls `search_endpoints` and `get_endpoint_details`.
4. Assistant calls `create_flow_draft`.
5. Assistant calls `add_step` for each endpoint in the business sequence.
6. Assistant calls `link_step_output` to connect response ids into later request fields.
7. Assistant calls `add_assertion` for success criteria.
8. Assistant calls `validate_flow`.
9. Assistant calls `run_test_flow`.
10. Assistant calls `get_flow_run_report` and returns a concise engineering summary.

## Current Repo Foundation

These files already provide most of the V1 building blocks:

- `src/lib/server/service/api_endpoints/search_endpoints.ts`
- `src/lib/server/service/api_endpoints/get_endpoint_details.ts`
- `src/lib/server/service/test_flows/list_test_flows.ts`
- `src/lib/server/service/test_flows/get_test_flow.ts`
- `src/lib/template/engine.ts`
- `src/lib/transform/ExpressionParser.ts`
- `src/lib/flow-runner/execution-engine.ts`
- `src/lib/components/test-flows/types.ts`

The remaining work is mostly:

- define MCP transport and tool schemas
- wrap existing services in tool handlers
- add patch-style flow authoring helpers
- expose explainability as first-class tool behavior
