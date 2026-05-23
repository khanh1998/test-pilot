# Environment Integration Guide

Environment values are execution inputs, not template sources inside a test flow.

## Core Rule

Test flows are self-contained components. A flow may reference only:

- `{{param:name}}`
- `{{res:stepId-0.$.field}}`
- `{{proc:stepId-0.$.alias}}`
- `{{func:name(args)}}`

Do not use `{{env:...}}` in flow templates. If a flow needs an environment value, create a primitive flow parameter and map that parameter to an environment variable at execution time.

## Standalone Flow Execution

For a flow that runs by itself:

1. Define primitive parameters such as `api_token`, `tenant_id`, or `base_url`.
2. Use those parameters inside the flow, for example `Authorization: Bearer {{param:api_token}}`.
3. Link the flow to an environment.
4. Map each parameter to the environment variable that should supply it.

Example parameter mapping:

```json
{
  "parameterMappings": {
    "api_token": "API_TOKEN",
    "tenant_id": "TENANT_ID"
  }
}
```

## Sequence Execution

For a flow inside a test sequence, each primitive flow parameter can be supplied from:

- an environment variable
- a previous flow output
- a static primitive value
- a function call such as `uuid()`

Sequence parameter mappings use concrete source types; they do not use template syntax.

```json
{
  "flow_parameter_name": "order_id",
  "source_type": "previous_output",
  "source_flow_step": 1,
  "source_value": "created_order_id"
}
```

## API Hosts

Selected environments can still override API hosts during execution. That host selection is execution configuration and should not be modeled as `{{env:...}}` inside the flow.
