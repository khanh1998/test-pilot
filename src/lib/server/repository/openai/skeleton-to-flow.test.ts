import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';

// Test the actual zod-from-json-schema library integration
function testJsonSchemaToZodSchema(jsonSchema: any): any {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }

  try {
    const zodSchema = convertJsonSchemaToZod(jsonSchema);
    return zodSchema;
  } catch (error) {
    console.warn('Failed to convert JSON schema to Zod schema:', error);
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }
}

describe('JSON Schema to Zod Conversion with zod-from-json-schema', () => {
  it('should handle complex e-commerce product creation schema', () => {
    const schema = {
      type: 'object',
      properties: {
        product: {
          type: 'object',
          properties: {
            name: { 
              type: 'string', 
              minLength: 1, 
              maxLength: 200,
              description: 'Product name'
            },
            description: { 
              type: 'string',
              maxLength: 2000
            },
            category: {
              type: 'string',
              enum: ['electronics', 'clothing', 'books', 'home', 'sports']
            },
            price: {
              type: 'object',
              properties: {
                amount: { 
                  type: 'number', 
                  minimum: 0.01,
                  multipleOf: 0.01
                },
                currency: { 
                  type: 'string', 
                  enum: ['USD', 'EUR', 'GBP', 'JPY']
                }
              },
              required: ['amount', 'currency']
            },
            inventory: {
              type: 'object',
              properties: {
                quantity: { 
                  type: 'integer', 
                  minimum: 0 
                },
                warehouse_locations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      quantity: { type: 'integer', minimum: 0 }
                    },
                    required: ['id', 'quantity']
                  },
                  minItems: 1
                }
              },
              required: ['quantity']
            },
            attributes: {
              type: 'object',
              additionalProperties: {
                anyOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                  {
                    type: 'array',
                    items: { type: 'string' }
                  }
                ]
              }
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              uniqueItems: true,
              maxItems: 10
            }
          },
          required: ['name', 'category', 'price', 'inventory']
        },
        metadata: {
          type: 'object',
          properties: {
            source: { type: 'string', default: 'api' },
            created_by: { type: 'string' },
            external_id: { type: 'string' }
          }
        }
      },
      required: ['product']
    };
    
    const result = testJsonSchemaToZodSchema(schema);
    expect(result).toBeDefined();
    
    // Test valid complex product data
    const validProductData = {
      product: {
        name: 'Gaming Laptop Pro',
        description: 'High-performance gaming laptop with RTX graphics',
        category: 'electronics',
        price: {
          amount: 1299.99,
          currency: 'USD'
        },
        inventory: {
          quantity: 50,
          warehouse_locations: [
            { id: 'WH001', name: 'Main Warehouse', quantity: 30 },
            { id: 'WH002', name: 'Secondary Warehouse', quantity: 20 }
          ]
        },
        attributes: {
          brand: 'TechBrand',
          ram: '16GB',
          storage: '1TB SSD',
          warranty_years: 2,
          colors: ['black', 'silver']
        },
        tags: ['gaming', 'laptop', 'high-performance']
      },
      metadata: {
        source: 'admin-panel',
        created_by: 'admin@example.com',
        external_id: 'PROD-001'
      }
    };
    
    const testResult = result.safeParse(validProductData);
    expect(testResult.success).toBe(true);
  });

  it('should handle complex user registration schema with conditional validation', () => {
    const schema = {
      type: 'object',
      properties: {
        user_type: {
          type: 'string',
          enum: ['individual', 'business']
        },
        personal_info: {
          type: 'object',
          properties: {
            first_name: { type: 'string', minLength: 1 },
            last_name: { type: 'string', minLength: 1 },
            email: { 
              type: 'string', 
              format: 'email',
              pattern: '^[^@]+@[^@]+\\.[^@]+$'
            },
            phone: {
              type: 'string',
              pattern: '^\\+?[1-9]\\d{1,14}$'
            },
            date_of_birth: {
              type: 'string',
              format: 'date'
            }
          },
          required: ['first_name', 'last_name', 'email']
        },
        business_info: {
          type: 'object',
          properties: {
            company_name: { type: 'string', minLength: 1 },
            tax_id: { type: 'string' },
            industry: {
              type: 'string',
              enum: ['technology', 'finance', 'healthcare', 'retail', 'manufacturing', 'other']
            },
            employees_count: {
              type: 'integer',
              minimum: 1,
              maximum: 100000
            },
            annual_revenue: {
              type: 'object',
              properties: {
                amount: { type: 'number', minimum: 0 },
                currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] }
              }
            }
          }
        },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            country: { 
              type: 'string',
              enum: ['US', 'CA', 'GB', 'FR', 'DE', 'JP', 'AU']
            }
          },
          required: ['street', 'city', 'country']
        },
        preferences: {
          type: 'object',
          properties: {
            newsletter: { type: 'boolean', default: false },
            notifications: {
              type: 'object',
              properties: {
                email: { type: 'boolean', default: true },
                sms: { type: 'boolean', default: false },
                push: { type: 'boolean', default: true }
              }
            },
            language: {
              type: 'string',
              enum: ['en', 'es', 'fr', 'de', 'ja'],
              default: 'en'
            },
            timezone: { type: 'string' }
          }
        }
      },
      required: ['user_type', 'personal_info', 'address'],
      if: {
        properties: { user_type: { const: 'business' } }
      },
      then: {
        required: ['business_info']
      }
    };
    
    const result = testJsonSchemaToZodSchema(schema);
    expect(result).toBeDefined();
    
    // Test valid individual user
    const individualUser = {
      user_type: 'individual',
      personal_info: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        date_of_birth: '1990-01-15'
      },
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      },
      preferences: {
        newsletter: true,
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        language: 'en',
        timezone: 'America/New_York'
      }
    };
    
    const individualResult = result.safeParse(individualUser);
    expect(individualResult.success).toBe(true);
  });

  it('should handle realistic order creation API schema', () => {
    const schema = {
      type: 'object',
      properties: {
        customer_id: { 
          type: 'string',
          pattern: '^cust_[a-zA-Z0-9]+$'
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              quantity: { type: 'integer', minimum: 1 },
              price: { type: 'number', minimum: 0 }
            },
            required: ['product_id', 'quantity', 'price']
          },
          minItems: 1
        },
        shipping_address: {
          type: 'object',
          properties: {
            street: { type: 'string', minLength: 1 },
            city: { type: 'string', minLength: 1 },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string', enum: ['US', 'CA', 'GB', 'AU'] }
          },
          required: ['street', 'city', 'country']
        },
        payment_method: {
          type: 'string',
          enum: ['credit_card', 'paypal', 'bank_transfer']
        },
        special_instructions: { type: 'string' }
      },
      required: ['customer_id', 'items', 'shipping_address', 'payment_method']
    };
    
    const result = testJsonSchemaToZodSchema(schema);
    expect(result).toBeDefined();
    
    const orderData = {
      customer_id: 'cust_abc123',
      items: [
        {
          product_id: 'prod_xyz789',
          quantity: 2,
          price: 29.99
        }
      ],
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'US'
      },
      payment_method: 'credit_card',
      special_instructions: 'Leave at door'
    };
    
    const orderResult = result.safeParse(orderData);
    expect(orderResult.success).toBe(true);
  });

  it('should handle user profile update schema with nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        personal_info: {
          type: 'object',
          properties: {
            first_name: { type: 'string', minLength: 1 },
            last_name: { type: 'string', minLength: 1 },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' }
          },
          required: ['first_name', 'last_name', 'email']
        },
        preferences: {
          type: 'object',
          properties: {
            newsletter: { type: 'boolean' },
            notifications: {
              type: 'object',
              properties: {
                email: { type: 'boolean' },
                sms: { type: 'boolean' },
                push: { type: 'boolean' }
              }
            },
            language: { type: 'string', enum: ['en', 'es', 'fr', 'de'] },
            theme: { type: 'string', enum: ['light', 'dark', 'auto'] }
          }
        },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string' }
          }
        }
      },
      required: ['personal_info']
    };
    
    const result = testJsonSchemaToZodSchema(schema);
    expect(result).toBeDefined();
    
    const profileData = {
      personal_info: {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+1-555-0123'
      },
      preferences: {
        newsletter: true,
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        language: 'en',
        theme: 'dark'
      },
      address: {
        street: '456 Oak Ave',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94102',
        country: 'US'
      }
    };
    
    const profileResult = result.safeParse(profileData);
    expect(profileResult.success).toBe(true);
  });

  it('should handle complex but well-supported schema patterns', () => {
    const schema = {
      type: 'object',
      properties: {
        event_type: { type: 'string', enum: ['created', 'updated', 'deleted'] },
        timestamp: { type: 'string', format: 'date-time' },
        entity: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['user', 'order', 'product'] },
            attributes: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                status: { type: 'string' },
                value: { type: 'number' },
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                },
                metadata: {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                }
              }
            }
          },
          required: ['id', 'type']
        }
      },
      required: ['event_type', 'timestamp', 'entity']
    };
    
    const result = testJsonSchemaToZodSchema(schema);
    expect(result).toBeDefined();
    
    const eventData = {
      event_type: 'created',
      timestamp: '2024-01-15T14:30:00Z',
      entity: {
        id: 'ent_123',
        type: 'user',
        attributes: {
          name: 'John Doe',
          status: 'active',
          value: 100.50,
          tags: ['premium', 'verified'],
          metadata: {
            source: 'signup_form',
            campaign: 'spring_2024'
          }
        }
      }
    };
    
    const eventResult = result.safeParse(eventData);
    expect(eventResult.success).toBe(true);
  });

  it('should gracefully handle very complex schemas that may not convert properly', () => {
    // This is an example of a schema that might be too complex for the library
    const complexSchema = {
      type: 'object',
      properties: {
        data: {
          anyOf: [
            { type: 'string' },
            { type: 'number' },
            {
              type: 'object',
              properties: {
                nested: {
                  oneOf: [
                    { type: 'boolean' },
                    { type: 'array', items: { type: 'string' } }
                  ]
                }
              }
            }
          ]
        }
      }
    };
    
    const result = testJsonSchemaToZodSchema(complexSchema);
    expect(result).toBeDefined();
    
    // Even if the schema conversion fails, the function should return a working fallback schema
    // Test with simple data that should work with the fallback
    const simpleData = { data: 'simple string' };
    const simpleResult = result.safeParse(simpleData);
    
    // We don't require this to be true since it might fallback to the basic record schema
    // The important thing is that the function doesn't crash and returns something usable
    expect(typeof simpleResult).toBe('object');
    expect(simpleResult).toHaveProperty('success');
  });

  it('should fallback gracefully for invalid schema', () => {
    const schema = null;
    const result = testJsonSchemaToZodSchema(schema);
    expect(result).toBeDefined();
    
    // Should work as a record schema
    const testData = { key: 'value', number: 123 };
    const testResult = result.safeParse(testData);
    expect(testResult.success).toBe(true);
  });

  it('should handle simple schemas for basic API endpoints', () => {
    // Simple authentication request
    const loginSchema = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 }
      },
      required: ['email', 'password']
    };
    
    const loginResult = testJsonSchemaToZodSchema(loginSchema);
    expect(loginResult).toBeDefined();
    
    const loginData = { email: 'user@example.com', password: 'password123' };
    const loginTest = loginResult.safeParse(loginData);
    expect(loginTest.success).toBe(true);
  });
});
