import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';

const agentTokenService = new AgentTokenService();

// POST /api/agents/tokens/[id]/revoke - Revoke an agent token
export async function POST({ params, locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenId = parseInt(params.id as string, 10);
    if (Number.isNaN(tokenId)) {
      return json({ error: 'Invalid token ID' }, { status: 400 });
    }

    const token = await agentTokenService.revokeToken(tokenId, locals.user.userId);
    return json({ token });
  } catch (error) {
    console.error('Error revoking agent token:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return json({ error: 'Agent token not found' }, { status: 404 });
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
