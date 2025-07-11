# 📘 PRD: Test Flow Blueprint Editor (Phase 1)

**Feature Name**: Test Flow Blueprint
**Target User**: Software engineers and QA developers
**Goal**: Allow users to create structured **test flow blueprints** that define how to test a sequence of API endpoints across multiple APIs, without yet executing the flows.

---

## ✅ Objective

Build a **visual and structured blueprint editor** for test flows based on API endpoint definitions already imported via OpenAPI.

The blueprint includes:

- A sequence of **steps**
- Each step contains one or more API **endpoints** to be called concurrently
- Input values configured using various **data sources**
- Final **assertions** to define success conditions

> 🛑 No flow execution logic is handled in this phase.
> ✅ All endpoints must be **referenced**, not cloned or overridden.

---

## 🧩 Data Model Overview

### 🔹 `apis` (existing)

- Contains API metadata (e.g. name, version)

### 🔹 `api_endpoints` (existing)

- Stores parsed OpenAPI endpoint definitions
- Each endpoint has method, path, params, etc.

### 🔹 `test_flows`

- A test flow blueprint scoped to one or more APIs
- Stores the flow metadata and structure

```json
{
  "id": "uuid",
  "name": "User Onboarding Flow",
  "description": "...",
  "api_ids": ["api-1", "api-2"],
  "flow_json": {
    "settings": { "api_host": "https://api.example.com" },
    "steps": [...],
    "assertions": [...]
  }
}
```

---

## 🧪 Test Flow Blueprint Structure

### 1. **Settings**

```json
{
  "api_host": "https://api.example.com" // base URL for API requests
}
```

> **Cookie Handling**: When testing APIs that use cookies for authentication or session management, the "Handle Cookies" option in the execution options panel will route requests through a server-side proxy to maintain cookie state across requests.

---

### 2. **Steps**

- Each step has:
  - `step_id`
  - Optional `label` and `description`
  - A list of **endpoint references**, which run in parallel

```json
{
  "step_id": "step2",
  "label": "Create User",
  "endpoints": [
    {
      "endpoint_id": "uuid-from-api_endpoints",
      "input_params": [...],
      "path_params": [...],
      "headers": [...],
      "store_response_as": "create_user"
    }
  ]
}
```

> Note: `endpoint_id` references `api_endpoints`. **No method/path override is allowed**.

---

### 3. **Input Param Sources**

Each input can be:

- `fixed`: static value
- `response`: extracted from previous step via JSONPath
- `function`: dynamic value (`now()`, `uuid()`, etc.)
- `ai`: AI-generated value (manual entry for now)

```json
{
  "name": "email",
  "source": "response",
  "from": {
    "step_id": "step1",
    "endpoint_id": "login",
    "path": "$.user.email"
  }
}
```

---

### 4. **Assertions**

Define how to check whether the flow is successful:

```json
{
  "step_id": "step3",
  "endpoint_id": "get-user",
  "target_path": "$.email",
  "condition": "equals",
  "expected_value": {
    "source": "response",
    "from": {
      "step_id": "step2",
      "endpoint_id": "create-user",
      "path": "$.email"
    }
  }
}
```

---

## 🖥️ UI Scope

### Flow Editor UI

- Vertical layout: steps arranged top to bottom
- Each step contains a group of endpoint boxes (concurrent)
- Bottom panel or sidebar: endpoint selector (filter/search/tag)
- For each endpoint:
  - Show param schema (if available)
  - Allow user to define `input_params`, `headers`, `path_params`
  - Input source picker: fixed / response / function / ai

- Step preview shows dependencies from previous responses (e.g. arrows or labels)

### Assertions UI

- Visual builder for JSONPath + comparator + value source
- Preview assertions at the end of the flow

---

## ✂️ Out of Scope (Phase 1)

- Actual request execution
- Response rendering
- Flow validation
- Endpoint override or cloning
- Grouping flows or tagging
- LLM-based autofill
- CI/CD integration

---

## 🧭 Summary

| Element         | Description                                         |
| --------------- | --------------------------------------------------- |
| `api_endpoints` | Source of truth for method/path/params              |
| `test_flows`    | Top-level entity representing the blueprint         |
| `steps[]`       | Ordered groups of concurrently executable endpoints |
| `input_params`  | Define how input is resolved                        |
| `assertions[]`  | Define final flow success conditions                |
| `api_host`      | Base URL for all API requests in the flow           |

This blueprint structure serves as the foundation for future execution and analysis.
