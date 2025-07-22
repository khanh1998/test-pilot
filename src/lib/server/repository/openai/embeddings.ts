import OpenAI from 'openai';
import type { ApiEndpoint } from '$lib/types/api';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

/**
 * Generate an embedding using OpenAI's text-embedding model
 * 
 * @param text - The text to generate an embedding for
 * @returns The generated embedding as a number array
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Clean and normalize the input text
  const input = text.replaceAll('\n', ' ').trim();
  
  try {
    const { data } = await openai.embeddings.create({
      model: 'text-embedding-ada-002', // or the latest embedding model
      input
    });
    
    return data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate embeddings for multiple texts using OpenAI's text-embedding model
 * 
 * @param texts - An array of texts to generate embeddings for
 * @returns An array of embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Clean and normalize the input texts
  const inputs = texts.map(text => text.replaceAll('\n', ' ').trim());
  
  try {
    const { data } = await openai.embeddings.create({
      model: 'text-embedding-ada-002', // or the latest embedding model
      input: inputs
    });
    
    // Return embeddings in the same order as inputs
    return data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

/**
 * Create a rich text representation of an API endpoint for embedding
 * 
 * @param endpoint - The API endpoint
 * @param apiName - The name of the API
 * @param apiDescription - The description of the API
 * @returns A text representation of the endpoint
 */
export function createEndpointText(
  endpoint: ApiEndpoint,
  apiName: string,
  apiDescription?: string
): string {
  // Start with HTTP method and path
  let text = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
  
  // Add API context
  text += `\nAPI: ${apiName}`;
  if (apiDescription) {
    text += `\nAPI Description: ${apiDescription}`;
  }
  
  // Add endpoint details
  if (endpoint.summary) text += `\nSummary: ${endpoint.summary}`;
  if (endpoint.description) text += `\nDescription: ${endpoint.description}`;
  if (endpoint.operationId) text += `\nOperation: ${endpoint.operationId}`;
  if (endpoint.tags?.length) text += `\nTags: ${endpoint.tags.join(', ')}`;
  
  // Extract resource and operation information
  const resource = inferResourceFromPath(endpoint.path);
  if (resource) text += `\nResource: ${resource}`;
  
  // Add alternative phrasings for better matching
  text += generateAlternativePhrasings(resource, endpoint.method, endpoint.path);
  
  return text;
}

/**
 * Infer the resource name from an API path
 * 
 * @param path - The API path
 * @returns The inferred resource name or null if not found
 */
function inferResourceFromPath(path: string): string | null {
  // Remove leading slash and split path
  const parts = path.replace(/^\//, '').split('/');
  
  // First segment is usually the resource name
  const resource = parts[0];
  
  // Exclude common non-resource path segments
  if (['api', 'v1', 'v2', 'v3', 'docs', 'swagger', 'health'].includes(resource)) {
    return parts.length > 1 ? parts[1] : null;
  }
  
  return resource || null;
}

/**
 * Generate alternative phrasings for a resource and operation
 * 
 * @param resource - The resource name
 * @param method - The HTTP method
 * @param path - The API path
 * @returns Alternative phrasings as a string
 */
function generateAlternativePhrasings(
  resource: string | null,
  method: string,
  path: string
): string {
  if (!resource) return '';
  
  const operation = methodToOperation(method, path);
  let phrasings = '\nAlternatives:';
  
  // Pluralize/singularize resource name
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  const plural = resource.endsWith('s') ? resource : `${resource}s`;
  
  // Add alternatives based on the operation
  switch (operation) {
    case 'list':
      phrasings += `\n- Get all ${plural}`;
      phrasings += `\n- Retrieve ${plural}`;
      phrasings += `\n- List ${plural}`;
      phrasings += `\n- Fetch ${plural}`;
      break;
    case 'get':
      phrasings += `\n- Get a ${singular}`;
      phrasings += `\n- Get ${singular} details`;
      phrasings += `\n- Retrieve a ${singular}`;
      phrasings += `\n- Fetch a ${singular}`;
      break;
    case 'create':
      phrasings += `\n- Create a new ${singular}`;
      phrasings += `\n- Add a ${singular}`;
      phrasings += `\n- Register a ${singular}`;
      break;
    case 'update':
      phrasings += `\n- Update a ${singular}`;
      phrasings += `\n- Modify a ${singular}`;
      phrasings += `\n- Edit a ${singular}`;
      phrasings += `\n- Change a ${singular}`;
      break;
    case 'delete':
      phrasings += `\n- Delete a ${singular}`;
      phrasings += `\n- Remove a ${singular}`;
      break;
  }
  
  return phrasings;
}

/**
 * Map HTTP method to a semantic operation
 * 
 * @param method - The HTTP method
 * @param path - The API path
 * @returns The semantic operation
 */
function methodToOperation(method: string, path: string): string {
  // Convert method to lowercase for easier comparison
  method = method.toLowerCase();
  
  // Check if path has an ID parameter (e.g., /users/{id}, /users/:id)
  const hasIdParam = path.match(/\{.+\}|:.+?($|\/)/);
  
  switch (method) {
    case 'get':
      return hasIdParam ? 'get' : 'list';
    case 'post':
      return 'create';
    case 'put':
    case 'patch':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return method;
  }
}
