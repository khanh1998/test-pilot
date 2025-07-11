// Format JSON for display
export function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e: unknown) {
    return String(obj);
  }
}

// Get status color based on response status code
export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-500';
  if (status >= 400 && status < 500) return 'bg-yellow-500';
  if (status >= 500) return 'bg-red-500';
  return 'bg-gray-500';
}

// Helper to generate unique display ID for an endpoint in a step
export function getEndpointDisplayId(endpointId: string | number, endpointIndex: number): string {
  // This was previously generating using endpointId-endpointIndex format
  // Now in FlowRunner.svelte we're using stepId-endpointIndex format
  // TODO: Update this function to take stepId as a parameter instead of endpointId
  // For now, this function should only be used when creating display IDs, not for execution state lookup
  return `${endpointId}-${endpointIndex}`;
}

// Generate a sample request body based on the schema
export function generateSampleBody(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null) return {};

  // Handle different types of schemas
  if ((schema as { type?: string }).type === 'object') {
    const result: Record<string, unknown> = {};
    const properties = (schema as { properties?: Record<string, unknown> }).properties;
    if (properties) {
      for (const [propName, propSchema] of Object.entries(properties)) {
        result[propName] = generateSampleValueForProperty(propSchema, propName);
      }
    }
    return result;
  } else if ((schema as { type?: string }).type === 'array') {
    return [generateSampleValueForProperty((schema as { items?: unknown }).items, 'item')];
  } else {
    return generateSampleValueForProperty(schema, 'value');
  }
}

// Generate a sample value for a specific property based on its schema
export function generateSampleValueForProperty(propSchema: unknown, propName: string): unknown {
  if (typeof propSchema !== 'object' || propSchema === null) return null;

  // If schema has an example, use it
  if (Object.prototype.hasOwnProperty.call(propSchema, 'example')) {
    return (propSchema as { example: unknown }).example;
  }

  // Based on type, generate appropriate sample value
  switch ((propSchema as { type?: string }).type) {
    case 'string':
      if (
        Object.prototype.hasOwnProperty.call(propSchema, 'enum') &&
        Array.isArray((propSchema as { enum: unknown[] }).enum)
      )
        return (propSchema as { enum: unknown[] }).enum[0];
      if ((propSchema as { format?: string }).format === 'date-time')
        return new Date().toISOString();
      if ((propSchema as { format?: string }).format === 'date')
        return new Date().toISOString().split('T')[0];
      if ((propSchema as { format?: string }).format === 'email') return `user@example.com`;
      if ((propSchema as { format?: string }).format === 'uuid')
        return '00000000-0000-0000-0000-000000000000';
      if (propName.toLowerCase().includes('name')) return 'Sample Name';
      if (propName.toLowerCase().includes('email')) return 'user@example.com';
      if (propName.toLowerCase().includes('description')) return 'Sample description';
      return `Sample ${propName}`;

    case 'number':
    case 'integer':
      const numSchema = propSchema as { minimum?: number; maximum?: number };
      if (numSchema.minimum !== undefined && numSchema.maximum !== undefined) {
        return Math.floor((numSchema.minimum + numSchema.maximum) / 2);
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
      const arraySchema = propSchema as { items?: unknown };
      if (arraySchema.items) {
        return [generateSampleValueForProperty(arraySchema.items, 'item')];
      }
      return [];

    default:
      return null;
  }
}
