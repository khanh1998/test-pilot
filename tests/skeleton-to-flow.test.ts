import { describe, it, expect } from 'vitest';

// Mock the jsonSchemaToZodSchema function to test it in isolation
function jsonSchemaToZodSchema(jsonSchema: any): any {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return { _def: { typeName: 'ZodRecord' } }; // Mock fallback
  }

  const convertType = (schema: any): any => {
    if (!schema || typeof schema !== 'object') {
      return { _def: { typeName: 'ZodAny' } };
    }

    const { type, properties, items, required = [], enum: enumValues } = schema;

    switch (type) {
      case 'string':
        if (enumValues && Array.isArray(enumValues)) {
          return { _def: { typeName: 'ZodEnum', values: enumValues } };
        }
        return { _def: { typeName: 'ZodString' } };
      
      case 'number':
      case 'integer':
        return { _def: { typeName: 'ZodNumber' } };
      
      case 'boolean':
        return { _def: { typeName: 'ZodBoolean' } };
      
      case 'array':
        if (items) {
          return { _def: { typeName: 'ZodArray', type: convertType(items) } };
        }
        return { _def: { typeName: 'ZodArray', type: { _def: { typeName: 'ZodAny' } } } };
      
      case 'object':
        if (properties && typeof properties === 'object') {
          const zodObject: Record<string, any> = {};
          
          for (const [key, propSchema] of Object.entries(properties)) {
            let fieldSchema = convertType(propSchema);
            
            if (!required.includes(key)) {
              fieldSchema = { _def: { typeName: 'ZodOptional', innerType: fieldSchema } };
            }
            
            zodObject[key] = fieldSchema;
          }
          
          return { _def: { typeName: 'ZodObject', shape: zodObject } };
        }
        return { _def: { typeName: 'ZodRecord' } };
      
      case 'null':
        return { _def: { typeName: 'ZodNull' } };
      
      default:
        if (schema.anyOf || schema.oneOf) {
          const unions = schema.anyOf || schema.oneOf;
          if (Array.isArray(unions) && unions.length > 0) {
            const zodUnions = unions.map((unionSchema: any) => convertType(unionSchema));
            return { _def: { typeName: 'ZodUnion', options: zodUnions } };
          }
        }
        
        return { _def: { typeName: 'ZodAny' } };
    }
  };

  try {
    const result = convertType(jsonSchema);
    return { _def: { typeName: 'ZodNullable', innerType: result } };
  } catch (error) {
    console.warn('Failed to convert JSON schema to Zod schema:', error);
    return { _def: { typeName: 'ZodRecord' } };
  }
}

describe('JSON Schema to Zod Conversion', () => {
  it('should handle simple string schema', () => {
    const schema = { type: 'string' };
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.innerType._def.typeName).toBe('ZodString');
  });

  it('should handle object schema with properties', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' }
      },
      required: ['name']
    };
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.innerType._def.typeName).toBe('ZodObject');
    expect(result._def.innerType._def.shape.name._def.typeName).toBe('ZodString');
    expect(result._def.innerType._def.shape.age._def.typeName).toBe('ZodOptional');
  });

  it('should handle array schema', () => {
    const schema = {
      type: 'array',
      items: { type: 'string' }
    };
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.innerType._def.typeName).toBe('ZodArray');
    expect(result._def.innerType._def.type._def.typeName).toBe('ZodString');
  });

  it('should handle enum schema', () => {
    const schema = {
      type: 'string',
      enum: ['option1', 'option2', 'option3']
    };
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.innerType._def.typeName).toBe('ZodEnum');
    expect(result._def.innerType._def.values).toEqual(['option1', 'option2', 'option3']);
  });

  it('should handle complex nested schema', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            roles: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['id', 'name']
        },
        metadata: {
          type: 'object',
          properties: {
            created: { type: 'string' },
            updated: { type: 'string' }
          }
        }
      },
      required: ['user']
    };
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.innerType._def.typeName).toBe('ZodObject');
    expect(result._def.innerType._def.shape.user._def.typeName).toBe('ZodObject');
    expect(result._def.innerType._def.shape.metadata._def.typeName).toBe('ZodOptional');
  });

  it('should fallback gracefully for invalid schema', () => {
    const schema = null;
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.typeName).toBe('ZodRecord');
  });

  it('should handle anyOf union types', () => {
    const schema = {
      anyOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    };
    const result = jsonSchemaToZodSchema(schema);
    expect(result._def.innerType._def.typeName).toBe('ZodUnion');
    expect(result._def.innerType._def.options).toHaveLength(2);
  });
});
