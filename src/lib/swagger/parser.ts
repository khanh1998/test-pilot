import SwaggerParser from 'swagger-parser';
import yaml from 'js-yaml';
import type { OpenAPIV2, OpenAPIV3 } from 'openapi-types';

type SwaggerDocument = OpenAPIV2.Document | OpenAPIV3.Document;

/**
 * Parse OpenAPI/Swagger specification content
 * @param content - The content of the OpenAPI/Swagger specification
 * @param format - The format of the content ('yaml' or 'json')
 */
export async function parseSwaggerSpec(content: string, format: 'yaml' | 'json'): Promise<SwaggerDocument> {
  try {
    // Convert the content to JSON if it's in YAML format
    const jsonContent = format === 'yaml' ? yaml.load(content) : JSON.parse(content);
    // Validate and dereference the OpenAPI/Swagger spec
    // Use type assertion to tell TypeScript that this method exists
    const api = await (SwaggerParser as any).dereference(jsonContent as SwaggerDocument);
    
    return api;
  } catch (error) {
    console.error('Error parsing OpenAPI/Swagger specification:', error);
    throw new Error(`Failed to parse OpenAPI/Swagger specification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract endpoints from an OpenAPI/Swagger specification
 * @param api - The parsed OpenAPI/Swagger specification
 */
export function extractEndpoints(api: SwaggerDocument) {
  const endpoints = [];
  
  // Handle OpenAPI 3.x
  if ('openapi' in api && api.openapi.startsWith('3.')) {
    const paths = api.paths || {};
    
    for (const path in paths) {
      const pathItem = paths[path] as any;
      
      for (const method of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']) {
        if (pathItem[method]) {
          const operation = pathItem[method];
          
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            requestSchema: extractRequestSchema(operation),
            responseSchema: extractResponseSchema(operation),
            parameters: extractParameters(operation, pathItem),
            tags: operation.tags || [],
          });
        }
      }
    }
  } 
  // Handle Swagger 2.0
  else if ('swagger' in api && api.swagger === '2.0') {
    const paths = api.paths || {};
    
    for (const path in paths) {
      const pathItem = paths[path] as any;
      
      for (const method of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']) {
        if (pathItem[method]) {
          const operation = pathItem[method];
          
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            requestSchema: extractSwagger2RequestSchema(operation),
            responseSchema: extractSwagger2ResponseSchema(operation),
            parameters: extractSwagger2Parameters(operation, pathItem),
            tags: operation.tags || [],
          });
        }
      }
    }
  }
  
  return endpoints;
}

/**
 * Extract host information from an OpenAPI/Swagger specification
 * @param api - The parsed OpenAPI/Swagger specification
 * @returns The host URL if available, otherwise null
 */
export function extractHost(api: SwaggerDocument): string | null {
  // For OpenAPI 3.x
  if ('openapi' in api && api.openapi.startsWith('3.')) {
    if (api.servers && api.servers.length > 0) {
      // Get the first server URL
      const serverUrl = api.servers[0].url;
      try {
        // Extract host from server URL
        const url = new URL(serverUrl);
        return url.host;
      } catch (error) {
        // If not a valid URL, just return the server URL as is
        // It might be a relative URL or a templated URL
        return serverUrl;
      }
    }
    return null;
  } 
  // For Swagger 2.0
  else if ('swagger' in api && api.swagger === '2.0') {
    // In Swagger 2.0, host is directly specified
    if (api.host) {
      return api.host;
    }
    return null;
  }
  
  return null;
}

// Helper functions for OpenAPI 3.x
function extractRequestSchema(operation: any) {
  if (!operation.requestBody) return null;
  
  const content = operation.requestBody.content || {};
  const contentType = Object.keys(content)[0]; // Get the first content type (usually application/json)
  
  if (contentType && content[contentType].schema) {
    return content[contentType].schema;
  }
  
  return null;
}

function extractResponseSchema(operation: any) {
  if (!operation.responses) return null;
  
  // Look for 200 or 201 response first
  const successResponse = operation.responses['200'] || operation.responses['201'];
  
  if (successResponse && successResponse.content) {
    const contentType = Object.keys(successResponse.content)[0];
    if (contentType && successResponse.content[contentType].schema) {
      return successResponse.content[contentType].schema;
    }
  }
  
  return null;
}

function extractParameters(operation: any, pathItem: any) {
  const parameters = [];
  
  // Path parameters can be defined at the path level or operation level
  const pathParams = pathItem.parameters || [];
  const operationParams = operation.parameters || [];
  
  // Combine parameters, with operation parameters taking precedence
  return [...pathParams, ...operationParams];
}

// Helper functions for Swagger 2.0
function extractSwagger2RequestSchema(operation: any) {
  if (!operation.parameters) return null;
  
  // Find body parameter
  const bodyParam = operation.parameters.find((param: any) => param.in === 'body');
  
  if (bodyParam && bodyParam.schema) {
    return bodyParam.schema;
  }
  
  return null;
}

function extractSwagger2ResponseSchema(operation: any) {
  if (!operation.responses) return null;
  
  // Look for 200 or 201 response first
  const successResponse = operation.responses['200'] || operation.responses['201'];
  
  if (successResponse && successResponse.schema) {
    return successResponse.schema;
  }
  
  return null;
}

function extractSwagger2Parameters(operation: any, pathItem: any) {
  // Path parameters can be defined at the path level or operation level
  const pathParams = pathItem.parameters || [];
  const operationParams = operation.parameters || [];
  
  // Combine parameters, with operation parameters taking precedence
  return [...pathParams, ...operationParams];
}
