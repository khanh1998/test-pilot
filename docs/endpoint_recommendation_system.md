# API Endpoint Recommendation System with pgvector

## Overview

This document outlines the implementation of an intelligent API endpoint recommendation system that suggests relevant endpoints based on natural language test flow descriptions. The system leverages PostgreSQL with the pgvector extension to perform semantic similarity searches against embedded API endpoint data.

## Why Vector Search for API Endpoint Recommendations?

Vector search (using pgvector) is ideal for this use case because:

1. **Semantic Understanding**: Captures the meaning and intent in the user's test flow descriptions, not just keywords
2. **Natural Language Processing**: Handles free-form descriptions like "Create a new user and verify they can log in"
3. **Relevance Ranking**: Provides better relevance ranking based on semantic similarity
4. **Domain-Specific Language**: Understands relationships between related terms in API contexts

## Architecture

![Architecture Diagram](https://mermaid.ink/img/pako:eNqNkk9PwzAMxb_KyrkgdRuMcdkBiQtCHBAHLr2YxO1C16QkcdhU9bvj_IGyTRpK0sh-z_azX9qRwlqQgvTWuK33sGKWGDylpNn0VKuae8-VosalYNYT9jlWLC2zRq9BQeuogrrGg9CjSBRfSMiEjm_vI4cBobW2JaI8SPm4Zd-geuoGgV0gQdbZHo-AgchSWmcTYd4AkQ6yTxrSAXBqaTAE6hk7HY3VekUC23UidP-ZVr0z9jTJrP8dV-c4bjAeRVk-ljMoP3b5F3DHep9oPMmN5flHNc6HDU7LFnWLf_WcI7p0atDnmNBo43C04XJf5ZX64eSmpEWONo9eUOcs3QDPuOUG43tMfwgyE4WUEx5mupBCfh84b3pXXeJDv9e6lCyKzKscxf0Tnd5fRQ==)

The system consists of the following components:

1. **OpenAPI Parser**: Extracts endpoint metadata from uploaded Swagger/OpenAPI specifications
2. **Embedding Generator**: Processes API metadata and generates vector embeddings
3. **pgvector Database**: Stores and indexes endpoint embeddings for fast similarity search
4. **Recommendation Service**: Matches user descriptions to endpoints using vector similarity
5. **UI Components**: Displays recommendations and allows for selection

## Implementation Steps

### 1. Database Setup with pgvector

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for storing endpoint embeddings
CREATE TABLE endpoint_embeddings (
  id SERIAL PRIMARY KEY,
  endpoint_id INTEGER NOT NULL REFERENCES api_endpoints(id),
  embedding vector(1536), -- Dimension based on embedding model (e.g., OpenAI's ada-002)
  processed_text TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for fast similarity searches
CREATE INDEX ON endpoint_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 2. Endpoint Data Processing

The key to effective recommendations is rich, structured text representations of each endpoint:

```typescript
function createEndpointText(endpoint: ApiEndpoint, apiInfo: ApiInfo): string {
  // Start with HTTP method and path
  let text = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
  
  // Add API context
  text += `\nAPI: ${apiInfo.name}`;
  if (apiInfo.description) {
    text += `\nAPI Description: ${apiInfo.description}`;
  }
  
  // Add endpoint details
  if (endpoint.summary) text += `\nSummary: ${endpoint.summary}`;
  if (endpoint.description) text += `\nDescription: ${endpoint.description}`;
  if (endpoint.operationId) text += `\nOperation: ${endpoint.operationId}`;
  if (endpoint.tags?.length) text += `\nTags: ${endpoint.tags.join(', ')}`;
  
  // Extract and add resource and operation information
  const resource = inferResourceFromPath(endpoint.path);
  const operation = methodToOperation(endpoint.method, endpoint.path);
  
  // Add alternative phrasings for better matching
  text += generateAlternativePhrasings(resource, operation);
  
  return text;
}
```

### 3. Generating and Storing Embeddings

After processing the endpoint data, generate embeddings using a suitable model:

```typescript
async function generateEmbeddings(endpoints: ApiEndpoint[]): Promise<void> {
  for (const endpoint of endpoints) {
    // 1. Get API info
    const apiInfo = await getApiInfo(endpoint.apiId);
    
    // 2. Create rich text representation
    const processedText = createEndpointText(endpoint, apiInfo);
    
    // 3. Generate embedding using your chosen model
    const embedding = await embeddingModel.embed(processedText);
    
    // 4. Store in database
    await db.query(
      `INSERT INTO endpoint_embeddings 
       (endpoint_id, embedding, processed_text) 
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint_id) 
       DO UPDATE SET 
         embedding = $2, 
         processed_text = $3, 
         version = endpoint_embeddings.version + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [endpoint.id, embedding, processedText]
    );
  }
}
```

### 4. Recommendation Service

The core function that finds relevant endpoints based on a description:

```typescript
async function getRecommendedEndpoints(
  description: string,
  limit: number = 10,
  similarityThreshold: number = 0.65
): Promise<RecommendedEndpoint[]> {
  // 1. Generate embedding for the description
  const queryEmbedding = await embeddingModel.embed(description);
  
  // 2. Query the database for similar endpoints using pgvector
  const result = await db.query(`
    WITH similarities AS (
      SELECT 
        e.id,
        e.api_id,
        e.path,
        e.method,
        e.operation_id,
        e.summary,
        e.description,
        e.tags,
        1 - (emb.embedding <=> $1) AS similarity
      FROM api_endpoints e
      JOIN endpoint_embeddings emb ON e.id = emb.endpoint_id
      WHERE 1 - (emb.embedding <=> $1) > $2
    )
    SELECT * FROM similarities
    ORDER BY similarity DESC
    LIMIT $3
  `, [queryEmbedding, similarityThreshold, limit]);
  
  // 3. Post-process and enhance results
  return enhanceAndRankResults(result.rows, description);
}
```

### 5. Backend API Implementation

```typescript
// src/routes/api/endpoints/recommend/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRecommendedEndpoints } from '$lib/server/recommendations';

