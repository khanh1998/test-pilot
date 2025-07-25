import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

// Manual JSON Schema to Zod conversion for better compatibility
function convertJsonSchemaToZodManual(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.unknown();
  }

  const { type, properties, items, required = [], oneOf, anyOf, allOf, enum: enumValues } = schema;

  // Handle allOf - merge all schemas (simplified approach)
  if (allOf && Array.isArray(allOf)) {
    // For allOf, we merge the schemas by combining their properties
    let mergedSchema: any = { type: 'object', properties: {}, required: [] };
    
    for (const subSchema of allOf) {
      if (subSchema.type === 'object' && subSchema.properties) {
        mergedSchema.properties = { ...mergedSchema.properties, ...subSchema.properties };
      }
      if (subSchema.required && Array.isArray(subSchema.required)) {
        mergedSchema.required = [...mergedSchema.required, ...subSchema.required];
      }
      if (subSchema.type && !mergedSchema.type) {
        mergedSchema.type = subSchema.type;
      }
    }
    
    return convertJsonSchemaToZodManual(mergedSchema);
  }

  // Handle oneOf, anyOf
  if (oneOf) {
    const schemas = oneOf.map((s: any) => convertJsonSchemaToZodManual(s));
    return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (anyOf) {
    const schemas = anyOf.map((s: any) => convertJsonSchemaToZodManual(s));
    return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  // Handle enum values
  if (enumValues && Array.isArray(enumValues)) {
    // For string enums
    if (type === 'string') {
      return z.enum(enumValues as [string, ...string[]]);
    }
    // For number/integer enums, use literal values
    if (type === 'number' || type === 'integer') {
      const literals = enumValues.map(val => z.literal(val));
      if (literals.length === 1) {
        return literals[0];
      }
      return z.union(literals as [z.ZodLiteral<any>, z.ZodLiteral<any>, ...z.ZodLiteral<any>[]]);
    }
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
        const zodProperties: Record<string, z.ZodTypeAny> = {};
        
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

// Mock the function from skeleton-to-flow.ts to test it in isolation
function jsonSchemaToZodSchema(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    // Fallback to simple record schema
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }

  try {
    // Manual conversion for common JSON Schema patterns to ensure full Zod compatibility
    return convertJsonSchemaToZodManual(jsonSchema);
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
    const convertedSchema = convertJsonSchemaToZodManual(jsonSchema);
    
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
    
    // Test that the schema is generated without throwing
    expect(() => {
      const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
      console.log('Schema generated successfully:', !!expectedSchema);
    }).not.toThrow();
  });

  it('should test with a more complex schema that might cause the error', () => {
    // Test with a more complex schema that includes nested objects and arrays
    const complexJsonSchema = {
      type: 'object' as const,
      properties: {
        user: {
          type: 'object' as const,
          properties: {
            id: { type: 'number' as const },
            profile: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                email: { type: 'string' as const },
                preferences: {
                  type: 'object' as const,
                  properties: {
                    theme: { type: 'string' as const },
                    notifications: {
                      type: 'array' as const,
                      items: {
                        type: 'object' as const,
                        properties: {
                          type: { type: 'string' as const },
                          enabled: { type: 'boolean' as const }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        metadata: {
          type: 'object' as const,
          additionalProperties: true
        }
      },
      required: ['user']
    };

    const enrichedEndpointSchema = createEnrichedEndpointSchema(complexJsonSchema);
    
    expect(() => {
      const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
      console.log('Complex schema generated successfully:', !!expectedSchema);
    }).not.toThrow();
  });

  it('should test with schema that has circular references or problematic structures', () => {
    // Test with a schema that might cause issues with the zod conversion
    const problematicSchema = {
      type: 'object' as const,
      properties: {
        data: {
          oneOf: [
            { type: 'string' as const },
            { type: 'number' as const },
            {
              type: 'object' as const,
              properties: {
                nested: {
                  type: 'array' as const,
                  items: {
                    anyOf: [
                      { type: 'string' as const },
                      { type: 'number' as const }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    };

    const enrichedEndpointSchema = createEnrichedEndpointSchema(problematicSchema);
    
    expect(() => {
      const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
      console.log('Problematic schema generated successfully:', !!expectedSchema);
    }).not.toThrow();
  });

  it('should test what happens when convertJsonSchemaToZod returns incompatible schema', () => {
    // This test checks if the issue is with the convertJsonSchemaToZod function itself
    const jsonSchema = {
      type: 'object' as const,
      properties: {
        test: { type: 'string' as const }
      }
    };

    const convertedSchema = convertJsonSchemaToZodManual(jsonSchema);
    console.log('Converted schema type:', typeof convertedSchema);
    console.log('Converted schema constructor:', convertedSchema.constructor.name);
    console.log('Has _parse method:', typeof (convertedSchema as any)._parse);

    // Test if the converted schema can be used directly with zodTextFormat
    expect(() => {
      const testSchema = z.object({
        testField: convertedSchema as unknown as z.ZodTypeAny
      });
      zodTextFormat(testSchema, "test_schema");
    }).not.toThrow();
  });

  it('should fix the original keyValidator._parse error', () => {
    // This test specifically reproduces the original error scenario
    // and verifies that our fix resolves it
    
    const realWorldJsonSchema = {
      type: 'object' as const,
      properties: {
        userId: { type: 'number' as const },
        profile: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            email: { type: 'string' as const },
            age: { type: 'number' as const },
            settings: {
              type: 'object' as const,
              properties: {
                theme: { type: 'string' as const },
                notifications: { type: 'boolean' as const }
              }
            }
          }
        },
        tags: {
          type: 'array' as const,
          items: { type: 'string' as const }
        }
      },
      required: ['userId', 'profile'] // Note: some fields are optional
    };

    // This was the exact line that was failing before our fix
    const enrichedEndpointSchema = createEnrichedEndpointSchema(realWorldJsonSchema);
    
    expect(() => {
      const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
      console.log('Real-world schema generated successfully:', !!expectedSchema);
    }).not.toThrow();
  });

  it('should handle the complex sample schema from the user', () => {
    // Test with the actual complex schema provided by the user
    const sampleSchema = {
      type: 'object' as const,
      required: [
        'currency_id',
        'invoices',
        'organization_id'
      ],
      properties: {
        submit: {
          type: 'boolean' as const
        },
        invoices: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            required: [
              'amount',
              'attachment',
              'bill_from',
              'bill_to',
              'invoice_date',
              'invoice_number',
              'request_amount',
              'type_id'
            ],
            properties: {
              amount: {
                type: 'number' as const
              },
              remark: {
                type: 'string' as const
              },
              bill_to: {
                type: 'string' as const
              },
              type_id: {
                enum: [1, 1],
                type: 'integer' as const,
                'x-enum-varnames': [
                  'AdminUserID',
                  'AdminRoleID'
                ]
              },
              class_id: {
                enum: [1, 1],
                type: 'integer' as const,
                'x-enum-varnames': [
                  'AdminUserID',
                  'AdminRoleID'
                ]
              },
              due_date: {
                type: 'string' as const
              },
              bill_from: {
                type: 'string' as const
              },
              attachment: {
                type: 'string' as const
              },
              settlor_id: {
                enum: [1, 1],
                type: 'integer' as const,
                'x-enum-varnames': [
                  'AdminUserID',
                  'AdminRoleID'
                ]
              },
              description: {
                type: 'string' as const
              },
              location_id: {
                enum: [1, 1],
                type: 'integer' as const,
                'x-enum-varnames': [
                  'AdminUserID',
                  'AdminRoleID'
                ]
              },
              invoice_date: {
                type: 'string' as const
              },
              department_id: {
                enum: [1, 1],
                type: 'integer' as const,
                'x-enum-varnames': [
                  'AdminUserID',
                  'AdminRoleID'
                ]
              },
              invoice_number: {
                type: 'string' as const
              },
              request_amount: {
                type: 'number' as const
              },
              shareholder_id: {
                enum: [1, 1],
                type: 'integer' as const,
                'x-enum-varnames': [
                  'AdminUserID',
                  'AdminRoleID'
                ]
              },
              attachment_hash: {
                type: 'string' as const
              }
            }
          },
          minItems: 1
        },
        priority: {
          type: 'integer' as const,
          maximum: 10,
          minimum: 0
        },
        recurring: {
          allOf: [
            {
              type: 'object' as const,
              properties: {
                type: {
                  enum: ['monthly'],
                  allOf: [
                    {
                      enum: [
                        'daily',
                        'weekly',
                        'monthly',
                        'yearly'
                      ],
                      type: 'string' as const,
                      'x-enum-varnames': [
                        'RecurringIntervalTypeDaily',
                        'RecurringIntervalTypeWeekly',
                        'RecurringIntervalTypeMonthly',
                        'RecurringIntervalTypeYearly'
                      ]
                    }
                  ]
                },
                value: {
                  type: 'integer' as const,
                  minimum: 0
                }
              }
            }
          ],
          description: 'Recurring payment configuration fields'
        },
        currency_id: {
          enum: [1, 1],
          type: 'integer' as const,
          'x-enum-varnames': [
            'AdminUserID',
            'AdminRoleID'
          ]
        },
        description: {
          type: 'string' as const
        },
        organization_id: {
          enum: [1, 1],
          type: 'integer' as const,
          'x-enum-varnames': [
            'AdminUserID',
            'AdminRoleID'
          ]
        },
        approver_user_ids: {
          type: 'array' as const,
          items: {
            enum: [1, 1],
            type: 'integer' as const,
            'x-enum-varnames': [
              'AdminUserID',
              'AdminRoleID'
            ]
          }
        }
      }
    };

    console.log('Testing complex sample schema...');

    // This should handle the complex schema without throwing errors
    const enrichedEndpointSchema = createEnrichedEndpointSchema(sampleSchema);
    
    expect(() => {
      const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
      console.log('Complex sample schema generated successfully:', !!expectedSchema);
      console.log('Schema contains body field:', expectedSchema && typeof expectedSchema === 'object');
    }).not.toThrow();
  });
});
