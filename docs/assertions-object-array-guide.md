# Object and Array Assertions - User Guide

This guide demonstrates how to use object and array expected values in the Test-Pilot assertion system.

## Quick Reference

### ⚠️ Important Limitations

- The `equals` operator uses **reference equality** for objects and arrays, not deep equality
- Template expressions create new object/array instances, making direct comparison unreliable
- **Recommended approach**: Use individual field validation for objects and specialized operators for arrays

### Object Validation Patterns

```javascript
// ❌ Avoid: Direct object comparison (will likely fail)
{
  operator: 'equals',
  expected_value: { id: 123, name: 'John' }
}

// ✅ Better: Validate individual properties
{
  data_id: '$.user.id',
  operator: 'equals', 
  expected_value: 123
}

// ✅ Best: Use templates for individual properties
{
  data_id: '$.user.name',
  operator: 'equals',
  expected_value: '{{res:step1.$.user.name}}',
  is_template_expression: true
}
```

### Array Validation Patterns

```javascript
// ❌ Avoid: Direct array comparison with equals
{
  operator: 'equals',
  expected_value: ['item1', 'item2', 'item3']
}

// ✅ Better: Use specialized array operators
{
  operator: 'has_length',
  expected_value: 3
}

{
  operator: 'contains_all', 
  expected_value: ['javascript', 'typescript']
}

{
  operator: 'one_of',
  expected_value: ['pending', 'approved', 'rejected']
}
```

### Template Expression Best Practices

```javascript
// ✅ Works well: Primitive values
{
  data_id: '$.status',
  operator: 'equals',
  expected_value: '{{res:step1.$.user.status}}', // Returns string/number/boolean
  is_template_expression: true
}

// ✅ Works well: Array operations
{
  data_id: '$.tags',
  operator: 'contains_all',
  expected_value: '{{param:requiredTags}}', // Array used for contains_all
  is_template_expression: true
}

// ⚠️ Problematic: Direct object/array comparison
{
  operator: 'equals',
  expected_value: '{{res:step1.$.user}}', // Object reference will be different
  is_template_expression: true
}
```

## Recommended Operators by Data Type

### Objects
- `is_type: 'object'` - Validate it's an object
- `is_empty` / `is_not_empty` - Check if object has properties
- `exists` - Check if object exists
- Individual field validation using JSONPath

### Arrays
- `has_length: N` - Exact length check
- `length_greater_than: N` / `length_less_than: N` - Size validation
- `contains_all: [...]` - Check array contains all specified items
- `contains_any: [...]` - Check array contains at least one specified item
- `one_of: [...]` - Check value is one of the specified options
- `is_type: 'array'` - Validate it's an array
- `is_empty` / `is_not_empty` - Check if array has items

### Primitive Values (with templates)
- `equals` - Exact value comparison
- `contains` - Substring/item check
- `starts_with` / `ends_with` - String prefix/suffix
- `greater_than` / `less_than` - Numeric comparison
- `between: [min, max]` - Range validation

## Common Validation Patterns

### User Object Validation
```javascript
// Check user exists and has required fields
{ data_id: '$.user', operator: 'exists' }
{ data_id: '$.user.id', operator: 'is_type', expected_value: 'number' }
{ data_id: '$.user.name', operator: 'is_type', expected_value: 'string' }
{ data_id: '$.user.email', operator: 'contains', expected_value: '@' }
```

### Array Response Validation
```javascript
// Validate response array
{ data_id: '$.results', operator: 'is_type', expected_value: 'array' }
{ data_id: '$.results', operator: 'length_greater_than', expected_value: 0 }
{ data_id: '$.results[0].id', operator: 'is_type', expected_value: 'number' }
```

### Permission/Role Validation
```javascript
// Check user has required roles
{ data_id: '$.user.roles', operator: 'contains_all', expected_value: ['user'] }
{ data_id: '$.user.roles', operator: 'not_contains_any', expected_value: ['banned', 'suspended'] }
```

### Pagination Validation
```javascript
// Validate pagination consistency
{ data_id: '$.pagination.total', operator: 'between', expected_value: [1, 1000] }
{ data_id: '$.items', operator: 'has_length', expected_value: '{{res:step1.$.pagination.total}}', is_template_expression: true }
```

## For Complete Examples

See `src/lib/assertions/object-array-examples.test.ts` for comprehensive examples of all patterns and use cases.