export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.getUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const { description } = await request.json();
  
  if (!description || typeof description !== 'string') {
    return json({ error: 'Invalid description' }, { status: 400 });
  }
  
  try {
    const recommendations = await getRecommendedEndpoints(description);
    return json({ endpoints: recommendations });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
};
```

### 6. Frontend Integration

Add state and functions to the Flow Generator component:

```typescript
// In FlowGeneratorPanel.svelte
import { debounce } from 'lodash-es';

// Add state for recommendations
let recommendedEndpoints = [];
let isRecommending = false;

// Create debounced recommendation function
const debouncedGetRecommendations = debounce(async (desc) => {
  if (!desc.trim() || desc.length < 5) {
    recommendedEndpoints = [];
    return;
  }
  
  try {
    isRecommending = true;
    const result = await apiClient.getRecommendedEndpoints(desc);
    if (result && result.endpoints) {
      recommendedEndpoints = result.endpoints;
    }
  } catch (err) {
    console.error('Error getting recommendations:', err);
  } finally {
    isRecommending = false;
  }
}, 500);

// Watch for description changes
$: if (description) {
  debouncedGetRecommendations(description);
}
```

And add a recommendations section to the UI:

```svelte
<!-- Recommended Endpoints Section -->
{#if recommendedEndpoints.length > 0}
  <div class="mt-4">
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-sm font-medium text-gray-700">Recommended Endpoints</h4>
      <button 
        class="text-xs text-blue-600 hover:text-blue-800" 
        on:click={addAllRecommendedEndpoints}
      >
        Add all
      </button>
    </div>
    <div class="mb-4 max-h-60 overflow-y-auto rounded-md border border-blue-100 bg-blue-50 divide-y divide-blue-100">
      <!-- Endpoint recommendation items -->
    </div>
  </div>
{:else if description.length >= 5 && isRecommending}
  <div class="p-4 mt-4 border border-dashed border-gray-300 rounded-md text-center">
    <div class="animate-pulse text-sm text-gray-500">Finding relevant endpoints...</div>
  </div>
{/if}
```

## Advanced Features

### 1. Learning from User Behavior

Track which recommendations users actually select to improve future recommendations:

```typescript
async function trackEndpointSelection(
  userId: string,
  flowDescription: string,
  endpointId: number,
  wasRecommended: boolean
): Promise<void> {
  await db.query(`
    INSERT INTO endpoint_recommendation_feedback
    (user_id, flow_description, endpoint_id, was_recommended, selected_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
  `, [userId, flowDescription, endpointId, wasRecommended]);
}
```

### 2. Endpoint Sequence Suggestions

Group endpoints into logical flows:

```typescript
function suggestEndpointSequences(
  recommendedEndpoints: RecommendedEndpoint[]
): EndpointSequence[] {
  // Group endpoints by resource type
  const resourceGroups = groupByResource(recommendedEndpoints);
  
  // For each resource, suggest a logical flow (e.g., CRUD operations)
  return Object.entries(resourceGroups).map(([resource, endpoints]) => {
    // Sort endpoints by logical operation order
    const sortedEndpoints = sortByOperationOrder(endpoints);
    
    return {
      resource,
      description: `Complete ${resource} flow`,
      endpoints: sortedEndpoints
    };
  });
}
```

### 3. Hybrid Search

For certain queries, combine vector search with lexical search for better results:

```typescript
async function hybridSearch(
  description: string,
  limit: number = 10
): Promise<RecommendedEndpoint[]> {
  // Get vector search results
  const vectorResults = await getRecommendedEndpoints(description, limit);
  
  // Get lexical search results (for exact matches)
  const lexicalResults = await getLexicalSearchResults(description, limit);
  
  // Merge results with priority to vector search
  return mergeAndDeduplicate(vectorResults, lexicalResults);
}
```

## Maintenance and Optimization

### Batch Processing

For large APIs, process embeddings in batches:

```typescript
async function batchProcessEmbeddings(
  endpoints: ApiEndpoint[],
  batchSize: number = 50
): Promise<void> {
  for (let i = 0; i < endpoints.length; i += batchSize) {
    const batch = endpoints.slice(i, i + batchSize);
    await generateEmbeddings(batch);
    console.log(`Processed batch ${i/batchSize + 1} of ${Math.ceil(endpoints.length/batchSize)}`);
  }
}
```

### Embedding Refresh Strategy

Keep embeddings up-to-date when APIs change:

```typescript
// Trigger this function when API specs are updated
async function refreshEndpointEmbeddings(apiId: number): Promise<void> {
  const endpoints = await getApiEndpoints(apiId);
  await generateEmbeddings(endpoints);
  console.log(`Refreshed embeddings for ${endpoints.length} endpoints from API #${apiId}`);
}
```

## Conclusion

This API endpoint recommendation system leverages PostgreSQL with pgvector to provide intelligent, context-aware suggestions based on natural language test flow descriptions. By implementing this system, users will be able to:

1. Quickly find relevant endpoints without manual searching
2. Discover logical endpoint sequences for common test flows
3. Save time when working with large and complex APIs

The vector-based approach ensures that recommendations are semantically meaningful rather than just keyword matches, significantly improving the user experience for test flow creation.
