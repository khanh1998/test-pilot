import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';
import { tokenIdParam } from '$lib/schemas/agents';

const agentTokenService = new AgentTokenService();

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = tokenIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid token ID' }, { status: 400 });

  try {
    await agentTokenService.deleteToken(parsed.data.id, locals.user.userId);
    return json({ message: 'Agent token deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent token:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return json({ error: 'Agent token not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
