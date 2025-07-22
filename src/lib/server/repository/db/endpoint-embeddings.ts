import { sql, cosineDistance, desc, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { endpointEmbeddings, apiEndpoints, apis } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { NewEndpointEmbedding, EndpointEmbedding } from '$lib/server/db/types';

/**
 * Repository for endpoint embeddings operations
 */
export class EndpointEmbeddingsRepository {
  /**
   * Create or update an endpoint embedding
   * 
   * @param embedding - The endpoint embedding to create or update
   * @returns The created or updated endpoint embedding
   */
  async createOrUpdate(embedding: NewEndpointEmbedding): Promise<EndpointEmbedding> {
    const result = await db
      .insert(endpointEmbeddings)
      .values(embedding)
      .onConflictDoUpdate({
        target: endpointEmbeddings.endpointId,
        set: {
          embedding: embedding.embedding,
          processedText: embedding.processedText,
          version: sql`${endpointEmbeddings.version} + 1`,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return result[0];
  }
  
  /**
   * Get an endpoint embedding by endpoint ID
   * 
   * @param endpointId - The ID of the endpoint
   * @returns The endpoint embedding or null if not found
   */
  async getByEndpointId(endpointId: number): Promise<EndpointEmbedding | null> {
    const result = await db
      .select()
      .from(endpointEmbeddings)
      .where(eq(endpointEmbeddings.endpointId, endpointId))
      .limit(1);
    
    return result[0] || null;
  }
  
  /**
   * Delete an endpoint embedding by endpoint ID
   * 
   * @param endpointId - The ID of the endpoint
   * @returns True if the embedding was deleted, false otherwise
   */
  async delete(endpointId: number): Promise<boolean> {
    const result = await db
      .delete(endpointEmbeddings)
      .where(eq(endpointEmbeddings.endpointId, endpointId))
      .returning({ id: endpointEmbeddings.id });
    
    return result.length > 0;
  }
  
  /**
   * Find similar endpoints based on a vector embedding
   * 
   * @param embedding - The vector embedding to compare with
   * @param limit - The maximum number of results to return (default: 10)
   * @param similarityThreshold - The minimum similarity score (default: 0.65)
   * @returns An array of endpoints with similarity scores
   */
  async findSimilarEndpoints(
    embedding: number[],
    limit = 10,
    similarityThreshold = 0.65
  ): Promise<Array<{ 
    id: number; 
    apiId: number; 
    path: string; 
    method: string; 
    operationId: string | null;
    summary: string | null;
    description: string | null;
    tags: string[] | null;
    similarity: number;
  }>> {
    // Calculate cosine similarity: 1 - cosine_distance
    const similarity = sql<number>`1 - (${cosineDistance(endpointEmbeddings.embedding, embedding)})`;
    
    // Query similar endpoints
    const result = await db
      .select({
        id: apiEndpoints.id,
        apiId: apiEndpoints.apiId,
        path: apiEndpoints.path,
        method: apiEndpoints.method,
        operationId: apiEndpoints.operationId,
        summary: apiEndpoints.summary,
        description: apiEndpoints.description,
        tags: apiEndpoints.tags,
        similarity: similarity
      })
      .from(endpointEmbeddings)
      .innerJoin(apiEndpoints, eq(endpointEmbeddings.endpointId, apiEndpoints.id))
      .where(gt(similarity, similarityThreshold))
      .orderBy((t) => desc(t.similarity))
      .limit(limit);
    
    return result;
  }
  
  /**
   * Get all endpoint embeddings
   * 
   * @returns All endpoint embeddings
   */
  async getAll(): Promise<EndpointEmbedding[]> {
    return db.select().from(endpointEmbeddings);
  }
  
  /**
   * Get endpoint embeddings for a specific API
   * 
   * @param apiId - The ID of the API
   * @returns Endpoint embeddings for the specified API
   */
  async getByApiId(apiId: number): Promise<EndpointEmbedding[]> {
    return db
      .select({
        id: endpointEmbeddings.id,
        endpointId: endpointEmbeddings.endpointId,
        embedding: endpointEmbeddings.embedding,
        processedText: endpointEmbeddings.processedText,
        version: endpointEmbeddings.version,
        createdAt: endpointEmbeddings.createdAt,
        updatedAt: endpointEmbeddings.updatedAt
      })
      .from(endpointEmbeddings)
      .innerJoin(apiEndpoints, eq(endpointEmbeddings.endpointId, apiEndpoints.id))
      .where(eq(apiEndpoints.apiId, apiId));
  }

  /**
   * Verify that an endpoint belongs to a specific user
   * 
   * @param endpointId - The ID of the endpoint
   * @param userId - The ID of the user
   * @returns True if the endpoint belongs to the user, false otherwise
   */
  async verifyEndpointAccess(endpointId: number, userId: number): Promise<boolean> {
    const result = await db
      .select({ count: apis.id })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(
        and(
          eq(apiEndpoints.id, endpointId),
          eq(apis.userId, userId)
        )
      );

    return result.length > 0;
  }

  /**
   * Get endpoint details with its API information
   * 
   * @param endpointId - The ID of the endpoint
   * @param userId - The ID of the user
   * @returns The endpoint with API information or null if not found
   */
  async getEndpointWithApi(endpointId: number, userId: number) {
    const result = await db
      .select({
        endpoint: apiEndpoints,
        api: apis
      })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(
        and(
          eq(apiEndpoints.id, endpointId),
          eq(apis.userId, userId)
        )
      )
      .limit(1);

    return result[0] || null;
  }
}
