import { endpointEmbeddings } from '$lib/server/db/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

/**
 * Type for a new endpoint embedding (for inserts)
 */
export type NewEndpointEmbedding = InferInsertModel<typeof endpointEmbeddings>;

/**
 * Type for an endpoint embedding retrieved from the database
 */
export type EndpointEmbedding = InferSelectModel<typeof endpointEmbeddings>;
