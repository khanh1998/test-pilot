import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';
import { createTestPilotMcpServer, type McpAuthContext } from '../../../mcp/app';

interface McpSession {
  transport: WebStandardStreamableHTTPServerTransport;
  auth: McpAuthContext;
}

const transports = new Map<string, McpSession>();
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
    const auth = await authenticateMcpRequest(request);
    const sessionId = request.headers.get('mcp-session-id');

    if (request.method === 'POST') {
      const parsedBody = await request
        .clone()
        .json()
        .catch(() => undefined);

      if (sessionId && transports.has(sessionId)) {
        const session = transports.get(sessionId)!;
        ensureAuthorizedForSession(auth, session);
        return session.transport.handleRequest(request, { parsedBody });
      }

      if (!sessionId && parsedBody && isInitializeRequest(parsedBody)) {
        let transport!: WebStandardStreamableHTTPServerTransport;
        transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, {
              transport,
              auth
            });
          },
          onsessionclosed: (closedSessionId) => {
            transports.delete(closedSessionId);
          }
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            transports.delete(transport.sessionId);
          }
        };

        const server = createTestPilotMcpServer(auth);
        await server.connect(transport);
        return transport.handleRequest(request, { parsedBody });
      }

      return jsonError(400, 'Bad Request: No valid session ID provided');
    }

    if (request.method === 'GET' || request.method === 'DELETE') {
      if (!sessionId || !transports.has(sessionId)) {
        return jsonError(400, 'Invalid or missing session ID');
      }

      const session = transports.get(sessionId)!;
      ensureAuthorizedForSession(auth, session);
      return session.transport.handleRequest(request);
    }

    return Response.json(
      {
        error: `Method ${request.method} not allowed`
      },
      { status: 405 }
    );
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

function ensureAuthorizedForSession(auth: McpAuthContext, session: McpSession): void {
  if (auth.userId !== session.auth.userId || auth.agentTokenId !== session.auth.agentTokenId) {
    throw new Error('Forbidden: MCP session belongs to a different agent token');
  }
}
