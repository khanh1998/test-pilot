# Test-Pilot MCP V2 Design

## Goal

Redesign the MCP around how a backend engineer and a coding assistant actually work together:

- choose the project
- choose the APIs that are in scope
- choose the environment
- inspect existing flows or plan a new one
- build the flow incrementally using business intent, not raw JSON syntax
- validate it
- save it
- run it
- explain the outcome

V2 should feel like a guided flow-building session, not a thin wrapper around internal flow JSON.

## Why V2

The V1 tools proved that the core concept works, but the feedback showed repeated friction:

- agents still need to know too much about Test-Pilot internals
- template and assertion syntax are still a footgun
- project/API/environment selection is too easy to get wrong
- endpoint search is only reliable when the agent already knows the right API
- low-level patch tools are useful, but they are not the best primary interface

The repeated lesson is clear:

The MCP should be opinionated and stateful.

It should narrow choices, surface ambiguity early, generate canonical syntax internally, and return structured guidance instead of expecting the agent to improvise.

## Core Principles

### 1. Session First

The primary object should be a `flow_session`, not a loose document plus many patch calls.

A session stores:

- selected project
- selected API scope
- selected environment
- current flow draft
- unresolved questions
- warnings
- validation status
- explanation summary

### 2. Scope Before Discovery

Before endpoint search or browsing, the assistant must know:

- which project is selected
- which APIs in that project are in scope
- which environment is selected, if any

If a project has multiple APIs or multiple environments and the human did not specify which ones to use, the MCP should return a structured clarification state and the agent should ask the human first.

### 2.5. Codebase First

When the assistant is working inside the backend codebase, it should use that context as a primary signal.

That means reading:

- routes and path definitions
- controllers and handlers
- services and repository calls
- request and response DTOs
- changed files related to the feature

The assistant should use that information to:

- infer the business sequence
- identify likely APIs in scope
- choose better endpoint search terms, tags, and path prefixes
- decide whether an existing flow is still valid

The MCP should reinforce this behavior in tool descriptions and context responses instead of assuming endpoint discovery alone is enough.

### 3. Intent Over Syntax

The assistant should describe what it wants in business terms:

- bind terminal id from step A into query param on step B
- set request field from parameter
- add an assertion that a field is a number

The MCP should generate:

- canonical template expressions
- canonical assertion objects
- canonical environment mappings

### 4. Reviewable Output

Before save or run, the MCP should produce a human-readable review:

- what the flow does
- APIs used
- environment linked
- parameters required
- key bindings
- assertions
- risky spots
- unresolved assumptions

### 5. End-to-End Loop

Flow creation is not the end goal.

The real loop is:

1. understand the feature
2. create or update the flow
3. run the flow
4. explain the result

V2 must include execution and failure explanation as first-class capabilities.

## V2 User Jobs

### Job 1. Reuse Before Rebuild

Given a backend change, find whether an existing flow already covers the changed behavior before building a new one.

### Job 2. Build Safely

Given a project, selected APIs, and environment, create a valid flow without making the agent handcraft raw templates or assertions.

### Job 3. Test Quickly

After saving or updating a flow, run it and get a concise report that helps the engineer decide what to fix next.

## Proposed V2 Tool Groups

## A. Context

### `list_projects`

Purpose:

- list the authenticated user’s projects

### `prepare_flow_context`

Purpose:

- gather everything an agent needs before starting a flow session
- remind the agent to use backend codebase context when available

Input:

```json
{
  "projectId": 12
}
```

Output:

```json
{
  "project": {
    "id": 12,
    "name": "Food Ordering"
  },
  "apis": [
    {
      "id": 27,
      "name": "Consumer API",
      "defaultHost": "https://consumer.example.com"
    }
  ],
  "environments": [
    {
      "id": 4,
      "name": "UAT",
      "subEnvironments": ["default", "staging-a"],
      "variableDefinitions": {
        "CONSUMER_TOKEN": {
          "type": "string",
          "description": "Bearer token"
        }
      },
      "subEnvironmentValues": {
        "default": {
          "variables": {
            "CONSUMER_TOKEN": "..."
          },
          "apiHosts": {
            "27": "https://consumer-uat.example.com"
          }
        }
      }
    }
  ],
  "existingFlows": [],
  "guidance": {
    "needsClarification": true,
    "reasons": ["multiple_apis", "multiple_environments"],
    "notes": [
      "Ask the human which APIs should be in scope.",
      "Ask the human which environment should be linked."
    ]
  }
}
```

This replaces the current split between project context and ad hoc interpretation.

### `list_existing_flows`

Purpose:

- find reusable flows inside the selected project
- optionally filter by selected APIs

## B. Session Setup

### `start_flow_session`

Purpose:

- create an empty, server-side session for one flow-building attempt

Input:

```json
{
  "projectId": 12
}
```

Output:

