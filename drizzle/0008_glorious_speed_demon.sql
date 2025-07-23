ALTER TABLE "endpoint_embeddings" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "endpoint_embeddings" ADD COLUMN "api_id" integer;--> statement-breakpoint
CREATE INDEX "user_api_idx" ON "endpoint_embeddings" USING btree ("user_id","api_id");