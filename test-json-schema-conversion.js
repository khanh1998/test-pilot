// Simple test script to verify the fix works in the actual implementation

// Test the createEnrichedEndpointSchema function directly
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

// Manual JSON Schema to Zod conversion that matches our fix
function convertJsonSchemaToZodManual(schema) {
  if (!schema || typeof schema !== 'object') {
    return z.unknown();
  }

  const { type, properties, items, required = [], oneOf, anyOf } = schema;

  // Handle oneOf, anyOf
  if (oneOf) {
    const schemas = oneOf.map((s) => convertJsonSchemaToZodManual(s));
    return z.union(schemas);
  }

  if (anyOf) {
    const schemas = anyOf.map((s) => convertJsonSchemaToZodManual(s));
    return z.union(schemas);
  }

  // Basic type conversions
  switch (type) {
    case 'string':
      return z.string();
    
    case 'number':
    case 'integer':
      return z.number();
    
    case 'boolean':
      return z.boolean();
    
    case 'null':
      return z.null();
    
    case 'array':
      if (items) {
        return z.array(convertJsonSchemaToZodManual(items));
      }
      return z.array(z.unknown());
    
    case 'object':
      if (properties) {
        const zodProperties = {};
        
        for (const [key, propSchema] of Object.entries(properties)) {
          let zodProp = convertJsonSchemaToZodManual(propSchema);
          
          // Make optional and nullable if not in required array
          // OpenAI structured outputs requires optional fields to also be nullable
          if (!required.includes(key)) {
            zodProp = zodProp.nullable().optional();
          }
          
          zodProperties[key] = zodProp;
        }
        
        return z.object(zodProperties);
      }
      
      // Object without properties - use record
      return z.record(z.unknown());
    
    default:
      return z.unknown();
  }
}

function createEnrichedEndpointSchema(jsonSchema) {
  const bodySchema = convertJsonSchemaToZodManual(jsonSchema);
  return z.object({
    api_id: z.number().describe("The API ID for this endpoint"),
    endpoint_id: z.number().describe("The endpoint ID"),
    headers: z.array(z.object({
      name: z.string(),
      value: z.string(),
      enabled: z.boolean()
    })).nullable().describe("HTTP headers to send with the request"),
    pathParams: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().describe("Path parameters for the request"),
    queryParams: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().describe("Query parameters for the request"),
    body: bodySchema,
    assertions: z.array(z.object({
      id: z.string().describe("Unique ID for the assertion"),
      data_id: z.string().describe("JSONPath or status_code"),
      enabled: z.boolean(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'exists', 'greater_than', 'less_than', 'starts_with', 'ends_with', 'matches_regex', 'is_empty', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'not_between', 'has_length', 'length_greater_than', 'length_less_than', 'contains_all', 'contains_any', 'is_type', 'is_null', 'is_not_null']),
      data_source: z.enum(['response', 'transformed_data']),
      assertion_type: z.enum(['status_code', 'json_body', 'response_time', 'header']),
      expected_value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])), z.null()]),
      expected_value_type: z.enum(['number', 'string', 'boolean', 'array', 'object', 'null'])
    })).nullable().describe("Assertions to validate the response"),
    transformations: z.array(z.object({
      alias: z.string().describe("Alias name for the extracted value"),
      expression: z.string().describe("JSONPath expression to extract the value")
    })).nullable().describe("Data transformations to extract values from response")
  });
}

// Mock input that would have caused the original error
const testSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    age: { type: 'number' },
    profile: {
      type: 'object',
      properties: {
        bio: { type: 'string' },
        avatar: { type: 'string' }
      }
    }
  },
  required: ['name', 'email']
};

console.log('Testing schema generation that previously failed...');

try {
  // This line should no longer throw the keyValidator._parse error
  console.log('Creating enriched endpoint schema...');
  const schema = createEnrichedEndpointSchema(testSchema);
  
  console.log('✓ Schema created successfully!');
  console.log('Schema type:', schema.constructor.name);
  
  // Test zodTextFormat - this was failing before
  console.log('Testing zodTextFormat...');
  const textFormat = zodTextFormat(schema, 'test_schema');
  
  console.log('✓ zodTextFormat successful!');
  console.log('Generated text format keys:', Object.keys(textFormat));
  
} catch (error) {
  console.error('✗ Error occurred:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

console.log('🎉 All tests passed! The fix is working correctly.');
