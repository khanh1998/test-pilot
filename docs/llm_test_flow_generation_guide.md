# LLM Test Flow Generation Guide for Test-Pilot

This guide provides instructions for Large Language Models (LLMs) like OpenAI GPT or Anthropic Claude to generate valid test flow JSON configurations for the Test-Pilot tool. Test-Pilot is a tool that helps engineers test REST APIs by creating sequences of API calls with proper data dependencies and validations.

## Test Flow Structure Overview

A test flow JSON consists of three main sections:
1. **Steps**: Sequence of API calls to execute
2. **Parameters**: User-configurable values used throughout the flow

```json
{
  "steps": [...],
  "parameters": [...]
}
```

## 1. Steps

Steps are sequential API calls that should be executed in order. Each step can contain one or more endpoints, though typically one endpoint per step is the most common pattern.

```json
"steps": [
  {
    "label": "Human-readable step name",
    "step_id": "step1",
    "endpoints": [...]
  }
]
```

### Endpoint Structure

Each endpoint within a step has the following structure:

```json
{
  "api_id": 1,
  "endpoint_id": 123,
  "headers": [],
  "pathParams": {},
  "queryParams": {},
  "body": {},
  "assertions": [],
  "transformations": []
}
```

- `api_id`: The ID of the API host to use (defined in settings.api_hosts)
- `endpoint_id`: The unique ID of the endpoint from the OpenAPI spec
- `headers`, `pathParams`, `queryParams`, `body`: Request configuration
- `assertions`: Validations to perform on responses
- `transformations`: Data extraction and manipulation from responses

## 2. Template Expressions

Test-Pilot supports several types of template expressions that allow dynamic values, data dependencies, and test data generation. These templates use a `{{source:expression}}` or `{{{source:expression}}}` syntax.

### Parameter References

Use parameters for values that should be configurable by users:

```json
"username": "{{param:admin_username}}",
"password": "{{param:admin_password}}"
```

### Response References

Reference data from previous API responses:

```json
"user_id": "{{res:step1-0.$.user_id}}",
"token": "{{res:step1-0.$.token}}"
```

Format: `{{res:stepId-endpointIndex.jsonPath}}`

### Transformation References

Reference transformed data:

```json
"user_ids": "{{proc:step2-0.$.user_ids}}"
```

Format: `{{proc:stepId-endpointIndex.$.aliasName}}`

### Template Functions

Generate dynamic test data:

```json
"id": "{{func:uuid()}}",
"amount": "{{{func:randomInt(10, 100)}}}",
"dueDate": "{{func:formatDatePattern(yyyy-MM-dd, +7d)}}"
```

Available functions:
- `uuid()` - Generate a UUID
- `randomInt(min, max)` - Generate random integer in range
- `randomString(length, [charset])` - Generate random string
- `timestamp()` - Current Unix timestamp
- `isoDate()` - Current date in ISO format
- `formatDate(format, [offset])` - Format date with optional offset
- `formatDatePattern(pattern, [offset])` - Format date with pattern
- `relativeDate(amount, unit)` - Calculate relative date

## 3. Response Transformations

Transformations extract and manipulate data from responses for use in subsequent steps:

```json
"transformations": [
  {
    "alias": "user_ids",
    "expression": "$.data[*].id"
  },
  {
    "alias": "active_users",
    "expression": "$.data | where($.status == 'active') | map($.id)"
  }
]
```

The transformation engine supports:
- JSONPath expressions (e.g., `$.data[0].id`)
- Functional pipeline operations (e.g., `map`, `filter`, `where`, `count`)
- Logical operations (`&&`, `||`, `!`) and comparisons (`==`, `!=`, `>`, `<`, etc.)

### Common Transformation Patterns

1. **Extract single value**:
   ```
   $.field_name
   ```

2. **Extract array of values**:
   ```
   $.items[*].id
   ```

3. **Count items**:
   ```
   $.items | count()
   ```

4. **Filter and map**:
   ```
   $.users | where($.age > 18) | map($.name)
   ```

## 4. Assertions

Assertions validate response data against expected values:

```json
"assertions": [
  {
    "id": "unique-id-1",
    "data_id": "status_code",
    "enabled": true,
    "operator": "between",
    "data_source": "response",
    "assertion_type": "status_code",
    "expected_value": [200, 299],
    "expected_value_type": "number"
  },
  {
    "id": "unique-id-2",
    "data_id": "$.data.id",
    "enabled": true,
    "operator": "exists",
    "data_source": "response",
    "assertion_type": "json_body",
    "expected_value": null,
    "expected_value_type": "string"
  }
]
```

