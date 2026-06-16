import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';
import { createTestPilotMcpServer, type McpAuthContext } from '../../../mcp/app';

const agentTokenService = new AgentTokenService();

function jsonError(status: number, message: string): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message
      },
      id: null
    },
    { status }
  );
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'GET' || request.method === 'DELETE') {
      return jsonError(405, 'Stateless MCP server does not support SSE streams or session teardown');
    }

    if (request.method !== 'POST') {
      return Response.json({ error: `Method ${request.method} not allowed` }, { status: 405 });
    }

    const auth = await authenticateMcpRequest(request);
    const parsedBody = await request.clone().json().catch(() => undefined);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    const server = createTestPilotMcpServer(auth);
    await server.connect(transport);

    return transport.handleRequest(request, { parsedBody });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.startsWith('Unauthorized:')
      ? 401
      : message.startsWith('Forbidden:')
        ? 403
        : 500;

    return jsonError(status, message);
  }
}

async function authenticateMcpRequest(request: Request): Promise<McpAuthContext> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid agent token');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('Unauthorized: Missing or invalid agent token');
  }

  try {
    const authContext = await agentTokenService.authenticateToken(token);
    return {
      userId: authContext.userId,
      agentTokenId: authContext.tokenId,
      email: authContext.email,
      name: authContext.name
    };
  } catch {
    throw new Error('Unauthorized: Invalid or expired agent token');
  }
}
