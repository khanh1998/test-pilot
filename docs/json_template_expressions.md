# JSON Template Expression Guide

This guide explains how to use template expressions in Test-Pilot to dynamically reference data from various sources within your test flows.

## Table of Contents
- [Basic Syntax](#basic-syntax)
- [Available Sources](#available-sources)
- [Response References](#response-references)
- [Transformation References](#transformation-references)
- [Function References](#function-references)
- [Parameter References](#parameter-references)
- [Template Embedding](#template-embedding)
- [Examples](#examples)

## Basic Syntax

Template expressions use the following syntax:

```
{{source:path}}
```

Where:
- `source` specifies where the data comes from (e.g., a response, transformation, function, or parameter)
- `path` specifies how to locate the data within that source

Template expressions can be used in:
- URL path parameters
- Query parameters
- Request headers
- Request body JSON (within string values)
- Transformation expressions

## Expression Types and JSON Compatibility

### Why Expressions Must Be in String Values

Unlike some templating systems that use custom parsers, Test-Pilot works with standard JSON syntax. This means:

1. **Standard JSON Requirement**: JSON has strict syntax rules that don't allow expressions like `"id": {{res:step1-0.$.user.id}}` - this would be invalid JSON.

2. **Compatibility Approach**: To avoid requiring a custom JSON parser (which would be complex to implement), Test-Pilot requires all expressions to be embedded within valid JSON strings:

```json
{
  "id": "{{res:step1-0.$.user.id}}"
}
```

### Why Two Types of Expressions?

This approach creates a challenge: how do we handle non-string values like numbers, booleans, or arrays? This is why we have two expression formats:

1. **Double Braces (`{{...}}`)**:
   - Used for string values
   - Result is kept as a string: `"id": "{{res:step1-0.$.user.id}}"` → `"id": "5"`

2. **Triple Braces (`{{{...}}}`)**:
   - Used when you need to preserve the original data type
   - Removes the surrounding quotes: `"id": "{{{res:step1-0.$.user.id}}}"` → `"id": 5`
   - Works for numbers, booleans, arrays, and objects

This design balances JSON compatibility with the ability to handle any data type.

## Available Sources

Test-Pilot supports four types of data sources:

| Source | Prefix | Description |
|--------|--------|-------------|
| Response | `res:` | References data from API responses |
| Processed Data | `proc:` | References data from transformations |
| Functions | `func:` | Calls built-in utility functions |
| Parameters | `param:` | References flow parameters |

## Response References

Reference data directly from previous API responses using `res:`.

### Syntax

```
{{res:stepId-endpointIndex.jsonPath}}
```

### Components

- `stepId-endpointIndex`: Identifies the specific endpoint response
  - `stepId`: The ID of the step (e.g., "step1")
  - `endpointIndex`: The index of the endpoint within the step (e.g., "0" for the first endpoint)
- `jsonPath`: A JSONPath expression to extract specific data from the response

### Examples

```
# Reference the entire response body from the first endpoint in step1
{{res:step1-0}}

# Reference a specific property from a JSON response
{{res:step1-0.$.data.id}}

# Reference an item in an array
{{res:step1-0.$.items[0].name}}
```

## Transformation References

Reference data that has been processed through transformations using `proc:`.

### Syntax

```
{{proc:stepId-endpointIndex.$.alias.jsonPath}}
```

### Components

- `stepId-endpointIndex`: Identifies the specific endpoint
- `$`: Required separator for transformation references
- `alias`: The name of the transformation as defined in your test flow
- `jsonPath`: (Optional) A path to extract specific data from the transformed result

### Examples

```
# Reference a transformed value with alias "userData"
{{proc:step1-0.$.userData}}

# Reference a specific property from transformed data
{{proc:step1-0.$.userData.firstName}}
```

## Function References

Call built-in utility functions to generate or manipulate data using `func:`.

### Syntax

```
{{func:functionName(arg1,arg2,...)}}
```

### Available Functions

The Test-Pilot platform includes several utility functions:

- `randomInt(min, max)`: Generates a random integer between min and max
- `randomString(length)`: Generates a random string of specified length
- `timestamp()`: Returns the current timestamp
- `uuid()`: Generates a random UUID
- `jsonPath(object, path)`: Extracts data using JSONPath syntax

### Examples

```
# Generate a random integer between 1 and 100
{{func:randomInt(1,100)}}

# Generate a random string of 10 characters
{{func:randomString(10)}}

# Get the current timestamp
{{func:timestamp()}}

# Generate a UUID
{{func:uuid()}}
```

## Parameter References

Reference flow parameters using `param:`.

### Syntax

```
{{param:parameterName}}
```

### Example

```
# Reference a parameter named "apiKey"
{{param:apiKey}}
```

## Template Embedding

Templates can be embedded in various contexts:

### In String Values

```json
{
  "name": "{{res:step1-0.$.user.name}}"
}
```

### In JSON Objects

```json
{
  "user": {
    "id": "{{res:step1-0.$.user.id}}",
    "name": "{{res:step1-0.$.user.name}}",
    "active": "{{{res:step1-0.$.user.active}}}" // For boolean values
  }
}
```

### Triple-Braces for Preserving Data Types

When you need to insert non-string values like numbers, booleans, objects, or arrays, use the triple-brace syntax:

```json
{
  "userId": "{{{res:step1-0.$.user.id}}}", // Inserts as number: "userId": 5
  "active": "{{{res:step1-0.$.user.active}}}", // Inserts as boolean: "active": true
  "tags": "{{{res:step1-0.$.user.tags}}}" // Inserts as array: "tags": ["admin", "user"]
}
```

When processed, the parser will:
1. First evaluate the expression inside `{{{...}}}`
2. Then remove the surrounding quotes from the JSON string
3. Insert the value with its original data type into the JSON structure

> **Note:** Triple-brace expressions must still be surrounded by quotes in your JSON: `"{{{res:step1-0.$.user.id}}}"`

## Examples

### Chaining Multiple Data Sources

You can use different template expressions in the same request:

```json
{
  "id": "{{res:step1-0.$.id}}",
  "name": "User-{{func:randomString(5)}}",
  "token": "{{param:authToken}}",
  "processedData": "{{proc:step2-0.$.userProfile.details}}"
}
```

### Using Response Data in Path Parameters

```
/api/users/{{res:step1-0.$.userId}}/profile
```

### Using Transformations for Complex Data

```json
{
  "metadata": "{{{proc:step1-0.$.extractedMetadata}}}"
}
```

### Flow Variables in Headers

```
Authorization: Bearer {{param:accessToken}}
```

## Troubleshooting

If a template expression doesn't resolve:

1. Check that the referenced step and endpoint have been executed
2. Verify that the JSONPath expression is correct
3. Ensure transformations are properly configured with the expected alias
4. Check the execution logs for warnings about missing data

Template expressions that can't be resolved will remain unchanged in the output, so you'll see `{{res:step1-0.$.data}}` in the output if the reference is invalid.
