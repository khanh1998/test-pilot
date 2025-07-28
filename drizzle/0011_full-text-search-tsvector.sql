-- Custom SQL migration file, put your code below! --
-- 1. Add tsvector column for full-text search
-- ALTER TABLE "endpoint_embeddings" 
-- ADD COLUMN "search_vector" tsvector;

-- 2. Populate the search vector from processed_text
-- UPDATE "endpoint_embeddings" 
-- SET "search_vector" = to_tsvector('english', COALESCE("processed_text", ''));

-- 3. Create GIN index for fast full-text search
-- CREATE INDEX "fts_idx" ON "endpoint_embeddings" USING GIN("search_vector");

-- 4. Create a trigger to automatically update search_vector when processed_text changes
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.processed_text, ''));
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_endpoint_embeddings_search_vector
    BEFORE INSERT OR UPDATE OF processed_text
    ON "endpoint_embeddings"
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();