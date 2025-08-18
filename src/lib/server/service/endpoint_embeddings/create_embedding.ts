import { EndpointEmbeddingsRepository } from '$lib/server/repository/db/endpoint-embeddings';
import { createEndpointText } from '$lib/server/repository/openai/embeddings';
import type { ApiEndpoint } from '$lib/types/api';
import type { NewEndpointEmbedding } from '$lib/server/db/types';

/**
 * Service for managing endpoint embeddings
 */
export class EndpointEmbeddingsService {
  private repository: EndpointEmbeddingsRepository;
  
  constructor() {
    this.repository = new EndpointEmbeddingsRepository();
  }
  
  /**
   * Generate and store embeddings for an API endpoint
   * 
   * @param endpoint - The API endpoint
   * @param apiName - The name of the API
   * @param apiDescription - The description of the API
   * @param userId - The ID of the user who owns the API
   * @returns The created or updated endpoint embedding
   */
  async processEndpoint(
    endpoint: ApiEndpoint, 
    apiName: string,
    apiDescription?: string,
    userId?: number
  ) {
    // 1. Create rich text representation
    const processedText = createEndpointText(endpoint, apiName, apiDescription);
    
    // 2. Store embedding in the database (without OpenAI embedding for now)
    const newEmbedding: NewEndpointEmbedding = {
      endpointId: endpoint.id,
      userId: userId,
      apiId: endpoint.apiId,
      // embedding: null, // Skip OpenAI embedding for now
      processedText
    };
    
    return this.repository.createOrUpdate(newEmbedding);
  }
  
  /**
   * Process multiple endpoints in batches
   * 
   * @param endpoints - The API endpoints to process
   * @param apiName - The name of the API
   * @param apiDescription - The description of the API
   * @param userId - The ID of the user who owns the API
   * @param batchSize - The number of endpoints to process in each batch
   */
  async batchProcessEndpoints(
    endpoints: ApiEndpoint[],
    apiName: string,
    apiDescription?: string,
    userId?: number,
    batchSize = 10
  ) {
    console.log(`Processing ${endpoints.length} endpoints in batches of ${batchSize}`);
    
    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      const promises = batch.map(endpoint => 
        this.processEndpoint(endpoint, apiName, apiDescription, userId)
      );
      
      await Promise.all(promises);
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(endpoints.length / batchSize)}`);
    }
  }
  
  /**
   * Find endpoints similar to a given description
   * 
   * @param description - The description to find similar endpoints for
   * @param limit - The maximum number of results to return
   * @param similarityThreshold - The minimum similarity threshold
   * @param userId - The ID of the user to filter endpoints by (optional)
   * @returns Similar endpoints with similarity scores
   */
  async findSimilarEndpoints(
    description: string, 
    limit = 10, 
    similarityThreshold = 0.65, 
    userId?: number
  ) {
    // For now, return empty array since we're focusing on tsvector search
    // Will implement OpenAI embedding search later
    return [];
  }
  
  /**
   * Delete embeddings for an endpoint
   * 
   * @param endpointId - The ID of the endpoint
   * @returns True if the embedding was deleted, false otherwise
   */
  async deleteEndpointEmbedding(endpointId: number) {
    return this.repository.delete(endpointId);
  }
  
  /**
   * Get embeddings for a specific API
   * 
   * @param apiId - The ID of the API
   * @returns Endpoint embeddings for the specified API
   */
  async getEmbeddingsByApiId(apiId: number) {
    return this.repository.getByApiId(apiId);
  }

  /**
   * Get embedding for a specific endpoint
   * 
   * @param endpointId - The ID of the endpoint
   * @returns The endpoint embedding or null if not found
   */
  async getEmbeddingByEndpointId(endpointId: number) {
    return this.repository.getByEndpointId(endpointId);
  }

  /**
   * Verify that an endpoint belongs to a specific user
   * 
   * @param endpointId - The ID of the endpoint
   * @param userId - The ID of the user
   * @returns True if the endpoint belongs to the user, false otherwise
   */
  async verifyEndpointAccess(endpointId: number, userId: number) {
    return this.repository.verifyEndpointAccess(endpointId, userId);
  }

  /**
   * Get endpoint details with its API information
   * 
   * @param endpointId - The ID of the endpoint
   * @param userId - The ID of the user
   * @returns The endpoint with API information or null if not found
   */
  async getEndpointWithApi(endpointId: number, userId: number) {
    return this.repository.getEndpointWithApi(endpointId, userId);
  }

  /**
   * Find endpoints similar to multiple sentences
   * 
   * @param sentences - Array of sentences to find similar endpoints for
   * @param limit - The maximum number of results to return per sentence
   * @param similarityThreshold - The minimum similarity threshold
   * @param userId - The ID of the user to filter endpoints by (optional)
   * @returns Array of unique similar endpoints with similarity scores
   */
  async findSimilarEndpointsMultiSentence(
    sentences: string[], 
    limit = 10, 
    similarityThreshold = 0.8,
    userId?: number
  ) {
    // For now, return empty array since we're focusing on tsvector search
    // Will implement OpenAI embedding search later
    return [];
  }
}
