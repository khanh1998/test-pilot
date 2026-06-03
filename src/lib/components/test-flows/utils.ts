export { generateSampleBody, generateSampleValueForProperty } from '$lib/schema-sample';

// Format JSON for display
export function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e: unknown) {
    return String(obj);
  }
}

// Get status color based on response status code
export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-500';
  if (status >= 400 && status < 500) return 'bg-yellow-500';
  if (status >= 500) return 'bg-red-500';
  return 'bg-gray-500';
}

// Helper to generate unique display ID for an endpoint in a step
export function getEndpointDisplayId(endpointId: string | number, endpointIndex: number): string {
  // This was previously generating using endpointId-endpointIndex format
  // Now in FlowRunner.svelte we're using stepId-endpointIndex format
  // TODO: Update this function to take stepId as a parameter instead of endpointId
  // For now, this function should only be used when creating display IDs, not for execution state lookup
  return `${endpointId}-${endpointIndex}`;
}