```json
{
  "sessionId": "sess_123",
  "projectId": 12,
  "status": "awaiting_scope_selection"
}
```

### `select_flow_scope`

Purpose:

- choose the APIs and environment for the flow session

Input:

```json
{
  "sessionId": "sess_123",
  "apiIds": [27],
  "environmentId": 4,
  "subEnvironment": "default"
}
```

Behavior:

- validate that the APIs belong to the project
- validate that the environment belongs to the project
- reject ambiguous sessions that have not been clarified yet

Output:

```json
{
  "sessionId": "sess_123",
  "scope": {
    "projectId": 12,
    "apiIds": [27],
    "environmentId": 4,
    "subEnvironment": "default"
  },
  "status": "ready_for_planning"
}
```

### `get_flow_session`

Purpose:

- recover the current session state at any time

This is the V2 replacement for draft recovery.

## C. Planning

### `suggest_flow_reuse`

Purpose:

- propose whether to reuse, clone, or create a new flow

Input:

```json
{
  "sessionId": "sess_123",
  "intent": "consumer login, load menu, create order, verify order detail"
}
```

Output:

```json
{
  "decision": "create_new",
  "reason": "No existing flow covers create order and order detail together.",
  "candidates": []
}
```

### `plan_flow_from_feature`

Purpose:

- turn feature intent into a proposed test plan before materializing steps

Input:

```json
{
  "sessionId": "sess_123",
  "featureSummary": "Consumer can browse menu and place an order",
  "changedFiles": [
    "src/modules/order/service.ts"
  ]
}
```

Output:

```json
{
  "recommendedSteps": [
    {
      "stepId": "step_login",
      "goal": "Authenticate consumer"
    },
    {
      "stepId": "step_list_terminals",
      "goal": "Load terminals"
    },
    {
      "stepId": "step_create_order",
      "goal": "Create order"
    }
  ],
  "candidateEndpoints": [
    {
      "stepId": "step_create_order",
      "endpointId": 812,
      "apiId": 27,
      "path": "/consumer/orders"
    }
  ],
  "dataDependencies": [
    {
      "from": "step_list_terminals",
      "to": "step_create_order",
      "field": "terminal_id"
    }
  ],
  "openQuestions": []
}
```

### `materialize_plan_into_steps`

Purpose:

- turn the proposed plan into an initial draft flow inside the session

This gives the agent a working skeleton without forcing it to create every nested object manually.

## D. Building

These tools operate on the session draft and should be the main authoring interface.

### `add_step`

Purpose:

- add a new step by choosing one or more endpoints already in session scope

This should be a lighter tool than the V1 version.
The primary use should be to create a step skeleton, not to provide every request field and assertion up front.

### `update_step`

Purpose:

- replace or refine a step definition without re-adding the entire flow

This addresses one of the biggest current editing gaps.

### `bind_step_output`

Purpose:

- bind response data or transformation output from one step into a later request field

Input:

```json
{
  "sessionId": "sess_123",
  "source": {
    "kind": "response",
    "stepId": "step_list_terminals",
    "endpointIndex": 0,
    "jsonPath": "$.data[0].id"
  },
  "target": {
    "stepId": "step_create_order",
    "endpointIndex": 0,
    "fieldType": "body",
    "fieldPath": "terminal_id"
  },
  "preserveType": true
}
```

Output:

```json
{
  "binding": {
    "expression": "{{{res:step_list_terminals-0.$.data[0].id}}}",
    "plainEnglish": "Use the first terminal id from step_list_terminals as the terminal_id in step_create_order."
  }
}
```

This should support nested array paths such as `items[0].menu_item_id`.

### `bind_request_field_to_parameter`

Purpose:

- bind a request field to a flow parameter without making the agent write `{{param:name}}`

### `bind_parameter_to_environment`

Purpose:

- define that a flow parameter should take its value from an environment variable

Example:

```json
{
  "sessionId": "sess_123",
  "parameterName": "consumer_token",
  "environmentVariable": "CONSUMER_TOKEN"
}
```

### `add_parameter`

Purpose:

- add a flow parameter with clean typing and description

### `add_expectation`

Purpose:

- express an assertion in safe, structured language

Input:

```json
{
  "sessionId": "sess_123",
  "stepId": "step_get_balance",
  "endpointIndex": 0,
  "kind": "field_type",
  "target": {
    "source": "response",
    "jsonPath": "$.token_balance"
  },
  "expectedType": "number"
}
```

Output:

```json
{
  "assertion": {
    "id": "assert_token_balance_type",
    "data_source": "response",
    "assertion_type": "json_body",
    "data_id": "$.token_balance",
    "operator": "is_type",
    "expected_value": "number",
    "enabled": true
  },
  "plainEnglish": "Expect $.token_balance in the response body to be a number."
}
```

This replaces free-form operator guessing like `is_number`.

## E. Validation, Review, Save, Run

### `validate_flow_session`

Purpose:

