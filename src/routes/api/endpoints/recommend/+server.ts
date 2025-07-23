import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { EndpointEmbeddingsService } from '$lib/server/service/endpoint_embeddings/main';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Check if user is authenticated
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const userId = locals.user.userId;
  
  const { description, limit, similarityThreshold = 0.8 } = await request.json();
  
  if (!description || typeof description !== 'string') {
    return json({ error: 'Invalid description' }, { status: 400 });
  }
  
  try {
    const service = new EndpointEmbeddingsService();
    
    // Split description into sentences by newline character
    const sentences = description.split('\n').filter(sentence => sentence.trim());
    
    // If no valid sentences, use the original description
    if (sentences.length === 0) {
      sentences.push(description);
    }

    console.log({sentences, limit, similarityThreshold})
    
    // Get recommendations for each sentence and merge results
    const recommendations = await service.findSimilarEndpointsMultiSentence(
      sentences,
      limit || 10,
      similarityThreshold,
      userId // Pass the authenticated user's ID
    );
    
    return json({ endpoints: recommendations });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
};
