# JSON Template Expressions in Assertions

This document demonstrates how to use JSON template expressions in assertion expected values to create dynamic, flexible test flows.

## Overview

With template expression support, assertion expected values can now reference:
- Response data from previous steps
- Transformed data
- Flow parameters
- Built-in utility functions

This enables powerful dynamic comparisons between different parts of your API flow.

## Template Expression Syntax

### Double Braces `{{}}` - String Values
Converts the result to a string:
```json
{
  "expected_value": "{{res:step1-0.$.data.userId}}",
  "is_template_expression": true
}
```

### Triple Braces `{{{}}}` - Preserve Data Types
Preserves the original data type (number, boolean, object, array):
```json
{
  "expected_value": "{{{res:step1-0.$.user.isActive}}}",
  "is_template_expression": true
}
```

## Data Sources

### Response Data (`res:`)
Reference data from API responses:
```
{{res:stepId-endpointIndex.$.jsonPath}}
```

Examples:
- `{{res:step1-0.$.data.id}}` - Get user ID from first endpoint in step 1
- `{{res:step2-1.$.items[0].name}}` - Get name from first item in array
- `{{res:step1-0}}` - Get entire response body

### Transformed Data (`proc:`)
Reference data from transformations:
```
{{proc:stepId-endpointIndex.$.alias.jsonPath}}
```

Examples:
- `{{proc:step1-0.$.userData.firstName}}` - Get transformed user data
- `{{{proc:step2-0.$.calculations.total}}}` - Get numeric calculation result

### Parameters (`param:`)
Reference flow parameters:
```
{{param:parameterName}}
```

Examples:
- `{{param:apiKey}}` - Get API key parameter
- `{{{param:maxRetries}}}` - Get retry count as number

### Functions (`func:`)
Call utility functions:
```
{{func:functionName(arg1,arg2)}}
```

Available functions:
- `{{func:randomInt(1,100)}}` - Random integer between 1-100
- `{{func:randomString(10)}}` - Random 10-character string
- `{{func:timestamp()}}` - Current timestamp
- `{{func:uuid()}}` - Random UUID

## Real-World Examples

### Example 1: Cross-Step Validation
Validate that user ID remains consistent across different API calls:

**Step 1**: Create user
```json
{
  "id": "create-user",
  "data_id": "$.data.userId",
  "operator": "exists",
  "data_source": "response",
  "assertion_type": "json_body",
  "expected_value": null,
  "is_template_expression": false
}
```

**Step 2**: Get user details - validate same user ID
```json
{
  "id": "validate-same-user",
  "data_id": "$.user.id",
  "operator": "equals",
  "data_source": "response", 
  "assertion_type": "json_body",
  "expected_value": "{{res:step1-0.$.data.userId}}",
  "is_template_expression": true
}
```

### Example 2: Dynamic Range Validation
Validate response count matches transformed calculation:

```json
{
  "id": "validate-count",
  "data_id": "$.meta.totalItems",
  "operator": "equals",
  "data_source": "response",
  "assertion_type": "json_body", 
  "expected_value": "{{{proc:step1-0.$.countCalculation.total}}}",
  "is_template_expression": true
}
```

### Example 3: Parameter-Based Validation
Use flow parameters for dynamic thresholds:

```json
{
  "id": "validate-threshold",
  "data_id": "$.performance.responseTime",
  "operator": "less_than",
  "data_source": "response",
  "assertion_type": "json_body",
  "expected_value": "{{{param:maxResponseTime}}}",
  "is_template_expression": true
}
```

### Example 4: Complex String Composition
Build complex expected values from multiple sources:

```json
{
  "id": "validate-message",
  "data_id": "$.notification.message",
  "operator": "equals", 
  "data_source": "response",
  "assertion_type": "json_body",
  "expected_value": "User {{res:step1-0.$.user.name}} completed {{res:step2-0.$.task.type}} task",
  "is_template_expression": true
}
```

### Example 5: Boolean Type Preservation
Validate boolean values without string conversion:

```json
{
  "id": "validate-status",
  "data_id": "$.user.isActive", 
  "operator": "equals",
  "data_source": "response",
  "assertion_type": "json_body",
  "expected_value": "{{{res:step1-0.$.settings.enableUser}}}",
  "is_template_expression": true
}
```

## Error Handling

Template expressions include comprehensive error handling:

1. **Syntax Errors**: Invalid template syntax is caught during validation
2. **Missing Data**: Clear error messages when referenced data doesn't exist
3. **Type Mismatches**: Graceful handling of unexpected data types
4. **Resolution Failures**: Detailed error messages for debugging

## UI Features

The AssertionEditor includes:

- **Template Toggle**: Checkbox to enable/disable template expressions
- **Syntax Helper**: Examples and documentation built into the UI
- **Visual Indicators**: Template expressions are highlighted differently
- **Type Selection**: When not using templates, explicit type selection for JSON body assertions
- **Real-time Validation**: Immediate feedback on template syntax

## Best Practices

1. **Use Triple Braces for Non-String Values**: `{{{...}}}` preserves data types
2. **Validate Template Syntax**: Test expressions before running flows
3. **Handle Missing Data**: Consider what happens if referenced data doesn't exist
4. **Document Complex Templates**: Use clear, descriptive assertion IDs
5. **Test Template Resolution**: Verify templates resolve to expected values

## Migration from Fixed Values

Existing assertions work unchanged. To migrate:

1. Check "Use Template" checkbox
2. Replace fixed value with template expression
3. Use appropriate brace syntax for data type
4. Test the assertion in your flow

Template expressions make Test-Pilot assertions incredibly flexible, enabling sophisticated test scenarios that were previously impossible with fixed expected values.