- validate the current session draft

The response should separate:

- blocking errors
- likely mistakes
- informational warnings

It should also return actionable fixes when possible.

### `review_flow_session`

Purpose:

- generate a concise human-readable summary before save or run

Recommended output:

- flow purpose
- selected APIs
- selected environment
- parameter summary
- key step bindings
- assertions
- risk notes

### `save_flow_session`

Purpose:

- persist the validated session draft

Behavior:

- ensure at least one selected API is represented in API Hosts if the current UI/runtime still requires it
- persist project id
- persist environment link
- persist selected APIs as part of the flow metadata when possible
- return review summary with the saved flow

### `run_flow`

Purpose:

- execute the saved flow or session draft

### `get_run_report`

Purpose:

- summarize pass/fail results in backend-engineer language

### `explain_run_failure`

Purpose:

- narrate the failing step, binding, assertion, or host/environment problem in plain English

## Structured Clarification Model

V2 should stop relying on plain error strings as the only signal that something is ambiguous.

When human clarification is needed, the MCP should return structured guidance such as:

```json
{
  "status": "needs_clarification",
  "reason": "multiple_apis",
  "question": "Which APIs should this flow use?",
  "options": [
    { "id": 27, "label": "Consumer API" },
    { "id": 10, "label": "Legacy API" }
  ]
}
```

This makes it obvious to the agent that it must pause and ask the human.

## Recommended Session Workflow

1. `list_projects`
2. `prepare_flow_context(projectId)`
3. If context says clarification is required, ask the human to choose APIs and environment
4. `start_flow_session(projectId)`
5. `select_flow_scope(sessionId, apiIds, environmentId, subEnvironment?)`
6. `suggest_flow_reuse(sessionId, intent)`
7. `plan_flow_from_feature(sessionId, featureSummary, changedFiles?)`
8. `materialize_plan_into_steps(sessionId, plan)`
9. refine with:
   - `add_step`
   - `update_step`
   - `bind_step_output`
   - `add_parameter`
   - `bind_request_field_to_parameter`
   - `bind_parameter_to_environment`
   - `add_expectation`
10. `validate_flow_session(sessionId)`
11. `review_flow_session(sessionId)`
12. `save_flow_session(sessionId)`
13. `run_flow(flowId or sessionId)`
14. `get_run_report(runId)`
15. `explain_run_failure(runId)` if needed

## What Changes From V1

### Keep

These remain useful and can be retained behind the scenes or as advanced tools:

- endpoint details lookup
- project listing
- project context retrieval
- flow explanation logic
- validation logic
- bearer-authenticated server transport

### Wrap

These V1 tools should survive, but mostly as implementation details or advanced escape hatches:

- `add_step`
- `set_body_field`
- `set_query_param`
- `link_step_output`
- `add_assertion`
- `validate_flow`
- `save_flow`

### Retire From Primary Path

These should no longer be the normal experience:

- raw expression crafting as a main workflow
- free-form assertion operators
- requiring agents to pass large nested step documents
- requiring agents to know API scope without session help

## Mapping From Current V1 To V2

### Current V1 tool

`create_flow_draft`

### V2 replacement

`start_flow_session` + `select_flow_scope`

---

### Current V1 tool

`get_project_context`

### V2 replacement

`prepare_flow_context`

---

### Current V1 tool

`search_endpoints` and `browse_endpoints`

### V2 replacement

Keep both ideas, but always scoped by the session or explicit project scope

---

### Current V1 tool

`add_assertion`

### V2 replacement

`add_expectation`

---

### Current V1 tool

`link_environment_to_flow`

### V2 replacement

`bind_parameter_to_environment` plus scope selection

---

### Current V1 tool

`save_flow`

### V2 replacement

`save_flow_session`

## Implementation Plan

### Phase 1. Session and Scope

Build:

- `start_flow_session`
- `select_flow_scope`
- `get_flow_session`
- `prepare_flow_context`

Refactor:

- move draft state into a richer session model
- store selected `apiIds` and environment at the session layer

### Phase 2. Safer Authoring

Build:

- `update_step`
- `bind_request_field_to_parameter`
- `bind_parameter_to_environment`
- `add_expectation`

Refactor:

- keep expression generation internal
- keep assertion normalization internal

### Phase 3. Planning

Build:

- `suggest_flow_reuse`
- `plan_flow_from_feature`
- `materialize_plan_into_steps`

### Phase 4. Execution Loop

Build:

- `run_flow`
- `get_run_report`
- `explain_run_failure`

## Immediate Next Step

If we build this incrementally on top of the current codebase, the first practical slice should be:

1. introduce `flow_session`
2. replace `create_flow_draft` with `start_flow_session` + `select_flow_scope`
3. add `get_flow_session`
4. add `prepare_flow_context`
5. add `add_expectation`

That would remove the biggest sources of ambiguity without requiring a full rewrite in one pass.
