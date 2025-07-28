ALTER TABLE "endpoint_embeddings" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "fts_idx" ON "endpoint_embeddings" USING gin ("search_vector");