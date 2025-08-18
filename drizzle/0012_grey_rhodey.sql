ALTER TABLE "endpoint_embeddings" DROP CONSTRAINT "endpoint_embeddings_endpoint_id_api_endpoints_id_fk";
--> statement-breakpoint
ALTER TABLE "endpoint_embeddings" ADD CONSTRAINT "endpoint_embeddings_endpoint_id_api_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."api_endpoints"("id") ON DELETE cascade ON UPDATE no action;