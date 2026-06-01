import { and, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apiEndpoints, apis, endpointEmbeddings } from '$lib/server/db/schema';
import type { EndpointSearchIndex, NewEndpointSearchIndex } from '$lib/server/db/types';

export class EndpointSearchIndexRepository {
  async createOrUpdate(searchIndex: NewEndpointSearchIndex): Promise<EndpointSearchIndex> {
    const searchVector = searchIndex.processedText
      ? sql`to_tsvector('english', ${searchIndex.processedText})`
      : null;

    const result = await db
      .insert(endpointEmbeddings)
      .values({
        ...searchIndex,
        searchVector
      })
      .onConflictDoUpdate({
        target: endpointEmbeddings.endpointId,
        set: {
          processedText: searchIndex.processedText,
          searchVector,
          userId: searchIndex.userId,
          apiId: searchIndex.apiId,
          version: sql`${endpointEmbeddings.version} + 1`,
          updatedAt: new Date()
        }
      })
      .returning();

    return result[0];
  }

  async delete(endpointId: number): Promise<boolean> {
    const result = await db
      .delete(endpointEmbeddings)
      .where(eq(endpointEmbeddings.endpointId, endpointId))
      .returning({ id: endpointEmbeddings.id });

    return result.length > 0;
  }

  async getByEndpointId(endpointId: number): Promise<EndpointSearchIndex | null> {
    const result = await db
      .select()
      .from(endpointEmbeddings)
      .where(eq(endpointEmbeddings.endpointId, endpointId))
      .limit(1);

    return result[0] || null;
  }

  async getByApiId(apiId: number): Promise<EndpointSearchIndex[]> {
    return db
      .select({
        id: endpointEmbeddings.id,
        endpointId: endpointEmbeddings.endpointId,
        userId: endpointEmbeddings.userId,
        apiId: endpointEmbeddings.apiId,
        searchVector: endpointEmbeddings.searchVector,
        processedText: endpointEmbeddings.processedText,
        version: endpointEmbeddings.version,
        createdAt: endpointEmbeddings.createdAt,
        updatedAt: endpointEmbeddings.updatedAt
      })
      .from(endpointEmbeddings)
      .innerJoin(apiEndpoints, eq(endpointEmbeddings.endpointId, apiEndpoints.id))
      .where(eq(apiEndpoints.apiId, apiId));
  }

  async verifyEndpointAccess(endpointId: number, userId: number): Promise<boolean> {
    const result = await db
      .select({ id: apis.id })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(and(eq(apiEndpoints.id, endpointId), eq(apis.userId, userId)))
      .limit(1);

    return result.length > 0;
  }

  async getEndpointWithApi(endpointId: number, userId: number) {
    const result = await db
      .select({
        endpoint: apiEndpoints,
        api: apis
      })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(and(eq(apiEndpoints.id, endpointId), eq(apis.userId, userId)))
      .limit(1);

    return result[0] || null;
  }
}
