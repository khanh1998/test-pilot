import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { apiEndpoints, testFlows } from '$lib/server/db/schema';

/** Saved test flows owned by the user that use any endpoint of the given API. */
export async function findApiFlowReferences(apiId: number, userId: number) {
  const endpointIds = new Set(
    (
      await db
        .select({ id: apiEndpoints.id })
        .from(apiEndpoints)
        .where(eq(apiEndpoints.apiId, apiId))
    ).map((row) => row.id)
  );
  if (endpointIds.size === 0) return [];

  const flows = await db
    .select({ id: testFlows.id, name: testFlows.name, flowJson: testFlows.flowJson })
    .from(testFlows)
    .where(eq(testFlows.userId, userId));

  return flows
    .filter((flow) => flowUsesAnyEndpoint(flow.flowJson, endpointIds))
    .map(({ id, name }) => ({ id, name }));
}

function flowUsesAnyEndpoint(flowJson: unknown, endpointIds: Set<number>): boolean {
  const steps = (flowJson as { steps?: unknown[] } | null)?.steps;
  if (!Array.isArray(steps)) return false;
  return steps.some((step) => {
    const endpoints = (step as { endpoints?: unknown[] } | null)?.endpoints;
    return (
      Array.isArray(endpoints) &&
      endpoints.some((endpoint) =>
        endpointIds.has(Number((endpoint as { endpoint_id?: unknown } | null)?.endpoint_id))
      )
    );
  });
}
