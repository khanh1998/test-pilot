import { generateSkeletonTestFlow, type SkeletonTestFlow, type ApiInfoItem, type Step } from "$lib/server/repository/openai/skeleton-generator";
import { generateEmbedding, generateEmbeddings } from "$lib/server/repository/openai/embeddings";
import { EndpointEmbeddingsRepository } from "$lib/server/repository/db/endpoint-embeddings";

// Create repository instance
const endpointEmbeddingsRepository = new EndpointEmbeddingsRepository();

// Interface for enriched API info item with endpoint details
interface EnrichedApiInfoItem extends ApiInfoItem {
  endpoint?: {
    id: number;
    apiId: number;
    path: string;
    method: string;
    operationId: string | null;
    summary: string | null;
    description: string | null;
    tags: string[] | null;
    similarity: number;
  };
}

// Interface for enriched step
interface EnrichedStep extends Omit<Step, 'apiInfoItems'> {
  apiInfoItems: EnrichedApiInfoItem[];
}

// Interface for enriched skeleton test flow
interface EnrichedSkeletonTestFlow extends Omit<SkeletonTestFlow, 'steps'> {
  steps: EnrichedStep[];
}

/**
 * Generate a skeleton test flow and enrich it with endpoint information
 * 
 * @param description - The user's test flow description
 * @param userId - Optional user ID to filter endpoints
 * @returns Enriched skeleton test flow with endpoint information
 */
export async function generateSkeletonTestFlowService(
  description: string,
  userId?: number
): Promise<EnrichedSkeletonTestFlow> {
  try {
    // Generate the base skeleton test flow
    const skeletonTestFlow = await generateSkeletonTestFlow(description);
    
    // Collect all API signatures and their metadata for batch processing
    const allApiInfoItems: { 
      apiSignature: string; 
      stepIndex: number; 
      itemIndex: number;
      apiItem: ApiInfoItem;
    }[] = [];
    
    // Collect all API signatures
    skeletonTestFlow.steps.forEach((step, stepIndex) => {
      step.apiInfoItems.forEach((apiInfoItem, itemIndex) => {
        allApiInfoItems.push({
          apiSignature: apiInfoItem.apiSignature,
          stepIndex,
          itemIndex,
          apiItem: apiInfoItem
        });
      });
    });
    
    // Batch generate embeddings for all API signatures
    const apiSignatures = allApiInfoItems.map(item => item.apiSignature);
    let embeddings: number[][] = [];
    
    // Only make the API call if we have signatures to process
    if (apiSignatures.length > 0) {
      try {
        // Generate embeddings for all API signatures in a single call
        embeddings = await generateEmbeddings(apiSignatures);
      } catch (error) {
        console.error('Error generating batch embeddings:', error);
        // Create a clone of steps for the error case
        return {
          ...skeletonTestFlow,
          steps: JSON.parse(JSON.stringify(skeletonTestFlow.steps))
        };
      }
    }
    
    // Create a map to store enriched API info items by stepIndex and itemIndex
    const enrichedApiInfoItemsMap = new Map<string, EnrichedApiInfoItem>();
    
    // Process embeddings and find similar endpoints in parallel
    await Promise.all(
      allApiInfoItems.map(async ({ apiSignature, stepIndex, itemIndex, apiItem }, index) => {
        try {
          const embedding = embeddings[index];
          
          // Find the most relevant endpoint using the embedding
          const similarEndpoints = await endpointEmbeddingsRepository.findSimilarEndpoints(
            embedding,
            1, // limit to the most relevant endpoint
            0.5, // lower threshold to ensure we get at least one result
            userId
          );
          
          // Create enriched API info item
          const enrichedItem: EnrichedApiInfoItem = {
            ...apiItem,
            endpoint: similarEndpoints.length > 0 ? similarEndpoints[0] : undefined
          };
          
          // Store in map with a compound key
          enrichedApiInfoItemsMap.set(`${stepIndex}-${itemIndex}`, enrichedItem);
        } catch (error) {
          console.error(`Error finding similar endpoints for signature "${apiSignature}":`, error);
          // Store the original item in case of error
          enrichedApiInfoItemsMap.set(`${stepIndex}-${itemIndex}`, apiItem);
        }
      })
    );
    
    // Reconstruct the steps with enriched API info items
    const enrichedSteps = skeletonTestFlow.steps.map((step, stepIndex) => {
      const enrichedApiInfoItems = step.apiInfoItems.map((_, itemIndex) => {
        // Get the enriched item from the map
        return enrichedApiInfoItemsMap.get(`${stepIndex}-${itemIndex}`) || _;
      });
      
      return {
        ...step,
        apiInfoItems: enrichedApiInfoItems
      };
    });
    
    // Return enriched skeleton test flow
    return {
      ...skeletonTestFlow,
      steps: enrichedSteps
    };
  } catch (error) {
    console.error('Error generating enriched skeleton test flow:', error);
    throw new Error('Failed to generate enriched skeleton test flow');
  }
}