### Assertion Properties

- `id`: Unique identifier (generate a UUID)
- `data_id`: What to validate (JSONPath for body, "status_code" for status, etc.)
- `enabled`: Whether the assertion is active
- `operator`: Comparison operator (see below)
- `data_source`: "response" or "transformed_data"
- `assertion_type`: "status_code", "response_time", "header", or "json_body"
- `expected_value`: Value to compare against
- `expected_value_type`: Data type of the expected value

### Common Assertion Operators

- Basic: `equals`, `not_equals`, `contains`, `exists`, `greater_than`, `less_than`
- String: `starts_with`, `ends_with`, `matches_regex`, `is_empty`
- Numeric: `greater_than_or_equal`, `less_than_or_equal`, `between`, `not_between`
- Array: `has_length`, `length_greater_than`, `length_less_than`, `contains_all`, `contains_any`
- Type: `is_type`, `is_null`, `is_not_null`

## 5. Parameters

### Parameters
Define user-configurable values:

```json
"parameters": [
  {
    "name": "admin_username",
    "type": "string",
    "value": "admin",
    "required": true,
    "description": "Admin username for login",
    "defaultValue": "admin"
  },
  {
    "name": "limit",
    "type": "number",
    "value": 10,
    "required": true,
    "description": "Page size limit",
    "defaultValue": 10
  }
]
```

Parameter types: `string`, `number`, `boolean`, `object`, `array`

## 6. Best Practices for Flow Generation

1. **Logical Sequencing**: Arrange steps in logical order (authentication → fetch data → create/update → verify)

2. **Dependency Handling**: Use response references (`{{res:step1-0.$.id}}`) to establish dependencies between steps

3. **Validation**: Add assertions to verify expected outcomes:
   - Status code assertions (typically 2xx)
   - Response data assertions (field existence, correct values)
   - Array/collection validations for list endpoints

4. **Parameterization**: Use parameters for credentials, environment-specific values, and test data

5. **Data Generation**: Use template functions for dynamic test data

6. **Data Transformation**: Extract and transform response data for use in subsequent steps

7. **Error Handling**: Add assertions that check for appropriate error responses when testing negative scenarios

## 7. Test Flow Generation Process

When generating a test flow for the user's selected APIs and context:

1. **Analyze the APIs**: Understand the selected endpoints, their purpose, parameters, and responses

2. **Identify Dependencies**: Determine the correct sequence and dependencies between endpoints

3. **Create Basic Flow Structure**: Define steps, and parameters

4. **Add Request Details**: Configure headers, path parameters, query parameters, and request bodies

5. **Define Assertions**: Add appropriate validations for each endpoint response

6. **Add Transformations**: Extract data needed for subsequent steps

7. **Parameterize Values**: Identify values that should be configurable

8. **Generate Test Data**: Use template functions for dynamic data

9. **Review Flow**: Ensure the flow is complete and follows best practices

## 8. Example Test Flow

Here's a simple example of a test flow that:
1. Authenticates a user
2. Gets a list of items
3. Creates a new item
4. Verifies the item was created

