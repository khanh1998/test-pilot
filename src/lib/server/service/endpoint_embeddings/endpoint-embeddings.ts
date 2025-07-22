import { EndpointEmbeddingsRepository } from '$lib/server/repository/db/endpoint-embeddings';
import { generateEmbedding, generateEmbeddings, createEndpointText } from '$lib/server/repository/openai/embeddings';
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
   * @returns The created or updated endpoint embedding
   */
  async processEndpoint(
    endpoint: ApiEndpoint, 
    apiName: string,
    apiDescription?: string
  ) {
    // 1. Create rich text representation
    const processedText = createEndpointText(endpoint, apiName, apiDescription);
    
    // 2. Generate embedding using OpenAI
    const embedding = await generateEmbedding(processedText);
    
    // 3. Store embedding in the database
    const newEmbedding: NewEndpointEmbedding = {
      endpointId: endpoint.id,
      embedding,
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
   * @param batchSize - The number of endpoints to process in each batch
   */
  async batchProcessEndpoints(
    endpoints: ApiEndpoint[],
    apiName: string,
    apiDescription?: string,
    batchSize = 10
  ) {
    console.log(`Processing ${endpoints.length} endpoints in batches of ${batchSize}`);
    
    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      const promises = batch.map(endpoint => 
        this.processEndpoint(endpoint, apiName, apiDescription)
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
   * @returns Similar endpoints with similarity scores
   */
  async findSimilarEndpoints(description: string, limit = 10, similarityThreshold = 0.65) {
    // Generate embedding for the query description
    const embedding = await generateEmbedding(description);
    
    // Find similar endpoints
    return this.repository.findSimilarEndpoints(embedding, limit, similarityThreshold);
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
   * Find similar endpoints for multiple sentences
   * 
   * @param sentences - Array of sentences to find similar endpoints for
   * @param limit - The maximum number of results to return per sentence
   * @param similarityThreshold - The minimum similarity threshold
   * @returns Array of unique similar endpoints with similarity scores
   */
  async findSimilarEndpointsMultiSentence(
    sentences: string[], 
    limit = 10, 
    similarityThreshold = 0.8
  ) {
    // Generate embeddings for all sentences at once
    const embeddings = await generateEmbeddings(sentences);

    console.log("embeddings size: ", embeddings.length)
    
    // Find similar endpoints for each embedding
    const allRecommendations = await Promise.all(
      embeddings.map(embedding => 
        this.repository.findSimilarEndpoints(embedding, limit, similarityThreshold)
      )
    );
    
    // Combine results and remove duplicates
    const endpointMap = new Map();
    
    // Flatten the array and keep the highest similarity score for duplicates
    allRecommendations.flat().forEach(endpoint => {
      const existingEndpoint = endpointMap.get(endpoint.id);
      
      // If endpoint doesn't exist in map or has higher similarity than existing one, add/update it
      if (!existingEndpoint || endpoint.similarity > existingEndpoint.similarity) {
        endpointMap.set(endpoint.id, endpoint);
      }
    });
    
    // Convert map values back to array and sort by similarity
    const uniqueRecommendations = Array.from(endpointMap.values())
      .sort((a, b) => b.similarity - a.similarity);
    
    return uniqueRecommendations;
  }
}
