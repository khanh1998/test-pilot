-- Custom SQL migration file, put your code below! --

-- Add the new columns to the endpoint_embeddings table
ALTER TABLE "endpoint_embeddings" 
ADD COLUMN "user_id" integer,
ADD COLUMN "api_id" integer;

-- Create the new compound index
CREATE INDEX "user_api_idx" ON "endpoint_embeddings" ("user_id", "api_id");

-- Populate user_id and api_id from the existing relationships
UPDATE "endpoint_embeddings" ee
SET 
  "user_id" = a."user_id",
  "api_id" = ae."api_id"
FROM "api_endpoints" ae
JOIN "apis" a ON ae."api_id" = a."id"
WHERE ee."endpoint_id" = ae."id";