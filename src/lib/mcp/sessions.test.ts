import { describe, expect, it } from 'vitest';
import { createFlowSession, getFlowSession, getFlowSessionTtlMs, updateFlowSession } from './sessions';

describe('mcp flow sessions', () => {
  it('creates and updates scoped flow sessions', () => {
    const session = createFlowSession(42, 7);

    expect(session.projectId).toBe(7);
    expect(session.status).toBe('awaiting_scope_selection');

    const updated = updateFlowSession(session.id, 42, {
      apiIds: [27],
      environmentId: 9,
      subEnvironment: 'default',
      status: 'ready_for_draft'
    });

    expect(updated.apiIds).toEqual([27]);
    expect(updated.environmentId).toBe(9);
    expect(updated.subEnvironment).toBe('default');
    expect(getFlowSession(session.id, 42)?.status).toBe('ready_for_draft');
  });

  it('can track the source flow being edited', () => {
    const session = createFlowSession(7, 3, { sourceFlowId: 190 });
    expect(session.sourceFlowId).toBe(190);
  });

  it('applies a default ttl to sessions', () => {
    const session = createFlowSession(9, 4);
    expect(session.expiresAt - session.createdAt).toBe(getFlowSessionTtlMs());
  });
});
