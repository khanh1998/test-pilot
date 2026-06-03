export function generateSampleBody(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null) return {};

  const schemaObject = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    items?: unknown;
  };

  if (schemaObject.type === 'object' || schemaObject.properties) {
    const result: Record<string, unknown> = {};
    const properties = schemaObject.properties;
    if (properties) {
      for (const [propName, propSchema] of Object.entries(properties)) {
        result[propName] = generateSampleValueForProperty(propSchema, propName);
      }
    }
    return result;
  }

  if (schemaObject.type === 'array') {
    return [generateSampleValueForProperty(schemaObject.items, 'item')];
  }

  return generateSampleValueForProperty(schema, 'value');
}

export function generateSampleValueForProperty(propSchema: unknown, propName: string): unknown {
  if (typeof propSchema !== 'object' || propSchema === null) return null;

  const schemaObject = propSchema as {
    type?: string;
    items?: unknown;
    format?: string;
    example?: unknown;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    properties?: Record<string, unknown>;
  };

  if (Object.prototype.hasOwnProperty.call(schemaObject, 'example')) {
    return schemaObject.example;
  }

  if (Array.isArray(schemaObject.enum) && schemaObject.enum.length > 0) {
    return schemaObject.enum[0];
  }

  const inferredType =
    schemaObject.type ||
    (schemaObject.properties ? 'object' : schemaObject.items ? 'array' : undefined);

  switch (inferredType) {
    case 'string':
      if (schemaObject.format === 'date-time') return new Date().toISOString();
      if (schemaObject.format === 'date') return new Date().toISOString().split('T')[0];
      if (schemaObject.format === 'email') return 'user@example.com';
      if (schemaObject.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
      if (propName.toLowerCase().includes('token')) return 'sample-token';
      if (propName.toLowerCase().includes('name')) return 'Sample Name';
      if (propName.toLowerCase().includes('email')) return 'user@example.com';
      if (propName.toLowerCase().includes('description')) return 'Sample description';
      return `Sample ${propName}`;

    case 'number':
    case 'integer':
      if (schemaObject.minimum !== undefined && schemaObject.maximum !== undefined) {
        return Math.floor((schemaObject.minimum + schemaObject.maximum) / 2);
      }
      if (propName.toLowerCase().includes('age')) return 30;
      if (propName.toLowerCase().includes('count')) return 5;
      if (propName.toLowerCase().includes('id')) return 1;
      return 0;

    case 'boolean':
      return true;

    case 'object':
      return generateSampleBody(propSchema);

    case 'array':
      if (schemaObject.items) {
        return [generateSampleValueForProperty(schemaObject.items, 'item')];
      }
      return [];

    default:
      return null;
  }
}
