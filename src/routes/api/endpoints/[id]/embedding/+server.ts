import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { EndpointEmbeddingsService } from '$lib/server/service/endpoint_embeddings/endpoint-embeddings';

/**
 * POST handler to generate and store an embedding for a specific endpoint
 * 
 * @param params - Request parameters containing the endpoint ID
 * @param locals - Local variables including user authentication
 * @returns JSON response with the result of the embedding creation
 */
export async function POST({ params, locals }: RequestEvent) {
  try {
    const endpointId = parseInt(params.id || '');

    // Validate the endpoint ID
    if (isNaN(endpointId)) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create an instance of the embedding service
    const embeddingService = new EndpointEmbeddingsService();

    // Get the endpoint with its associated API and verify access
    const endpoint = await embeddingService.getEndpointWithApi(endpointId, locals.user.userId);

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Endpoint not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process the endpoint to generate and store its embedding
    const result = await embeddingService.processEndpoint(
      endpoint.endpoint,
      endpoint.api.name,
      endpoint.api.description || undefined
    );

    return json({
      success: true,
      message: 'Endpoint embedding created successfully',
      embedding: {
        id: result.id,
        endpointId: result.endpointId,
        version: result.version,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating endpoint embedding:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to create endpoint embedding',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * DELETE handler to remove the embedding for a specific endpoint
 * 
 * @param params - Request parameters containing the endpoint ID
 * @param locals - Local variables including user authentication
 * @returns JSON response with the result of the deletion
 */
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    const endpointId = parseInt(params.id || '');

    // Validate the endpoint ID
    if (isNaN(endpointId)) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create an instance of the embedding service
    const embeddingService = new EndpointEmbeddingsService();
    
    // Verify that the endpoint belongs to the user's API
    const hasAccess = await embeddingService.verifyEndpointAccess(endpointId, locals.user.userId);

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Endpoint not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the embedding for this endpoint
    const deleted = await embeddingService.deleteEndpointEmbedding(endpointId);

    if (deleted) {
      return json({
        success: true,
        message: 'Endpoint embedding deleted successfully'
      });
    } else {
      return json({
        success: false,
        message: 'No embedding found for this endpoint'
      });
    }
  } catch (error) {
    console.error('Error deleting endpoint embedding:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to delete endpoint embedding',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * GET handler to retrieve the embedding for a specific endpoint
 * 
 * @param params - Request parameters containing the endpoint ID
 * @param locals - Local variables including user authentication
 * @returns JSON response with the embedding details
 */
export async function GET({ params, locals }: RequestEvent) {
  try {
    const endpointId = parseInt(params.id || '');

    // Validate the endpoint ID
    if (isNaN(endpointId)) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create an instance of the embedding service
    const embeddingService = new EndpointEmbeddingsService();
    
    // Verify that the endpoint belongs to the user's API
    const hasAccess = await embeddingService.verifyEndpointAccess(endpointId, locals.user.userId);

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Endpoint not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Use the service to get the embedding
    const embedding = await embeddingService.getEmbeddingByEndpointId(endpointId);

    if (embedding) {
      return json({
        embedding: {
          id: embedding.id,
          endpointId: embedding.endpointId,
          // Don't return the actual embedding vector for security/bandwidth reasons
          // embedding: embedding.embedding,
          processedText: embedding.processedText,
          version: embedding.version,
          createdAt: embedding.createdAt,
          updatedAt: embedding.updatedAt
        }
      });
    } else {
      return json({
        embedding: null,
        message: 'No embedding found for this endpoint'
      });
    }
  } catch (error) {
    console.error('Error retrieving endpoint embedding:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve endpoint embedding',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
