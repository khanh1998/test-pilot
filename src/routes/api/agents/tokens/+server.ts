import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';

const agentTokenService = new AgentTokenService();

// GET /api/agents/tokens - List agent tokens for the authenticated user
export async function GET({ locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await agentTokenService.listUserTokens(locals.user.userId);
    return json({ tokens });
  } catch (error) {
    console.error('Error listing agent tokens:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/agents/tokens - Create an agent token
export async function POST({ request, locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.name || typeof data.name !== 'string') {
      return json({ error: 'Token name is required' }, { status: 400 });
    }

    if (
      data.expiresAt !== undefined &&
      data.expiresAt !== null &&
      typeof data.expiresAt !== 'string'
    ) {
      return json({ error: 'Expiration date must be a string or null' }, { status: 400 });
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.expiresAt && Number.isNaN(expiresAt?.getTime())) {
      return json({ error: 'Expiration date is invalid' }, { status: 400 });
    }

    const result = await agentTokenService.createToken(locals.user.userId, {
      name: data.name,
      expiresAt
    });

    return json(
      {
        token: result.token,
        plainTextToken: result.plainTextToken
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating agent token:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('required') ||
        error.message.includes('exceed') ||
        error.message.includes('future')
      ) {
        return json({ error: error.message }, { status: 400 });
      }
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
