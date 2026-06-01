import { endpointEmbeddings } from '$lib/server/db/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type NewEndpointSearchIndex = InferInsertModel<typeof endpointEmbeddings>;

export type EndpointSearchIndex = InferSelectModel<typeof endpointEmbeddings>;