```json
{
  "steps": [
    {
      "label": "Login",
      "step_id": "step1",
      "endpoints": [
        {
          "body": {
            "username": "{{param:username}}",
            "password": "{{param:password}}"
          },
          "api_id": 1,
          "headers": [
            {
              "name": "Content-Type",
              "value": "application/json",
              "enabled": true
            }
          ],
          "assertions": [
            {
              "id": "assertion-1",
              "data_id": "status_code",
              "enabled": true,
              "operator": "equals",
              "data_source": "response",
              "assertion_type": "status_code",
              "expected_value": 200,
              "expected_value_type": "number"
            },
            {
              "id": "assertion-2",
              "data_id": "$.token",
              "enabled": true,
              "operator": "exists",
              "data_source": "response",
              "assertion_type": "json_body",
              "expected_value": null,
              "expected_value_type": "string"
            }
          ],
          "pathParams": {},
          "endpoint_id": 101,
          "queryParams": {},
          "transformations": []
        }
      ]
    },
    {
      "label": "Get Items",
      "step_id": "step2",
      "endpoints": [
        {
          "api_id": 1,
          "headers": [
            {
              "name": "Authorization",
              "value": "Bearer {{res:step1-0.$.token}}",
              "enabled": true
            }
          ],
          "assertions": [
            {
              "id": "assertion-3",
              "data_id": "status_code",
              "enabled": true,
              "operator": "equals",
              "data_source": "response",
              "assertion_type": "status_code",
              "expected_value": 200,
              "expected_value_type": "number"
            },
            {
              "id": "assertion-4",
              "data_id": "$.items",
              "enabled": true,
              "operator": "is_type",
              "data_source": "response",
              "assertion_type": "json_body",
              "expected_value": "array",
              "expected_value_type": "string"
            }
          ],
          "pathParams": {},
          "endpoint_id": 102,
          "queryParams": {
            "limit": "{{param:limit}}",
            "page": "1"
          },
          "transformations": [
            {
              "alias": "item_count",
              "expression": "$.items | count()"
            },
            {
              "alias": "item_ids",
              "expression": "$.items | map($.id)"
            }
          ]
        }
      ]
    },
    {
      "label": "Create New Item",
      "step_id": "step3",
      "endpoints": [
        {
          "body": {
            "name": "Test Item {{func:randomString(5)}}",
            "description": "Created by Test-Pilot",
            "price": "{{{func:randomInt(10, 100)}}}",
            "date": "{{func:formatDatePattern(yyyy-MM-dd, null)}}"
          },
          "api_id": 1,
          "headers": [
            {
              "name": "Authorization",
              "value": "Bearer {{res:step1-0.$.token}}",
              "enabled": true
            },
            {
              "name": "Content-Type",
              "value": "application/json",
              "enabled": true
            }
          ],
          "assertions": [
            {
              "id": "assertion-5",
              "data_id": "status_code",
              "enabled": true,
              "operator": "between",
              "data_source": "response",
              "assertion_type": "status_code",
              "expected_value": [200, 201],
              "expected_value_type": "number"
            },
            {
              "id": "assertion-6",
              "data_id": "$.id",
              "enabled": true,
              "operator": "exists",
              "data_source": "response",
              "assertion_type": "json_body",
              "expected_value": null,
              "expected_value_type": "string"
            }
          ],
          "pathParams": {},
          "endpoint_id": 103,
          "queryParams": {},
          "transformations": []
        }
      ]
    },
    {
      "label": "Verify Item Created",
      "step_id": "step4",
      "endpoints": [
        {
          "api_id": 1,
          "headers": [
            {
              "name": "Authorization",
              "value": "Bearer {{res:step1-0.$.token}}",
              "enabled": true
            }
          ],
          "assertions": [
            {
              "id": "assertion-7",
              "data_id": "status_code",
              "enabled": true,
              "operator": "equals",
              "data_source": "response",
              "assertion_type": "status_code",
              "expected_value": 200,
              "expected_value_type": "number"
            },
            {
              "id": "assertion-8",
              "data_id": "$.name",
              "enabled": true,
              "operator": "contains",
              "data_source": "response",
              "assertion_type": "json_body",
              "expected_value": "Test Item",
              "expected_value_type": "string"
            }
          ],
          "pathParams": {
            "id": "{{res:step3-0.$.id}}"
          },
          "endpoint_id": 104,
          "queryParams": {},
          "transformations": []
        }
      ]
    }
  ],
  "parameters": [
    {
      "name": "username",
      "type": "string",
      "value": "testuser",
      "required": true,
      "description": "Username for API authentication",
      "defaultValue": "testuser"
    },
    {
      "name": "password",
      "type": "string",
      "value": "password123",
      "required": true,
      "description": "Password for API authentication",
      "defaultValue": "password123"
    },
    {
      "name": "limit",
      "type": "number",
      "value": 10,
      "required": false,
      "description": "Number of items per page",
      "defaultValue": 10
    }
  ]
}
```

## 9. Prompting Guidelines

When creating test flows based on user input, follow these guidelines:

1. Ask users to select the APIs they want to test
2. Request a brief description of the test scenario
3. Determine the logical flow of API calls
4. Identify required authentication and authorization patterns
5. Create data dependencies between steps
6. Add appropriate validations
7. Generate realistic test data
8. Consider edge cases and error scenarios

Remember that the generated test flow should realistically test the API functionality described by the user in their context.
