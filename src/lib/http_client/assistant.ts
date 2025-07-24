import { fetchWithAuth } from './util';
import type { SkeletonTestFlow } from '$lib/server/repository/openai/skeleton-generator';

// Interface for endpoint details
interface EndpointInfo {
  id: number;
  apiId: number;
  path: string;
  method: string;
  operationId: string | null;
  summary: string | null;
  description: string | null;
  tags: string[] | null;
  similarity: number;
}

// Interface for enriched API info item
interface EnrichedApiInfoItem {
  id: string;
  apiSignature: string;
  transforms: string[];
  assertions: string[];
  note: string | null;
  dependsOn: string[];
  endpoint?: EndpointInfo;
}

// Interface for enriched step
interface EnrichedStep {
  id: string;
  apiInfoItems: EnrichedApiInfoItem[];
  description: string;
}

// Interface for enriched skeleton test flow
export interface EnrichedSkeletonTestFlow extends Omit<SkeletonTestFlow, 'steps'> {
  steps: EnrichedStep[];
}

export async function generateSkeletonTestFlow(description: string): Promise<EnrichedSkeletonTestFlow | null> {
  try {
    const response = await fetchWithAuth('/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    });

    if (response.ok) {
      const data = await response.json();
      return data.skeletonTestFlow;
    } else {
      console.error('Failed to generate skeleton test flow:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error generating skeleton test flow:', error);
    return null;
  }
}
