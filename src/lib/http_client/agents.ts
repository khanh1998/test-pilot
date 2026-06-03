import { fetchWithAuth } from './util.js';

export interface AgentToken {
  id: number;
  userId: number;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listAgentTokens(): Promise<{ tokens: AgentToken[] }> {
  const response = await fetchWithAuth('/api/agents/tokens');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to load agent tokens');
  }

  return response.json();
}

export async function createAgentToken(data: {
  name: string;
  expiresAt?: string | null;
}): Promise<{ token: AgentToken; plainTextToken: string }> {
  const response = await fetchWithAuth('/api/agents/tokens', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create agent token');
  }

  return response.json();
}

export async function revokeAgentToken(id: number): Promise<{ token: AgentToken }> {
  const response = await fetchWithAuth(`/api/agents/tokens/${id}/revoke`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke agent token');
  }

  return response.json();
}

export async function deleteAgentToken(id: number): Promise<void> {
  const response = await fetchWithAuth(`/api/agents/tokens/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete agent token');
  }
}
