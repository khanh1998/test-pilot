-- Custom SQL migration file, put your code below! --
-- Populate user_id and api_id from the existing relationships
UPDATE "endpoint_embeddings" ee
SET 
  "user_id" = a."user_id",
  "api_id" = ae."api_id"
FROM "api_endpoints" ae
JOIN "apis" a ON ae."api_id" = a."id"
WHERE ee."endpoint_id" = ae."id";
