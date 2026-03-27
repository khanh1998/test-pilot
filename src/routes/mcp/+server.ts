import type { RequestHandler } from './$types';
import { handleMcpRequest } from '$lib/server/mcp/transport-manager';

export const GET: RequestHandler = async ({ request }) => {
  return handleMcpRequest(request);
};

export const POST: RequestHandler = async ({ request }) => {
  return handleMcpRequest(request);
};

export const DELETE: RequestHandler = async ({ request }) => {
  return handleMcpRequest(request);
};
