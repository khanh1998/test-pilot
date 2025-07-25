import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';

// Mock the function from skeleton-to-flow.ts to test it in isolation
function jsonSchemaToZodSchema(jsonSchema: any) {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    // Fallback to simple record schema
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }

  try {
    // Use the zod-from-json-schema library to convert the schema at runtime
    const zodSchema = convertJsonSchemaToZod(jsonSchema);
    // Type assertion through unknown to ensure compatibility with ZodTypeAny
    return zodSchema;
  } catch (error) {
    console.warn('Failed to convert JSON schema to Zod schema:', error);
    // Fallback to simple record schema
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }
}

function createEnrichedEndpointSchema(jsonSchema: any) {
  const bodySchema = jsonSchemaToZodSchema(jsonSchema) as z.ZodTypeAny;
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

describe('Schema Generation Tests', () => {
  it('should handle null or undefined JSON schema', () => {
    const schema = createEnrichedEndpointSchema(null);
    expect(() => zodTextFormat(schema, "enriched_endpoint")).not.toThrow();
  });

  it('should handle empty object JSON schema', () => {
    const schema = createEnrichedEndpointSchema({});
    expect(() => zodTextFormat(schema, "enriched_endpoint")).not.toThrow();
  });

  it('should handle simple JSON schema', () => {
    const jsonSchema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const }
      },
      required: ['name']
    };
    
    const schema = createEnrichedEndpointSchema(jsonSchema);
    expect(() => zodTextFormat(schema, "enriched_endpoint")).not.toThrow();
  });

  it('should handle complex nested JSON schema', () => {
    const jsonSchema = {
      type: 'object' as const,
      properties: {
        user: {
          type: 'object' as const,
          properties: {
            profile: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                settings: {
                  type: 'array' as const,
                  items: { type: 'string' as const }
                }
              }
            }
          }
        }
      }
    };
    
    const schema = createEnrichedEndpointSchema(jsonSchema);
    expect(() => zodTextFormat(schema, "enriched_endpoint")).not.toThrow();
  });

  it('should test convertJsonSchemaToZod compatibility with zodTextFormat', () => {
    const jsonSchema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
        age: { type: 'number' as const }
      }
    };

    // Test the converted schema directly
    const convertedSchema = convertJsonSchemaToZod(jsonSchema);
    
    // Create a simple schema that uses the converted schema
    const testSchema = z.object({
      body: convertedSchema as unknown as z.ZodTypeAny
    });

    // This should not throw
    expect(() => zodTextFormat(testSchema, "test_schema")).not.toThrow();
  });

  it('should test the actual problematic schema structure', () => {
    // This mimics the exact structure that's causing the issue
    const problemJsonSchema = {
      type: 'object' as const,
      properties: {
        id: { type: 'number' as const },
        name: { type: 'string' as const },
        items: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              itemId: { type: 'string' as const },
              quantity: { type: 'number' as const }
            }
          }
        }
      },
      required: ['name']
    };

    // This is the exact call that's failing
    const enrichedEndpointSchema = createEnrichedEndpointSchema(problemJsonSchema);
    
    // This should reproduce the error
    expect(() => {
      const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
      console.log('Schema generated successfully:', !!expectedSchema);
    }).toThrow();
  });
});
