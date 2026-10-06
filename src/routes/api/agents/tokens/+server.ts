import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';
import { CreateAgentTokenRequest } from '$lib/schemas/agents';

const agentTokenService = new AgentTokenService();

export async function GET({ locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tokens = await agentTokenService.listUserTokens(locals.user.userId);
    return json({ tokens });
  } catch (error) {
    console.error('Error listing agent tokens:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonRequest(request, CreateAgentTokenRequest);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, expiresAt } = parsed.data;
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

  try {
    const result = await agentTokenService.createToken(locals.user.userId, {
      name,
      expiresAt: expiresAtDate
    });
    return json({ token: result.token, plainTextToken: result.plainTextToken }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent token:', error);
    if (error instanceof Error && /required|exceed|future/.test(error.message)) {
      return json({ error: error.message }, { status: 400 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
