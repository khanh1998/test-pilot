import type { Endpoint } from './types';

// Format JSON for display
export function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
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
  // Make sure this matches the format used in FlowRunner.svelte's executeEndpoint method
  return `${endpointId}-${endpointIndex}`;
}

// Generate a sample request body based on the schema
export function generateSampleBody(schema: any): any {
  if (!schema) return {};
  
  // Handle different types of schemas
  if (schema.type === 'object') {
    const result: Record<string, any> = {};
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        result[propName] = generateSampleValueForProperty(propSchema as any, propName);
      }
    }
    return result;
  } else if (schema.type === 'array') {
    return [generateSampleValueForProperty(schema.items, 'item')];
  } else {
    return generateSampleValueForProperty(schema, 'value');
  }
}

// Generate a sample value for a specific property based on its schema
export function generateSampleValueForProperty(propSchema: any, propName: string): any {
  if (!propSchema) return null;
  
  // If schema has an example, use it
  if (propSchema.example !== undefined) {
    return propSchema.example;
  }
  
  // Based on type, generate appropriate sample value
  switch (propSchema.type) {
    case 'string':
      if (propSchema.enum) return propSchema.enum[0];
      if (propSchema.format === 'date-time') return new Date().toISOString();
      if (propSchema.format === 'date') return new Date().toISOString().split('T')[0];
      if (propSchema.format === 'email') return `user@example.com`;
      if (propSchema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
      if (propName.toLowerCase().includes('name')) return 'Sample Name';
      if (propName.toLowerCase().includes('email')) return 'user@example.com';
      if (propName.toLowerCase().includes('description')) return 'Sample description';
      return `Sample ${propName}`;
    
    case 'number':
    case 'integer':
      if (propSchema.minimum !== undefined && propSchema.maximum !== undefined) {
        return Math.floor((propSchema.minimum + propSchema.maximum) / 2);
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
      if (propSchema.items) {
        return [generateSampleValueForProperty(propSchema.items, 'item')];
      }
      return [];
    
    default:
      return null;
  }
}
